import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { proxy } from 'hono/proxy';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../utils/logger';
import { getConfig } from '../utils/config';
import { tracingMiddleware, registerTracingRoutes } from './middleware/tracing';
import { sseMiddleware, registerSSERoutes } from './middleware/streaming';
import { findMatchingRoute } from './routes';
import { createProxyRoutesAPI } from './api';

export class ProxyServer {
  private app: Hono;
  private config = getConfig().proxy;

  constructor() {
    this.app = new Hono();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    // Enable CORS
    this.app.use('*', cors());

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
}

export default ProxyServer;
