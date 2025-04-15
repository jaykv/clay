import { MCPExtensionsLoader } from './loader';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { logger } from '../../utils/logger';
import { MCPToolInfo, MCPResourceInfo, MCPPromptInfo } from '../express-server';

// Keep track of the loader instance
let extensionsLoader: MCPExtensionsLoader | null = null;

/**
 * Initialize the MCP extensions loader
 * @param server The MCP server
 * @param workspaceRoot The workspace root path
 */
export async function initializeMCPExtensions(
  server: McpServer,
  workspaceRoot: string
): Promise<void> {
  try {
    // Create the loader
    extensionsLoader = new MCPExtensionsLoader(server, workspaceRoot);
    
    // Load extensions
    await extensionsLoader.loadExtensions();
  } catch (error) {
    logger.error('Failed to initialize MCP extensions:', error);
  }
}

/**
 * Get the loaded tools
 */
export function getLoadedTools(): MCPToolInfo[] {
  return extensionsLoader ? extensionsLoader.getLoadedTools() : [];
}

/**
 * Get the loaded resources
 */
export function getLoadedResources(): MCPResourceInfo[] {
  return extensionsLoader ? extensionsLoader.getLoadedResources() : [];
}

/**
 * Get the loaded prompts
 */
export function getLoadedPrompts(): MCPPromptInfo[] {
  return extensionsLoader ? extensionsLoader.getLoadedPrompts() : [];
}
