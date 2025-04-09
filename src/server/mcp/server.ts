import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { getConfig } from '../utils/config';

export class MCPServerManager {
  private server: McpServer;
  private transports: Record<string, SSEServerTransport> = {};
  private config = getConfig().mcp;

  constructor() {
    this.server = new McpServer({
      name: this.config.name,
      version: this.config.version
    });

    this.setupResources();
    this.setupTools();
    this.setupPrompts();
  }

  private setupResources() {
    // Add a simple file resource
    this.server.resource(
      'file',
      new ResourceTemplate('file://{path}', { list: undefined }),
      async (uri, { path }) => {
        try {
          // In a real implementation, we would read the file from the filesystem
          // For now, we'll just return a mock response
          return {
            contents: [{
              uri: uri.href,
              text: `Content of file: ${path}`
            }]
          };
        } catch (error) {
          logger.error(`Error reading file: ${path}`, error);
          throw new Error(`Failed to read file: ${path}`);
        }
      }
    );

    // Add a workspace resource
    this.server.resource(
      'workspace',
      'workspace://current',
      async (uri) => {
        return {
          contents: [{
            uri: uri.href,
            text: 'Current workspace information'
          }]
        };
      }
    );
  }

  private setupTools() {
    // Add a simple echo tool
    this.server.tool(
      'echo',
      { message: z.string() },
      async ({ message }) => ({
        content: [{ type: 'text', text: `Echo: ${message}` }]
      })
    );

    // Add a code completion tool
    this.server.tool(
      'complete-code',
      {
        code: z.string(),
        language: z.string(),
        position: z.object({
          line: z.number(),
          character: z.number()
        })
      },
      async ({ code, language, position }) => {
        // In a real implementation, we would call an AI model for code completion
        // For now, we'll just return a mock response
        return {
          content: [{
            type: 'text',
            text: `Completion for ${language} at line ${position.line}, character ${position.character}:\n\nfunction example() {\n  return 'completed code';\n}`
          }]
        };
      }
    );
  }

  private setupPrompts() {
    // Add a code review prompt
    this.server.prompt(
      'review-code',
      { code: z.string() },
      ({ code }) => ({
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `Please review this code:\n\n${code}`
          }
        }]
      })
    );

    // Add a documentation generation prompt
    this.server.prompt(
      'generate-docs',
      {
        code: z.string(),
        language: z.string()
      },
      ({ code, language }) => ({
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `Please generate documentation for this ${language} code:\n\n${code}`
          }
        }]
      })
    );
  }

  public getServer() {
    return this.server;
  }

  public handleSSEConnection(res: Response, messagesEndpoint: string) {
    const transport = new SSEServerTransport(messagesEndpoint, res);
    this.transports[transport.sessionId] = transport;

    res.on('close', () => {
      delete this.transports[transport.sessionId];
      logger.info(`MCP client disconnected: ${transport.sessionId}`);
    });

    logger.info(`MCP client connected: ${transport.sessionId}`);
    return this.server.connect(transport);
  }

  public async handlePostMessage(req: Request, res: Response, sessionId: string) {
    const transport = this.transports[sessionId];
    if (transport) {
      await transport.handlePostMessage(req, res);
    } else {
      res.status(400).send('No transport found for sessionId');
    }
  }
}

export default MCPServerManager;
