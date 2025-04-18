/**
 * Server Bridge Module
 * 
 * This module provides a bridge between the extension and server code,
 * allowing the extension to interact with server instances without
 * creating circular dependencies.
 */

import { logger } from './logger';
import * as serverContext from './server-context';

/**
 * Initialize the server context with the workspace root path
 * @param workspaceRoot The workspace root path
 */
export function initializeServerContext(workspaceRoot: string): void {
  logger.info(`Initializing server context with workspace root: ${workspaceRoot}`);
  serverContext.setWorkspaceRootPath(workspaceRoot);
}

/**
 * Get the MCP server instance
 * @returns The MCP server instance or null if not running
 */
export function getMCPServerInstance(): any {
  return serverContext.mcpServerInstance;
}

/**
 * Set the MCP server instance
 * @param instance The MCP server instance
 */
export function setMCPServerInstance(instance: any): void {
  serverContext.setMCPServerInstance(instance);
}

/**
 * Get the Gateway server instance
 * @returns The Gateway server instance or null if not running
 */
export function getGatewayServerInstance(): any {
  return serverContext.gatewayServerInstance;
}

/**
 * Set the Gateway server instance
 * @param instance The Gateway server instance
 */
export function setGatewayServerInstance(instance: any): void {
  serverContext.setGatewayServerInstance(instance);
}

/**
 * Get the Registry server instance
 * @returns The Registry server instance or null if not running
 */
export function getRegistryServerInstance(): any {
  return serverContext.registryServerInstance;
}

/**
 * Set the Registry server instance
 * @param instance The Registry server instance
 */
export function setRegistryServerInstance(instance: any): void {
  serverContext.setRegistryServerInstance(instance);
}
