import { z } from 'zod';
import { logger } from '../../utils/logger';
import { augmentEngine } from '../index';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CodeSymbol } from '../models';

/**
 * Register Augment Context Engine tools with the MCP server
 * @param server The MCP server
 */
export function registerAugmentMCPTools(server: McpServer): void {
  // Add codebase search tool
  server.tool(
    'codebase-search',
    {
      query: z.string().describe('The search query'),
      maxResults: z.number().optional().describe('The maximum number of results to return'),
    },
    async ({ query, maxResults = 10 }) => {
      logger.info(`MCP tool codebase-search called with query: ${query}`);

      try {
        // Ensure the engine is initialized
        if (!augmentEngine.isInitialized()) {
          await augmentEngine.initialize();
        }

        // Search the codebase
        const results = await augmentEngine.searchCode(query, maxResults);

        // Format the results
        const formattedResults = formatSearchResults(results);

        return {
          content: [{ type: 'text', text: formattedResults }],
        };
      } catch (error) {
        logger.error('Error in codebase-search tool:', error);
        return {
          content: [{ type: 'text', text: `Error searching codebase: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // Add get-file tool
  server.tool(
    'codebase-get-file',
    {
      filePath: z.string().describe('The path to the file'),
    },
    async ({ filePath }) => {
      logger.info(`MCP tool codebase-get-file called with filePath: ${filePath}`);

      try {
        // Ensure the engine is initialized
        if (!augmentEngine.isInitialized()) {
          await augmentEngine.initialize();
        }

        // Get the file
        const file = augmentEngine.getFile(filePath);

        if (!file) {
          return {
            content: [{ type: 'text', text: `File not found: ${filePath}` }],
            isError: true,
          };
        }

        return {
          content: [{ type: 'text', text: file.content }],
        };
      } catch (error) {
        logger.error('Error in codebase-get-file tool:', error);
        return {
          content: [{ type: 'text', text: `Error getting file: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // Add get-symbol tool
  server.tool(
    'codebase-get-symbol',
    {
      name: z.string().describe('The name of the symbol'),
      filePath: z.string().describe('The path to the file'),
    },
    async ({ name, filePath }) => {
      logger.info(`MCP tool codebase-get-symbol called with name: ${name}, filePath: ${filePath}`);

      try {
        // Ensure the engine is initialized
        if (!augmentEngine.isInitialized()) {
          await augmentEngine.initialize();
        }

        // Get the symbol
        const symbol = augmentEngine.getSymbol(name, filePath);

        if (!symbol) {
          return {
            content: [{ type: 'text', text: `Symbol not found: ${name} in ${filePath}` }],
            isError: true,
          };
        }

        // Format the symbol
        const formattedSymbol = formatSymbol(symbol);

        return {
          content: [{ type: 'text', text: formattedSymbol }],
        };
      } catch (error) {
        logger.error('Error in codebase-get-symbol tool:', error);
        return {
          content: [{ type: 'text', text: `Error getting symbol: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // Add index-status tool
  server.tool('codebase-index-status', {}, async () => {
    logger.info('MCP tool codebase-index-status called');

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
        content: [{ type: 'text', text: formattedStatus }],
      };
    } catch (error) {
      logger.error('Error in codebase-index-status tool:', error);
      return {
        content: [{ type: 'text', text: `Error getting index status: ${error}` }],
        isError: true,
      };
    }
  });

  // Add reindex tool
  server.tool('codebase-reindex', {}, async () => {
    logger.info('MCP tool codebase-reindex called');

    try {
      // Ensure the engine is initialized
      if (!augmentEngine.isInitialized()) {
        await augmentEngine.initialize();
      }

      // Reindex the codebase
      await augmentEngine.reindex();

      return {
        content: [{ type: 'text', text: 'Codebase reindexing completed successfully' }],
      };
    } catch (error) {
      logger.error('Error in codebase-reindex tool:', error);
      return {
        content: [{ type: 'text', text: `Error reindexing codebase: ${error}` }],
        isError: true,
      };
    }
  });

  // Add get-definition tool
  server.tool(
    'codebase-get-definition',
    {
      filePath: z.string().describe('The path to the file'),
      line: z.number().describe('The line number (1-based)'),
      character: z.number().describe('The character position'),
    },
    async ({ filePath, line, character }) => {
      logger.info(
        `MCP tool codebase-get-definition called with filePath: ${filePath}, line: ${line}, character: ${character}`
      );

      try {
        // Ensure the engine is initialized
        if (!augmentEngine.isInitialized()) {
          await augmentEngine.initialize();
        }

        // Try to use VS Code API if available
        if (augmentEngine.isUsingVSCodeAPI()) {
          const vscodeAPI = augmentEngine.getVSCodeAPI();
          if (vscodeAPI) {
            const definition = await vscodeAPI.getDefinition(filePath, line, character);

            if (!definition) {
              return {
                content: [
                  { type: 'text', text: `No definition found at ${filePath}:${line}:${character}` },
                ],
                isError: true,
              };
            }

            // Format the definition
            const formattedDefinition = formatSymbol(definition);

            return {
              content: [{ type: 'text', text: formattedDefinition }],
            };
          }
        }

        // If VS Code API is not available or failed
        return {
          content: [
            {
              type: 'text',
              text: 'Definition lookup is only available when running as a VS Code extension',
            },
          ],
          isError: true,
        };
      } catch (error) {
        logger.error('Error in codebase-get-definition tool:', error);
        return {
          content: [{ type: 'text', text: `Error getting definition: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // Add get-document-symbols tool
  server.tool(
    'codebase-get-document-symbols',
    {
      filePath: z.string().describe('The path to the file'),
    },
    async ({ filePath }) => {
      logger.info(`MCP tool codebase-get-document-symbols called with filePath: ${filePath}`);

      try {
        // Ensure the engine is initialized
        if (!augmentEngine.isInitialized()) {
          await augmentEngine.initialize();
        }

        // Try to use VS Code API if available
        if (augmentEngine.isUsingVSCodeAPI()) {
          const vscodeAPI = augmentEngine.getVSCodeAPI();
          if (vscodeAPI) {
            const symbols = await vscodeAPI.getDocumentSymbols(filePath);

            if (!symbols || symbols.length === 0) {
              return {
                content: [{ type: 'text', text: `No symbols found in file: ${filePath}` }],
                isError: true,
              };
            }

            // Format the symbols
            let formattedSymbols = `Found ${symbols.length} symbols in ${filePath}:\n\n`;

            // Group symbols by type
            const symbolsByType = new Map<string, CodeSymbol[]>();

            for (const symbol of symbols) {
              const type = symbol.type.toString();
              const typeSymbols = symbolsByType.get(type) || [];
              typeSymbols.push(symbol);
              symbolsByType.set(type, typeSymbols);
            }

            // Format each type
            for (const [type, typeSymbols] of symbolsByType.entries()) {
              formattedSymbols += `## ${type}s (${typeSymbols.length})\n\n`;

              for (const symbol of typeSymbols) {
                formattedSymbols += `- ${symbol.name}`;
                if (symbol.signature) {
                  formattedSymbols += `: ${symbol.signature}`;
                }
                formattedSymbols += ` (line ${symbol.startLine})`;
                if (symbol.parent) {
                  formattedSymbols += ` in ${symbol.parent}`;
                }
                formattedSymbols += '\n';
              }

              formattedSymbols += '\n';
            }

            return {
              content: [{ type: 'text', text: formattedSymbols }],
            };
          }
        }

        // If VS Code API is not available or failed, use the indexer
        const symbols = await augmentEngine.getSymbolsInFile(filePath);

        if (!symbols || symbols.length === 0) {
          return {
            content: [{ type: 'text', text: `No symbols found in file: ${filePath}` }],
            isError: true,
          };
        }

        // Format the symbols
        const formattedSymbols = formatSymbolsList(symbols);

        return {
          content: [{ type: 'text', text: formattedSymbols }],
        };
      } catch (error) {
        logger.error('Error in codebase-get-document-symbols tool:', error);
        return {
          content: [{ type: 'text', text: `Error getting document symbols: ${error}` }],
          isError: true,
        };
      }
    }
  );

  // Add find-references tool
  server.tool(
    'codebase-find-references',
    {
      filePath: z.string().describe('The path to the file'),
      line: z.number().describe('The line number (1-based)'),
      character: z.number().describe('The character position'),
    },
    async ({ filePath, line, character }) => {
      logger.info(
        `MCP tool codebase-find-references called with filePath: ${filePath}, line: ${line}, character: ${character}`
      );

      try {
        // Ensure the engine is initialized
        if (!augmentEngine.isInitialized()) {
          await augmentEngine.initialize();
        }

        // Try to use VS Code API if available
        if (augmentEngine.isUsingVSCodeAPI()) {
          const vscodeAPI = augmentEngine.getVSCodeAPI();
          if (vscodeAPI) {
            const references = await vscodeAPI.getReferences(filePath, line, character);

            if (!references || references.length === 0) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `No references found for symbol at ${filePath}:${line}:${character}`,
                  },
                ],
                isError: true,
              };
            }

            // Format the references
            let formattedReferences = `Found ${references.length} references:\n\n`;

            references.forEach((reference: CodeSymbol, index: number) => {
              formattedReferences += `${index + 1}. ${reference.filePath}:${reference.startLine}:${reference.startLine === reference.endLine ? '' : `-${reference.endLine}`}\n`;
            });

            return {
              content: [{ type: 'text', text: formattedReferences }],
            };
          }
        }

        // If VS Code API is not available or failed
        return {
          content: [
            {
              type: 'text',
              text: 'Finding references is only available when running as a VS Code extension',
            },
          ],
          isError: true,
        };
      } catch (error) {
        logger.error('Error in codebase-find-references tool:', error);
        return {
          content: [{ type: 'text', text: `Error finding references: ${error}` }],
          isError: true,
        };
      }
    }
  );

  logger.info('Augment Context Engine MCP tools registered');
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
 * Format a symbol as a string
 * @param symbol The symbol
 * @returns The formatted symbol
 */
function formatSymbol(symbol: any): string {
  let output = `Symbol: ${symbol.name}\n`;
  output += `Type: ${symbol.type}\n`;
  output += `File: ${symbol.filePath}\n`;
  output += `Lines: ${symbol.startLine}-${symbol.endLine}\n`;

  if (symbol.parent) {
    output += `Parent: ${symbol.parent}\n`;
  }

  if (symbol.signature) {
    output += `Signature: ${symbol.signature}\n`;
  }

  if (symbol.documentation) {
    output += `Documentation:\n${symbol.documentation}\n`;
  }

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

/**
 * Format a list of symbols as a string
 * @param symbols The symbols to format
 * @returns The formatted symbols
 */
function formatSymbolsList(symbols: CodeSymbol[]): string {
  let result = `Found ${symbols.length} symbols:\n\n`;

  // Group symbols by type
  const symbolsByType = new Map<string, CodeSymbol[]>();

  for (const symbol of symbols) {
    const type = symbol.type.toString();
    const typeSymbols = symbolsByType.get(type) || [];
    typeSymbols.push(symbol);
    symbolsByType.set(type, typeSymbols);
  }

  // Format each type
  for (const [type, typeSymbols] of symbolsByType.entries()) {
    result += `## ${type}s (${typeSymbols.length})\n\n`;

    for (const symbol of typeSymbols) {
      result += `- ${symbol.name}`;
      if (symbol.signature) {
        result += `: ${symbol.signature}`;
      }
      result += ` (line ${symbol.startLine})`;
      if (symbol.parent) {
        result += ` in ${symbol.parent}`;
      }
      result += '\n';
    }

    result += '\n';
  }

  return result;
}
