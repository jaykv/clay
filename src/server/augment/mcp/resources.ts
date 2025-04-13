import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { logger } from '../../utils/logger';
import { augmentEngine } from '../index';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Register Augment Context Engine resources with the MCP server
 * @param server The MCP server
 */
export function registerAugmentMCPResources(server: McpServer): void {
  // Add codebase file resource
  server.resource(
    'codebase-file',
    new ResourceTemplate('codebase://{filePath}', { list: undefined }),
    async (uri, variables) => {
      const filePath = variables.filePath as string;
      logger.info(`MCP resource codebase-file requested for filePath: ${filePath}`);

      try {
        // Ensure the engine is initialized
        if (!augmentEngine.isInitialized()) {
          await augmentEngine.initialize();
        }

        // Get the file
        const file = augmentEngine.getFile(filePath);

        if (!file) {
          throw new Error(`File not found: ${filePath}`);
        }

        return {
          contents: [
            {
              uri: uri.href,
              text: file.content,
            },
          ],
        };
      } catch (error) {
        logger.error('Error in codebase-file resource:', error);
        throw error;
      }
    }
  );

  // Add codebase search resource
  server.resource(
    'codebase-search',
    new ResourceTemplate('codebase-search://{query}', { list: undefined }),
    async (uri, variables) => {
      const query = variables.query as string;
      logger.info(`MCP resource codebase-search requested for query: ${query}`);

      try {
        // Ensure the engine is initialized
        if (!augmentEngine.isInitialized()) {
          await augmentEngine.initialize();
        }

        // Search the codebase
        const results = await augmentEngine.searchCode(query);

        // Format the results
        const formattedResults = formatSearchResults(results);

        return {
          contents: [
            {
              uri: uri.href,
              text: formattedResults,
            },
          ],
        };
      } catch (error) {
        logger.error('Error in codebase-search resource:', error);
        throw error;
      }
    }
  );

  // Add codebase status resource
  server.resource('codebase-status', 'codebase-status://current', async uri => {
    logger.info('MCP resource codebase-status requested');

    try {
      // Ensure the engine is initialized
      if (!augmentEngine.isInitialized()) {
        await augmentEngine.initialize();
      }

      // Get the index status
      const status = augmentEngine.getIndexStatus();

      // Format the status
      const formattedStatus = formatIndexStatus(status);

      return {
        contents: [
          {
            uri: uri.href,
            text: formattedStatus,
          },
        ],
      };
    } catch (error) {
      logger.error('Error in codebase-status resource:', error);
      throw error;
    }
  });
}

/**
 * Format search results as a string
 * @param results The search results
 * @returns The formatted results
 */
function formatSearchResults(results: any[]): string {
  if (results.length === 0) {
    return 'No results found.';
  }

  let output = `Found ${results.length} results:\n\n`;

  results.forEach((result, index) => {
    output += `Result ${index + 1} (Score: ${result.relevanceScore}):\n`;

    // Add snippets
    result.snippets.forEach((snippet: any) => {
      output += `\nFile: ${snippet.filePath} (Lines ${snippet.startLine}-${snippet.endLine})\n`;
      output += '```' + snippet.language + '\n';
      output += snippet.content + '\n';
      output += '```\n';
    });

    // Add symbols if available
    if (result.symbols && result.symbols.length > 0) {
      output += '\nSymbols:\n';

      result.symbols.forEach((symbol: any) => {
        output += `- ${symbol.type} \`${symbol.name}\` (${symbol.filePath}:${symbol.startLine})\n`;
      });
    }

    output += '\n---\n\n';
  });

  return output;
}

/**
 * Format index status as a string
 * @param status The index status
 * @returns The formatted status
 */
function formatIndexStatus(status: any): string {
  let output = 'Augment Context Engine Index Status:\n\n';

  output += `Root Directory: ${status.rootDirectory}\n`;
  output += `Total Files: ${status.totalFiles}\n`;
  output += `Total Symbols: ${status.totalSymbols}\n`;
  output += `Last Updated: ${new Date(status.lastUpdated).toLocaleString()}\n`;
  output += `Currently Indexing: ${status.isIndexing ? 'Yes' : 'No'}\n`;

  return output;
}
