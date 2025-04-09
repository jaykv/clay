import express, { Request, Response } from 'express';
import { Server } from 'http';
import { MCPServerManager } from './server';
import { logger } from '../utils/logger';
import { getConfig } from '../utils/config';

// Store server instance for stopping later
let serverInstance: Server | null = null;
let mcpManager: MCPServerManager | null = null;

/**
 * Start the MCP server
 * @returns The server instance
 */
export function startServer() {
  if (serverInstance) {
    logger.info('MCP server is already running');
    return serverInstance;
  }

  try {
    const config = getConfig().mcp;
    mcpManager = new MCPServerManager();
    const app = express();

    // Parse JSON bodies
    app.use(express.json());

    // Health check endpoint
    app.get('/health', (_: Request, res: Response) => {
      res.json({ status: 'ok' });
    });

    // SSE endpoint for MCP connections
    app.get('/mcp/sse', (_: Request, res: Response) => {
      (async () => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        if (mcpManager) {
          await mcpManager.handleSSEConnection(res, '/mcp/messages');
        } else {
          res.status(500).send('MCP server not initialized');
        }
      })().catch(error => {
        logger.error('Error handling SSE connection:', error);
        res.status(500).send('Internal server error');
      });
    });

    // Message endpoint for MCP clients to send messages
    app.post('/mcp/messages', (req: Request, res: Response) => {
      (async () => {
        const sessionId = req.query.sessionId as string;
        if (!sessionId) {
          return res.status(400).send('Missing sessionId parameter');
        }

        if (mcpManager) {
          await mcpManager.handlePostMessage(req, res, sessionId);
        } else {
          res.status(500).send('MCP server not initialized');
        }
      })().catch(error => {
        logger.error('Error handling MCP message:', error);
        res.status(500).send('Internal server error');
      });
    });

    // Start the server
    serverInstance = app.listen(config.port, config.host, () => {
      logger.info(`MCP server is running on http://${config.host}:${config.port}`);
    });

    return serverInstance;
  } catch (error) {
    logger.error('Failed to start MCP server:', error);
    throw error;
  }
}

/**
 * Stop the MCP server
 */
export function stopServer() {
  if (!serverInstance) {
    logger.info('MCP server is not running');
    return;
  }

  try {
    logger.info('Shutting down MCP server...');
    serverInstance.close();
    serverInstance = null;
    mcpManager = null;
    logger.info('MCP server stopped');
  } catch (error) {
    logger.error('Failed to stop MCP server:', error);
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
