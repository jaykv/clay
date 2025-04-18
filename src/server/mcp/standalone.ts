#!/usr/bin/env node

import { ExpressMCPServer } from './express-server';
import { logger } from '../utils/logger';
import { getConfig } from '../utils/config';
import { isMCPServer, killProcessByPort } from '../utils/port';
import { mcpServerInstance, setMCPServerInstance } from '../utils/server-context';

/**
 * Start the MCP server
 */
export async function startMCPServer(): Promise<ExpressMCPServer> {
  try {
    const config = getConfig().mcp;

    // Check if the server instance exists
    if (mcpServerInstance) {
      logger.info('MCP server instance already exists');
      return mcpServerInstance;
    }

    // Check if the port is in use
    const isRunning = await isMCPServer(config.port, config.host);
    if (isRunning) {
      logger.warn(
        `Port ${config.port} is already in use. Attempting to stop any existing server...`
      );

      // Try to stop any existing server
      try {
        await stopMCPServer(true);
      } catch (error) {
        logger.error('Failed to stop existing server:', error);
        throw new Error(
          `Port ${config.port} is in use and could not be freed. Please stop any running MCP server manually.`
        );
      }
    }

    // Create and start a new server
    const newServer = new ExpressMCPServer();
    await newServer.start();

    // Set the global reference
    setMCPServerInstance(newServer);

    logger.info(`MCP server is running on http://${config.host}:${config.port}`);

    return newServer;
  } catch (error) {
    logger.error('Failed to start MCP server:', error);
    throw error;
  }
}

/**
 * Stop the MCP server
 */
export async function stopMCPServer(force: boolean = false): Promise<void> {
  try {
    const config = getConfig().mcp;

    // If we have a server instance, try to stop it
    if (mcpServerInstance !== null) {
      logger.info('Stopping MCP server instance...');
      await mcpServerInstance.stop();
      // Clear the global reference
      setMCPServerInstance(null);
      logger.info('MCP server instance stopped');
      return;
    }

    // If force is true, try to kill any process on the port
    if (force) {
      const isRunning = await isMCPServer(config.port, config.host);
      if (isRunning) {
        logger.warn(
          `Port ${config.port} is in use but no server instance found. This may be a zombie process.`
        );

        // Try to kill the process using the port, but only if it's an MCP server
        const killed = await killProcessByPort(config.port, config.host, 'mcp', false);

        if (killed) {
          logger.info(`Successfully killed MCP server process using port ${config.port}`);
          // Always ensure global reference is cleared when killing a process
          setMCPServerInstance(null);
        } else {
          logger.warn(`Failed to kill process using port ${config.port}`);
        }
      } else {
        logger.info(`No server running on port ${config.port}`);
      }
    } else {
      logger.info('No MCP server instance to stop');
    }
  } catch (error) {
    logger.error('Failed to stop MCP server:', error);
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
