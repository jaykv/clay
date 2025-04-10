import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { logger } from '../../utils/logger';
import { registerAugmentMCPTools } from './tools';
import { registerAugmentMCPResources } from './resources';

/**
 * Register all Augment Context Engine MCP components
 * @param server The MCP server
 */
export function registerAugmentMCP(server: McpServer): void {
  logger.info('Registering Augment Context Engine with MCP server');
  
  // Register tools
  registerAugmentMCPTools(server);
  
  // Register resources
  registerAugmentMCPResources(server);
  
  logger.info('Augment Context Engine registered with MCP server');
}
