import { MCPServerLoader } from '../servers/loader';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { logger } from '../../utils/logger';
import { MCPToolInfo, MCPResourceInfo, MCPPromptInfo } from '../express-server';

// Keep track of the loader instance
let serverLoader: MCPServerLoader | null = null;

/**
 * Initialize the MCP server loader
 * @param server The MCP server
 * @param workspaceRoot The workspace root path
 */
export async function initializeMCPServers(
  server: McpServer,
  workspaceRoot: string
): Promise<void> {
  try {
    // Create the loader
    serverLoader = new MCPServerLoader(server, workspaceRoot);

    // Load servers
    await serverLoader.loadServers();
  } catch (error) {
    logger.error('Failed to initialize MCP servers:', error);
  }
}

/**
 * Get the loaded tools
 */
export function getLoadedTools(): MCPToolInfo[] {
  return serverLoader ? serverLoader.getLoadedTools() : [];
}

/**
 * Get the loaded resources
 */
export function getLoadedResources(): MCPResourceInfo[] {
  return serverLoader ? serverLoader.getLoadedResources() : [];
}

/**
 * Get the loaded prompts
 */
export function getLoadedPrompts(): MCPPromptInfo[] {
  return serverLoader ? serverLoader.getLoadedPrompts() : [];
}

/**
 * Cleanup MCP servers
 */
export async function cleanupMCPServers(): Promise<void> {
  if (serverLoader) {
    await serverLoader.cleanup();
    serverLoader = null;
  }
}
