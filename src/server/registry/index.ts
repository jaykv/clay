import { serve } from '@hono/node-server';
import { RegistryServer } from './server';
import { logger } from '../utils/logger';
import { getConfig } from '../utils/config';

async function startServer() {
  try {
    const config = getConfig().registry;
    const server = new RegistryServer();
    const app = server.getApp();
    
    logger.info(`Starting registry server on http://${config.host}:${config.port}`);
    
    serve({
      fetch: app.fetch,
      port: config.port,
      hostname: config.host
    });
    
    logger.info(`Registry server is running on http://${config.host}:${config.port}`);
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      logger.info('Shutting down registry server...');
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      logger.info('Shutting down registry server...');
      process.exit(0);
    });
  } catch (error) {
    logger.error('Failed to start registry server:', error);
    process.exit(1);
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  startServer();
}

export { startServer };
