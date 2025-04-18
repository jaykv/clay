/**
 * Server context module
 * This provides a local alternative to globals.ts for server-specific state
 * without creating dependencies on the extension code
 */

// Server instances (local to server code)
export let gatewayServerInstance: any = null;
export let mcpServerInstance: any = null;
export let registryServerInstance: any = null;

// Workspace root path (defaults to current working directory)
export let workspaceRootPath: string = process.cwd();

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
