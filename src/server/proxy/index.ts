import { serve } from '@hono/node-server';
import { ProxyServer } from './server';
import { logger } from '../utils/logger';
import { getConfig } from '../utils/config';

// Store server instance for stopping later
let serverInstance: ReturnType<typeof serve> | null = null;

/**
 * Start the proxy server
 * @returns The server instance
 */
export function startServer() {
  if (serverInstance) {
    logger.info('Proxy server is already running');
    return serverInstance;
  }

  try {
    const config = getConfig().proxy;
    const server = new ProxyServer();
    const app = server.getApp();

    logger.info(`Starting proxy server on http://${config.host}:${config.port}`);

    serverInstance = serve({
      fetch: app.fetch,
      port: config.port,
      hostname: config.host
    });

    logger.info(`Proxy server is running on http://${config.host}:${config.port}`);
    logger.info(`Dashboard is ${config.dashboardEnabled ? 'enabled' : 'disabled'}`);

    // If MCP is enabled, log that it's available on the same server
    if (config.mcpEnabled) {
      logger.info(`MCP server is available at http://${config.host}:${config.port}/mcp`);
    }

    return serverInstance;
  } catch (error) {
    logger.error('Failed to start proxy server:', error);
    throw error;
  }
}

/**
 * Stop the proxy server
 */
export function stopServer() {
  if (!serverInstance) {
    logger.info('Proxy server is not running');
    return;
  }

  try {
    logger.info('Shutting down proxy server...');
    serverInstance.close();
    serverInstance = null;
    logger.info('Proxy server stopped');
  } catch (error) {
    logger.error('Failed to stop proxy server:', error);
    throw error;
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  startServer();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    stopServer();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    stopServer();
    process.exit(0);
  });
}
