import { FastifyGatewayServer } from './fastify-server';
import { logger } from '../utils/logger';
import { getConfig } from '../utils/config';
import { killProcessByPort, isGatewayServer } from '../utils/port';
import { gatewayServerInstance, setGatewayServerInstance } from '../utils/server-context';

/**
 * Start the Fastify gateway server
 * @returns The server instance
 */
export async function startServer() {
  if (gatewayServerInstance) {
    logger.info('Fastify gateway server is already running');
    return gatewayServerInstance;
  }

  try {
    const config = getConfig().gateway;

    // Check if the port is in use
    const isRunning = await isGatewayServer(config.port, config.host);
    if (isRunning) {
      logger.warn(
        `Port ${config.port} is already in use. Attempting to stop any existing server...`
      );

      // Try to stop any existing server
      try {
        // Try to kill the process using the port, but only if it's a Gateway server
        const killed = await killProcessByPort(config.port, config.host, 'gateway', false);

        if (killed) {
          logger.info(`Successfully killed Gateway server process using port ${config.port}`);
        } else {
          logger.warn(`Failed to kill process using port ${config.port}`);
        }
      } catch (error) {
        logger.error('Failed to stop existing server:', error);
        throw new Error(
          `Port ${config.port} is in use and could not be freed. Please stop any running Gateway server manually.`
        );
      }
    }

    const newServer = new FastifyGatewayServer();

    logger.info(`Starting Fastify gateway server on http://${config.host}:${config.port}`);
    await newServer.start();

    // Set the global reference
    setGatewayServerInstance(newServer);

    logger.info(`Fastify gateway server is running on http://${config.host}:${config.port}`);
    logger.info(`Proxy is ${config.proxyEnabled ? 'enabled' : 'disabled'}`);

    return newServer;
  } catch (error) {
    logger.error('Failed to start Fastify gateway server:', error);
    throw error;
  }
}

/**
 * Stop the Fastify gateway server
 */
export async function stopServer(force: boolean = false) {
  if (gatewayServerInstance) {
    try {
      await gatewayServerInstance.stop();
      // Clear the global reference
      setGatewayServerInstance(null);
      logger.info('Fastify gateway server stopped');
      return;
    } catch (error) {
      logger.error('Failed to stop Fastify gateway server:', error);
      throw error;
    }
  }

  // If force is true, try to kill any process on the port
  if (force) {
    const config = getConfig().gateway;
    const isRunning = await isGatewayServer(config.port, config.host);

    if (isRunning) {
      logger.warn(
        `Port ${config.port} is in use but no server instance found. This may be a zombie process.`
      );

      // Try to kill the process using the port, but only if it's a Gateway server
      const killed = await killProcessByPort(config.port, config.host, 'gateway', true);

      if (killed) {
        logger.info(`Successfully killed Gateway server process using port ${config.port}`);
        // Always ensure global reference is cleared when killing a process
        setGatewayServerInstance(null);
      } else {
        logger.warn(`Failed to kill process using port ${config.port}`);
      }
    } else {
      logger.info(`No server running on port ${config.port}`);
    }
  } else {
    logger.info('No Gateway server instance to stop');
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  startServer();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await stopServer();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await stopServer();
    process.exit(0);
  });
}
