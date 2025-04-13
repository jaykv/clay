import * as vscode from 'vscode';

/**
 * Global variables for the Clay extension
 * This file centralizes all global state to avoid circular dependencies
 * and ensure consistent access to shared resources across the codebase.
 */

// Server instances
export let gatewayServerInstance: any = null;
export let mcpServerInstance: any = null;
export let registryServerInstance: any = null;

// Event emitter for immediate server status updates (primarily for start events)
// This provides faster UI updates than waiting for health checks
export const serverStatusEmitter = new vscode.EventEmitter<{
  type: 'gateway' | 'mcp' | 'registry';
  status: 'started' | 'stopped';
}>();

/**
 * Set the gateway server instance
 * @param instance The gateway server instance
 */
export function setGatewayServerInstance(instance: any): void {
  gatewayServerInstance = instance;
}

/**
 * Set the MCP server instance
 * @param instance The MCP server instance
 */
export function setMCPServerInstance(instance: any): void {
  mcpServerInstance = instance;
}

/**
 * Set the registry server instance
 * @param instance The registry server instance
 */
export function setRegistryServerInstance(instance: any): void {
  registryServerInstance = instance;
}
