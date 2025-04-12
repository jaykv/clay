import {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';
import { MCPServerManager } from './server';
import { logger } from '../utils/logger';
import { getConfig } from '../utils/config';

// Store server instance for stopping later
let mcpManager: MCPServerManager | null = null;

export function registerMCPRoutes(fastify: FastifyInstance) {
  try {
    const config = getConfig().mcp;
    mcpManager = new MCPServerManager();

    // SSE endpoint for MCP connections
    fastify.get('/mcp/sse', (_: FastifyRequest, res: FastifyReply) => {
      (async () => {
      
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
    fastify.post('/mcp/messages', (req: FastifyRequest, res: FastifyReply) => { // Remove route config object
      (async () => {
        const sessionId = (req.query as { sessionId?: string }).sessionId;
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


  } catch (error) {
    logger.error('Failed to start MCP server:', error);
    throw error;
  }
}
