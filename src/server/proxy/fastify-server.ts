import fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyHttpProxy from '@fastify/http-proxy';
import fastifyStatic from '@fastify/static';
import fastifySensible from '@fastify/sensible';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../utils/logger';
import { getConfig } from '../utils/config';
import { findMatchingRoute, getProxyRoutes } from './routes';
import { registerProxyRoutesAPI } from './fastify-api';
import { augmentEngine } from '../augment';
import otelPlugin from './middleware/fastify-otel-plugin';
import { ssePlugin } from './middleware/fastify-sse';
import { registerWebSocketRoutes, broadcastNewTrace } from '../gateway/websocket';
// Import MCPServerManager from Express implementation
import { MCPServerManager } from '../mcp/server';

export class FastifyProxyServer {
  private server: FastifyInstance;
  private config = getConfig().proxy;
  private mcpManager: MCPServerManager | null = null;
  private augmentInitialized = false;

  constructor() {
    // Create Fastify instance with logging configuration
    this.server = fastify({
      logger: false, // We'll use our own logger
      disableRequestLogging: true, // We'll handle this in our tracing plugin
      ignoreTrailingSlash: true,
      connectionTimeout: 30000, // 30 seconds
      keepAliveTimeout: 30000, // 30 seconds
      maxParamLength: 500,
      bodyLimit: 10 * 1024 * 1024, // 10MB
    });

    // Initialize MCP server if enabled
    if (this.config.mcpEnabled) {
      this.mcpManager = new MCPServerManager();
    }

    // Initialize Augment Context Engine if enabled
    if (getConfig().augment.enabled) {
      this.initializeAugmentContextEngine();
    }

    this.setupPlugins();
    this.setupRoutes();
  }

  /**
   * Initialize the Augment Context Engine
   */
  private initializeAugmentContextEngine(): void {
    if (this.augmentInitialized) {
      return;
    }

    try {
      // Initialize the Augment Context Engine
      augmentEngine.initialize();
      this.augmentInitialized = true;
      logger.info('Augment Context Engine initialized');
    } catch (error) {
      logger.error('Failed to initialize Augment Context Engine:', error);
    }
  }

