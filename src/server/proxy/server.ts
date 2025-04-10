import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { proxy } from 'hono/proxy';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../utils/logger';
import { getConfig } from '../utils/config';
import { tracingMiddleware, registerTracingRoutes } from './middleware/tracing';
import { responseTransformerMiddleware } from './middleware/response-transformer';
import { sseMiddleware, registerSSERoutes } from './middleware/streaming';
import { findMatchingRoute } from './routes';
import { createProxyRoutesAPI } from './api';
import { MCPHonoServerManager } from '../mcp/hono-server';
import { augmentEngine } from '../augment';

export class ProxyServer {
  private app: Hono;
  private config = getConfig().proxy;
  private mcpManager: MCPHonoServerManager | null = null;
  private augmentInitialized = false;

  constructor() {
    this.app = new Hono();

    // Initialize MCP server if enabled
    if (this.config.mcpEnabled) {
      this.mcpManager = new MCPHonoServerManager();
    }

    // Initialize Augment Context Engine if enabled
    if (getConfig().augment.enabled) {
      this.initializeAugmentContextEngine();
    }

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    // Enable CORS
    this.app.use('*', cors());

    // Add response transformer middleware (must come before tracing)
    this.app.use('*', responseTransformerMiddleware);

    // Add tracing middleware
    this.app.use('*', tracingMiddleware);

    // Add SSE middleware
    this.app.use('*', sseMiddleware);

    // Add error handling middleware
    this.app.onError((err, c) => {
      logger.error('Server error:', err);
      return c.json({
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      }, 500);
    });
  }

  /**
   * Initialize the Augment Context Engine
   */
  private async initializeAugmentContextEngine() {
    try {
      if (this.augmentInitialized) {
        logger.info('Augment Context Engine already initialized');
        return;
      }

      logger.info('Initializing Augment Context Engine');

      // Check if the engine is already initialized (might have been initialized by the VS Code extension)
      if (!augmentEngine.isInitialized()) {
        await augmentEngine.initialize();
      } else {
        logger.info('Augment Context Engine was already initialized by the VS Code extension');
      }

      this.augmentInitialized = true;
      logger.info('Augment Context Engine initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Augment Context Engine:', error);
    }
  }

