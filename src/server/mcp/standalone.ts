#!/usr/bin/env node

import { ExpressMCPServer } from './express-server';
import { logger } from '../utils/logger';
import { getConfig } from '../utils/config';

// Store server instance for stopping later
let mcpServer: ExpressMCPServer | null = null;

/**
 * Start the MCP server
 */
export async function startMCPServer(): Promise<ExpressMCPServer> {
  try {
    const config = getConfig().mcp;
    
    if (mcpServer) {
      logger.info('MCP server is already running');
      return mcpServer;
    }
    
    mcpServer = new ExpressMCPServer();
    await mcpServer.start();
    
    logger.info(`MCP server is running on http://${config.host}:${config.port}`);
    
    return mcpServer;
  } catch (error) {
    logger.error('Failed to start MCP server:', error);
    throw error;
  }
}

/**
 * Main entry point when running as a standalone server
 */
if (require.main === module) {
  startMCPServer().catch(error => {
    logger.error('Failed to start MCP server:', error);
    process.exit(1);
  });
  
  // Handle process termination
  process.on('SIGINT', () => {
    logger.info('Received SIGINT signal, shutting down MCP server');
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM signal, shutting down MCP server');
    process.exit(0);
  });
}

export default startMCPServer;
