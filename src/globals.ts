/**
 * Global variables for the Clay extension
 * This file centralizes all global state to avoid circular dependencies
 * and ensure consistent access to shared resources across the codebase.
 */

// Determine if we're running in VS Code extension context
const isVSCodeExtension = typeof process !== 'undefined' && process.env.VSCODE_PID !== undefined;

// Conditionally import VS Code API
let vscode: any;
if (isVSCodeExtension) {
  try {
    vscode = require('vscode');
  } catch (error) {
    console.warn('VS Code API not available');
  }
}

// Server instances
export let gatewayServerInstance: any = null;
export let mcpServerInstance: any = null;
export let registryServerInstance: any = null;

// Workspace root path
export let workspaceRootPath: string = process.cwd();

// Define the event type for server status updates
export type ServerStatusEvent = {
  type: 'gateway' | 'mcp' | 'registry';
  status: 'started' | 'stopped';
};

// Define a minimal EventEmitter interface that matches what we need
export interface MinimalEventEmitter<T> {
  event: (listener: (e: T) => any) => { dispose: () => void };
  fire: (data: T) => void;
}

// Event emitter for immediate server status updates (primarily for start events)
// This provides faster UI updates than waiting for health checks
export const serverStatusEmitter: MinimalEventEmitter<ServerStatusEvent> =
  isVSCodeExtension && vscode
    ? // Use VS Code's EventEmitter when in extension context
      // @ts-ignore - vscode is dynamically imported
      new vscode.EventEmitter()
    : // Fallback for non-VS Code environments with compatible interface
      {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        event: (_listener: (e: ServerStatusEvent) => any) => ({ dispose: () => {} }),
        fire: () => {},
      };

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

/**
 * Set the workspace root path
 * @param path The workspace root path
 */
export function setWorkspaceRootPath(path: string): void {
  workspaceRootPath = path;
}