  private setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (c) => {
      return c.json({ status: 'ok' });
    });

    // API version endpoint
    this.app.get('/api/version', (c) => {
      return c.json({ version: '1.0.0' });
    });

    // Register tracing routes for the dashboard
    if (this.config.dashboardEnabled) {
      registerTracingRoutes(this.app);
    }

    // Register SSE management routes
    registerSSERoutes(this.app);

    // Mount the proxy routes API
    this.app.route('', createProxyRoutesAPI());

    // Set up MCP routes if enabled
    if (this.config.mcpEnabled) {
      this.setupMCPRoutes();
    }

    // Serve static assets from the webview-ui/dist directory
    const webviewDistPath = path.resolve(__dirname, '..', 'webview-ui', 'dist');

    console.log(__dirname);
    console.log(webviewDistPath);

    // Check if the webview-ui/dist directory exists
    if (fs.existsSync(webviewDistPath)) {
      logger.info(`Serving dashboard from ${webviewDistPath}`);

      // Serve the dashboard at the root path
      this.app.get('/', async (c) => {
        try {
          const indexPath = path.join(webviewDistPath, 'index.html');
          if (fs.existsSync(indexPath)) {
            const content = fs.readFileSync(indexPath, 'utf-8');
            return c.html(content);
          } else {
            logger.error(`index.html not found at ${indexPath}`);
            return c.text('Dashboard index.html not found', 404);
          }
        } catch (error) {
          logger.error(`Failed to serve dashboard: ${error}`);
          return c.text('Failed to load dashboard. Make sure webview-ui is built.', 500);
        }
      });

      // Serve static assets
      this.app.get('/assets/*', async (c) => {
        try {
          const requestPath = c.req.path;
          const relativePath = requestPath.replace(/^\//, ''); // Remove leading slash
          const filePath = path.join(webviewDistPath, relativePath);

          if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath);
            const contentType = requestPath.endsWith('.js')
              ? 'application/javascript'
              : requestPath.endsWith('.css')
                ? 'text/css'
                : 'application/octet-stream';

            return new Response(content, {
              headers: {
                'Content-Type': contentType
              }
            });
          } else {
            logger.error(`Static file not found: ${filePath}`);
            return c.notFound();
          }
        } catch (error) {
          logger.error(`Failed to serve static file: ${error}`);
          return c.text('Failed to load static file', 500);
        }
      });
    } else {
      logger.warn(`Dashboard assets not found at ${webviewDistPath}. The dashboard will not be available at the root path.`);
    }

    // Serve the proxy routes manager UI (legacy path, can be removed later)
    this.app.get('/proxy-routes', (c) => {
      const filePath = path.join(__dirname, 'public', 'routes.html');
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return c.html(content);
      } catch (error) {
        logger.error(`Failed to serve routes.html: ${error}`);
        return c.text('Failed to load proxy routes manager', 500);
      }
    });

    // Generic proxy endpoint for all custom routes
    this.app.all('/proxy/*', async (c) => {
      try {
        const url = new URL(c.req.url);
        const requestPath = url.pathname.replace('/proxy/', '');

        // Find matching route
        const route = findMatchingRoute(requestPath);

        if (!route) {
          return c.json({ error: 'No matching proxy route found' }, 404);
        }

        // Construct target URL
        const targetUrl = new URL(route.target);

        // Add the remaining path
        if (requestPath.startsWith(route.path + '/')) {
          const remainingPath = requestPath.substring(route.path.length);
          targetUrl.pathname = targetUrl.pathname.replace(/\/?$/, '') + remainingPath;
        }

        // Copy query parameters
        url.searchParams.forEach((value, key) => {
          targetUrl.searchParams.append(key, value);
        });

        logger.info(`Proxying request: ${requestPath} -> ${targetUrl.toString()}`);

        // Special handling for streaming requests
        // Check for SSE requests (Accept: text/event-stream)
        const acceptHeader = c.req.header('accept') || '';
        const isStreaming = acceptHeader.includes('text/event-stream') || c.req.path.includes("gemini");

        logger.info(`Request streaming status: ${isStreaming ? 'Streaming' : 'Non-streaming'}`);

        if (isStreaming) {
          // For streaming requests, use fetch directly instead of Hono's proxy to preserve the stream
          try {
            // Prepare headers for the forwarded request
            const headers: Record<string, string> = {
              ...c.req.header(),
              'X-Forwarded-Host': c.req.header('host') || '',
              'X-Forwarded-For': c.req.header('x-forwarded-for') || c.req.header('cf-connecting-ip') || ''
            };

            // Get the request method
            const method = c.req.method;

            // Prepare fetch options
            // Use any type to allow for the duplex property which is not in the standard RequestInit type
            const fetchOptions: RequestInit & { duplex?: 'half' } = {
              method,
              headers
            };

            // Add body for methods that support it
            if (['POST', 'PUT', 'PATCH'].includes(method)) {
              const contentType = c.req.header('content-type') || '';

              if (contentType.includes('application/json')) {
                try {
                  // For JSON requests, get the body directly
                  // This works because we're in a streaming context where we need the raw body
                  const bodyText = await c.req.text();
                  fetchOptions.body = bodyText;
                } catch (error) {
                  logger.error('Error getting request body:', error);
                  return c.json({
                    error: 'Failed to process request body',
                    details: (error as Error).message
                  }, 400);
                }
              } else {
                try {
                  // For other content types, get the raw body as text
                  const bodyText = await c.req.text();
                  fetchOptions.body = bodyText;
                } catch (error) {
                  logger.error('Error getting request body:', error);
                  return c.json({
                    error: 'Failed to process request body',
                    details: (error as Error).message
                  }, 400);
                }
              }
            }

            // Forward the request
            // Add duplex option for streaming requests if not already set
            if (!fetchOptions.duplex && ['POST', 'PUT', 'PATCH'].includes(method)) {
              fetchOptions.duplex = 'half';
            }

            const response = await fetch(targetUrl.toString(), fetchOptions);

            // Return the response directly without processing
            return new Response(response.body, {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers
            });
          } catch (error) {
            logger.error('Streaming proxy error:', error);
            return c.json({
              error: 'Failed to proxy streaming request',
              details: (error as Error).message
            }, 502);
          }
        } else {
          // Use Hono's proxy helper for non-streaming requests
          return await proxy(targetUrl.toString(), {
            ...c.req,
            headers: {
              ...c.req.header(),
              'X-Forwarded-Host': c.req.header('host') || '',
              'X-Forwarded-For': c.req.header('x-forwarded-for') || c.req.header('cf-connecting-ip') || ''
            }
          });
        }
      } catch (error) {
        logger.error('Proxy error:', error);
        return c.json({
          error: 'Failed to proxy request',
          details: (error as Error).message
        }, 502);
      }
    });

    // Keep the original /api/ai/* endpoint for backward compatibility
    this.app.all('/api/ai/*', async (c) => {
      try {
        const url = new URL(c.req.url);
        const targetPath = url.pathname.replace('/api/ai', '');
        const targetUrl = new URL(targetPath, 'http://localhost:3001');

        // Copy query parameters
        url.searchParams.forEach((value, key) => {
          targetUrl.searchParams.append(key, value);
        });

        // Use Hono's proxy helper to forward the request
        return await proxy(targetUrl.toString(), {
          ...c.req,
          headers: {
            ...c.req.header(),
            'X-Forwarded-Host': c.req.header('host') || '',
            'X-Forwarded-For': c.req.header('x-forwarded-for') || c.req.header('cf-connecting-ip') || ''
          }
        });
      } catch (error) {
        logger.error('Proxy error:', error);
        return c.json({
          error: 'Failed to proxy request',
          details: (error as Error).message
        }, 502);
      }
    });

    // Catch-all route for SPA - must be last after all other routes
    // This ensures that client-side routing works for the dashboard
    // We already have webviewDistPath defined above
    if (fs.existsSync(webviewDistPath)) {
      this.app.get('*', async (c) => {
        // Skip API routes and other special paths
        const url = new URL(c.req.url);
        if (url.pathname.startsWith('/api/') ||
            url.pathname.startsWith('/proxy/') ||
            url.pathname === '/health' ||
            url.pathname.startsWith('/assets/')) {
          return c.notFound();
        }

        try {
          const indexPath = path.join(webviewDistPath, 'index.html');
          if (fs.existsSync(indexPath)) {
            const content = fs.readFileSync(indexPath, 'utf-8');
            return c.html(content);
          } else {
            logger.error(`index.html not found at ${indexPath}`);
            return c.text('Dashboard index.html not found', 404);
          }
        } catch (error) {
          logger.error(`Failed to serve SPA: ${error}`);
          return c.text('Failed to load dashboard', 500);
        }
      });
    }
  }

  public getApp() {
    return this.app;
  }

  /**
   * Shutdown the server and clean up resources
   */
  public shutdown(): void {
    logger.info('Shutting down proxy server resources');

    // Shutdown Augment Context Engine if initialized
    if (this.augmentInitialized) {
      try {
        augmentEngine.shutdown();
        this.augmentInitialized = false;
        logger.info('Augment Context Engine shut down successfully');
      } catch (error) {
        logger.error('Error shutting down Augment Context Engine:', error);
      }
    }
  }

  /**
   * Set up MCP server routes
   */
  private setupMCPRoutes() {
    if (!this.mcpManager) {
      logger.info('MCP server is disabled, skipping route registration');
      return;
    }

    // SSE endpoint for MCP connections
    this.app.get('/mcp/sse', async (c) => {
      if (this.mcpManager) {
        return await this.mcpManager.handleSSEConnection(c.req.raw);
      }
      return c.json({ error: 'MCP server not initialized' }, 500);
    });

    // Message endpoint for MCP clients to send messages
    this.app.post('/mcp/messages', async (c) => {
      if (this.mcpManager) {
        return await this.mcpManager.handlePostMessage(c.req.raw);
      }
      return c.json({ error: 'MCP server not initialized' }, 500);
    });

    // Health check endpoint for MCP
    this.app.get('/mcp/health', (c) => {
      return c.json({ status: 'ok', service: 'mcp' });
    });

    logger.info('MCP routes registered on the proxy server');
  }

  /**
   * Get the MCP server manager
   * @returns MCPHonoServerManager instance or null if disabled
   */
  public getMCPManager() {
    return this.mcpManager;
  }
}

export default ProxyServer;
