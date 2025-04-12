import express from 'express';
import { Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { getConfig } from '../utils/config';

export class ExpressMCPServer {
  private server: McpServer;
  private app: express.Application;
  private config = getConfig().mcp;
  private transports: Record<string, SSEServerTransport> = {};

  constructor() {
    // Create the MCP server
    this.server = new McpServer({
      name: this.config.name,
      version: this.config.version
    });

    // Create the Express application
    this.app = express();

    // Setup MCP server capabilities
    this.setupResources();
    this.setupTools();
    this.setupPrompts();

    // Setup Express routes
    this.setupRoutes();
  }

  private setupResources() {
    // Add a simple file resource
    this.server.resource(
      'file',
      'file://{path}',
      async (uri, params: any) => {
        try {
          // In a real implementation, we would read the file from the filesystem
          // For now, we'll just return a mock response
          return {
            contents: [{
              uri: uri.href,
              text: `Content of file: ${params.path}`
            }]
          };
        } catch (error) {
          logger.error(`Error reading file: ${params.path}`, error);
          throw new Error(`Failed to read file: ${params.path}`);
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
      async ({ language, position }) => {
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

  private setupRoutes() {
    this.app.get('/health', async (_req, res) => {
      res.json({ status: 'ok' });
    });

    this.app.get('/sse', async (_req, res) => {
      logger.info('MCP client connected to SSE endpoint');

      const transport = new SSEServerTransport('/messages', res);
      this.transports[transport.sessionId] = transport;

      res.on('close', () => {
        logger.warn(`MCP SSE connection closed for session: ${transport.sessionId}`);
        delete this.transports[transport.sessionId];
      });

      await this.server.connect(transport).catch(error => {
        logger.error('Error connecting MCP transport:', error);
      });
    });

    this.app.post('/messages', async (req: Request, res: Response) => {
      const sessionId = req.query.sessionId as string;

      if (!sessionId) {
        logger.error('Missing sessionId parameter in MCP message request');
        res.status(400).send('Missing sessionId parameter');
      }

      const transport = this.transports[sessionId];
      logger.info(`Received MCP message for session: ${sessionId}`);

      if (!transport) {
        logger.error(`No transport found for session ID: ${sessionId}`);
        res.status(400).send('No transport found for sessionId');
      }

      await transport.handlePostMessage(req, res);
    });
  }

  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const server = this.app.listen(this.config.port, this.config.host, () => {
          resolve();
        });

        server.on('error', (error) => {
          logger.error('Failed to start MCP server:', error);
          reject(error);
        });
      } catch (error) {
        logger.error('Failed to start MCP server:', error);
        reject(error);
      }
    });
  }
}

export default ExpressMCPServer;