  /**
   * Set up Fastify plugins
   */
  private setupPlugins() {
    // Register plugins
    this.server.register(fastifyCors, {
      origin: true, // Allow all origins
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
      credentials: true,
      maxAge: 86400, // 24 hours
    });

    // Register sensible plugin for better error handling
    this.server.register(fastifySensible);

    // Register OpenTelemetry plugin
    this.server.register(otelPlugin);

    // Set up error handler
    this.server.setErrorHandler((error, request, reply) => {
      logger.error('Server error:', error);
      reply.status(500).send({
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    });
  }

  /**
   * Set up routes
   */
  private setupRoutes() {
    // Register WebSocket routes for real-time communication
    if (this.config.gatewayEnabled) {
      registerWebSocketRoutes(this.server);
      logger.info('WebSocket routes registered for gateway');
    }


    // Health check endpoint
    this.server.get('/health', async (request, reply) => {
      return { status: 'ok' };
    });

    // API version endpoint
    this.server.get('/api/version', async (request, reply) => {
      return { version: '1.0.0' };
    });

    // Register tracing routes for the gateway
    if (this.config.gatewayEnabled) {
      this.registerTracingRoutes();
    }

    // Register SSE management routes
    this.registerSSERoutes();

    // Mount the proxy routes API
    this.registerProxyRoutesAPI();

    // Set up MCP routes if enabled
    if (this.config.mcpEnabled) {
      this.setupMCPRoutes();
    }

    // Serve static assets from the webview-ui/dist directory
    // Check multiple possible paths for the webview-ui/dist directory
    const possiblePaths = [
      path.resolve(__dirname, '..', 'webview-ui', 'dist'),          // For direct server execution
      path.resolve(__dirname, '..', '..', '..', 'webview-ui', 'dist'), // For VS Code extension
      path.resolve(__dirname, '..', '..', 'webview-ui', 'dist')      // Another possible path
    ];

    // Find the first path that exists
    let webviewDistPath = '';
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        webviewDistPath = possiblePath;
        logger.info(`Found webview-ui dist at: ${webviewDistPath}`);
        break;
      }
    }

    if (!webviewDistPath) {
      logger.error('Could not find webview-ui dist directory. Checked paths:');
      possiblePaths.forEach(p => logger.error(` - ${p}`));
      webviewDistPath = path.resolve(__dirname, '..', '..', '..', 'webview-ui', 'dist'); // Default path
    }

    // Check if the webview-ui/dist directory exists
    if (fs.existsSync(webviewDistPath)) {
      logger.info(`Serving gateway from ${webviewDistPath}`);

      // Register static file plugin
      this.server.register(fastifyStatic, {
        root: webviewDistPath,
        prefix: '/',
        decorateReply: false, // Don't decorate reply with sendFile
        index: false, // Disable automatic serving of index.html
        list: false, // Disable directory listing
        wildcard: false, // Disable wildcard serving
        serve: true, // Enable serving files
        cacheControl: true, // Enable cache control
        maxAge: 86400000, // 1 day in milliseconds
        lastModified: true, // Enable last modified headers
        etag: true, // Enable etag headers
      });

      // Log the static file plugin configuration
      logger.info('Static file plugin registered with configuration:');
      logger.info(` - Root: ${webviewDistPath}`);
      logger.info(` - Prefix: /`);
      logger.info(` - Index: false (handled manually)`);

      // Register another static file plugin specifically for assets
      this.server.register(fastifyStatic, {
        root: path.join(webviewDistPath, 'assets'),
        prefix: '/assets/',
        decorateReply: false,
        index: false,
      });
      logger.info(`Assets directory registered at: ${path.join(webviewDistPath, 'assets')}`);

      // List the assets directory if it exists
      const assetsPath = path.join(webviewDistPath, 'assets');
      if (fs.existsSync(assetsPath)) {
        const assetFiles = fs.readdirSync(assetsPath);
        logger.info(`Assets files: ${assetFiles.join(', ')}`);
      } else {
        logger.warn(`Assets directory not found at: ${assetsPath}`);
      }

      // Serve the gateway at the root path
      this.server.get('/', async (request, reply) => {
        try {
          const indexPath = path.join(webviewDistPath, 'index.html');
          logger.info(`Attempting to serve index.html from: ${indexPath}`);

          if (fs.existsSync(indexPath)) {
            logger.info('index.html found, serving content');
            const content = fs.readFileSync(indexPath, 'utf-8');
            reply.type('text/html').send(content);
          } else {
            logger.error(`index.html not found at ${indexPath}`);
            // List directory contents to help debug
            if (fs.existsSync(webviewDistPath)) {
              const files = fs.readdirSync(webviewDistPath);
              logger.info(`Files in ${webviewDistPath}: ${files.join(', ')}`);
            }
            reply.status(404).send('Gateway index.html not found');
          }
        } catch (error) {
          logger.error(`Failed to serve gateway: ${error}`);
          reply.status(500).send('Failed to load gateway. Make sure webview-ui is built.');
        }
      });

      // Catch-all route for SPA - must be last after all other routes
      // This ensures that client-side routing works for the gateway
      this.server.setNotFoundHandler((request, reply) => {
        logger.info(`Not found handler for: ${request.url}`);

        // Skip API routes and other special paths
        const url = new URL(request.url, 'http://localhost');
        if (url.pathname.startsWith('/api/') ||
            url.pathname.startsWith('/proxy/') ||
            url.pathname === '/health' ||
            url.pathname.startsWith('/assets/') ||
            url.pathname.startsWith('/ws')) {
          logger.info(`Skipping SPA handling for API route: ${url.pathname}`);
          reply.status(404).send({ error: 'Not found' });
          return;
        }

        // Serve the index.html for client-side routing
        try {
          const indexPath = path.join(webviewDistPath, 'index.html');
          logger.info(`Attempting to serve SPA index.html from: ${indexPath} for route: ${url.pathname}`);

          if (fs.existsSync(indexPath)) {
            logger.info(`SPA index.html found, serving for route: ${url.pathname}`);
            const content = fs.readFileSync(indexPath, 'utf-8');
            reply.type('text/html').send(content);
          } else {
            logger.error(`SPA index.html not found at ${indexPath}`);
            reply.status(404).send('Gateway index.html not found');
          }
        } catch (error) {
          logger.error(`Failed to serve gateway for route ${request.url}:`, error);
          reply.status(500).send('Failed to load gateway');
        }
      });
    }

    // Set up the generic proxy endpoint for all custom routes
    this.setupProxyRoutes();
  }

