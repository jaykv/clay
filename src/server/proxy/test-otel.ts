import { startServer, stopServer } from './fastify-index';
import { logger } from '../utils/logger';
import { LogLevel } from '../utils/logger';

// Set logger level to debug for testing
logger.setLevel(LogLevel.DEBUG);

// Start the server
logger.info('Starting Fastify proxy server with OpenTelemetry for testing...');
const server = startServer();

// Handle process termination
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down...');
  stopServer();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down...');
  stopServer();
  process.exit(0);
});

logger.info('Fastify proxy server with OpenTelemetry test running. Press Ctrl+C to stop.');
