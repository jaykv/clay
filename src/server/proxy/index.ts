// Re-export from fastify-index.ts
import { startServer, stopServer } from './fastify-index';

// Export for backward compatibility
export { startServer, stopServer };

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