  /**
   * Set up the generic proxy endpoint for all custom routes
   */
  private setupProxyRoutes() {
    // Get all proxy routes
    const routes = Object.values(getProxyRoutes());

    for (const route of routes) {
      const prefix = `/proxy/${route.path}`;
      const upstream = route.target;

      logger.info(`Registering proxy route: ${prefix} -> ${upstream}`);

      // Register a proxy for this route
      this.server.register(fastifyHttpProxy, {
        upstream,
        prefix,
        rewritePrefix: '',
        http2: false,
        replyOptions: {
          rewriteRequestHeaders: (req, headers) => {
            return {
              ...headers,
              'X-Forwarded-Host': req.headers.host || '',
              'X-Forwarded-For': req.headers['x-forwarded-for'] || ''
            };
          }
        }
      });
    }

    // Catch-all for proxy routes that don't match any registered route
    this.server.all('/proxy/*', async (request, reply) => {
      const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
      const requestPath = url.pathname.replace('/proxy/', '');

      logger.info(`No matching proxy route found for: ${requestPath}`);
      return reply.status(404).send({ error: 'No matching proxy route found' });
    });
  }

  /**
   * Register the proxy routes API
   */
  private registerProxyRoutesAPI() {
    // Register proxy routes API
    this.server.register(registerProxyRoutesAPI);
  }

  /**
   * Register tracing routes for the gateway
   */
  private registerTracingRoutes() {
    // Tracing routes are registered in the OpenTelemetry plugin
  }

  /**
   * Register SSE management routes
   */
  private registerSSERoutes() {
    // Register SSE plugin
    this.server.register(ssePlugin);
  }

  /**
   * Set up MCP routes
   */
  private setupMCPRoutes() {
    if (!this.mcpManager) {
      logger.info('MCP server is disabled, skipping route registration');
      return;
    }

    // We'll implement this later
  }



  /**
   * Start the server
   */
  public async start(): Promise<void> {
    try {
      await this.server.listen({
        port: this.config.port,
        host: this.config.host
      });
      logger.info(`Fastify proxy server is running on http://${this.config.host}:${this.config.port}`);
      logger.info(`Gateway is ${this.config.gatewayEnabled ? 'enabled' : 'disabled'}`);

      // If MCP is enabled, log that it's available on the same server
      if (this.config.mcpEnabled) {
        logger.info(`MCP server is available at http://${this.config.host}:${this.config.port}/mcp`);
      }
    } catch (error) {
      logger.error('Failed to start Fastify proxy server:', error);
      throw error;
    }
  }

  /**
   * Stop the server
   */
  public async stop(): Promise<void> {
    try {
      await this.server.close();
      logger.info('Fastify proxy server stopped');
    } catch (error) {
      logger.error('Failed to stop Fastify proxy server:', error);
      throw error;
    }
  }

  /**
   * Get the Fastify server instance
   */
  public getServer(): FastifyInstance {
    return this.server;
  }
}
