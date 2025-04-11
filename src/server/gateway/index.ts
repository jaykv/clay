import { FastifyGatewayServer } from './fastify-server';
import { logger } from '../utils/logger';
import { getConfig } from '../utils/config';

// Store server instance for stopping later
let serverInstance: FastifyGatewayServer | null = null;

/**
 * Start the Fastify gateway server
 * @returns The server instance
 */
export function startServer() {
  if (serverInstance) {
    logger.info('Fastify gateway server is already running');
    return serverInstance;
  }

  try {
    const config = getConfig().gateway;
    serverInstance = new FastifyGatewayServer();

    logger.info(`Starting Fastify gateway server on http://${config.host}:${config.port}`);
    serverInstance.start();

    logger.info(`Fastify gateway server is running on http://${config.host}:${config.port}`);
    logger.info(`Proxy is ${config.proxyEnabled ? 'enabled' : 'disabled'}`);

    // If MCP is enabled, log that it's available on the same server
    if (config.mcpEnabled) {
      logger.info(`MCP server is available at http://${config.host}:${config.port}/mcp`);
    }

    return serverInstance;
  } catch (error) {
    logger.error('Failed to start Fastify gateway server:', error);
    throw error;
  }
}

/**
 * Stop the Fastify gateway server
 */
export function stopServer() {
  if (!serverInstance) {
    logger.info('Fastify gateway server is not running');
    return;
  }

  try {
    serverInstance.stop();
    serverInstance = null;
    logger.info('Fastify gateway server stopped');
  } catch (error) {
    logger.error('Failed to stop Fastify gateway server:', error);
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