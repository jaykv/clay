import express from 'express';
import { Request, Response } from 'express';
import cors from 'cors'; // Used in app.use(cors())
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';

import { logger } from '../utils/logger';
import { getConfig } from '../utils/config';
// Note: registerAugmentMCP is now handled by the server loader
import { workspaceRootPath } from '../utils/server-context';
import {
  initializeMCPServers,
  getLoadedTools,
  getLoadedResources,
  getLoadedPrompts,
  cleanupMCPServers,
} from './extensions';

export interface MCPResourceInfo {
  id: string;
  template: string;
}

export interface MCPToolInfo {
  id: string;
  parameters: Record<string, any>;
  description?: string;
}

export interface MCPPromptInfo {
  id: string;
  parameters: Record<string, any>;
}

export interface MCPServerInfo {
  name: string;
  version: string;
  resources: MCPResourceInfo[];
  tools: MCPToolInfo[];
  prompts: MCPPromptInfo[];
}

export class ExpressMCPServer {
  private mcpServer: McpServer;
  private app: express.Application;
  private httpServer: any;
  private config = getConfig().mcp;
  private transports: Record<string, SSEServerTransport> = {};

  // Keep track of registered capabilities
  private resources: MCPResourceInfo[] = [];
  private tools: MCPToolInfo[] = [];
  private prompts: MCPPromptInfo[] = [];

  constructor() {
    // Create the MCP server
    this.mcpServer = new McpServer({
      name: this.config.name,
      version: this.config.version,
    });

    // Create the Express application
    this.app = express();

    this.app.use(cors());

    // Setup MCP server capabilities
    this.setupResources();
    this.setupTools();
    this.setupPrompts();

    // Note: Augment MCP components are now registered via the server loader as a built-in server

    // Setup Express routes
    this.setupRoutes();
  }

  private setupResources() {
    // Add a simple file resource
    this.mcpServer.resource('file', 'file://{path}', async (uri: URL, params: any) => {
      try {
        // In a real implementation, we would read the file from the filesystem
        // For now, we'll just return a mock response
        return {
          contents: [
            {
              uri: uri.href,
              text: `Content of file: ${params.path}`,
            },
          ],
        };
      } catch (error) {
        logger.error(`Error reading file: ${params.path}`, error);
        throw new Error(`Failed to read file: ${params.path}`);
      }
    });
    // Track the resource
    this.resources.push({
      id: 'file',
      template: 'file://{path}',
    });

    // Add a workspace resource
    this.mcpServer.resource('workspace', 'workspace://current', async uri => {
      return {
        contents: [
          {
            uri: uri.href,
            text: 'Current workspace information',
          },
        ],
      };
    });
    // Track the resource
    this.resources.push({
      id: 'workspace',
      template: 'workspace://current',
    });
  }

  private setupTools() {
    // Add a simple echo tool
    this.mcpServer.tool('echo', { message: z.string() }, async ({ message }) => ({
      content: [{ type: 'text', text: `Echo: ${message}` }],
    }));
    // Track the tool
    this.tools.push({
      id: 'echo',
      parameters: { message: 'string' },
      description: 'Echoes back the provided message',
    });

    // Add a code completion tool
    this.mcpServer.tool(
      'complete-code',
      {
        code: z.string(),
        language: z.string(),
        position: z.object({
          line: z.number(),
          character: z.number(),
        }),
      },
      async ({ language, position }) => {
        // In a real implementation, we would call an AI model for code completion
        // For now, we'll just return a mock response
        return {
          content: [
            {
              type: 'text',
              text: `Completion for ${language} at line ${position.line}, character ${position.character}:\n\nfunction example() {\n  return 'completed code';\n}`,
            },
          ],
        };
      }
    );
    // Track the tool
    this.tools.push({
      id: 'complete-code',
      parameters: {
        code: 'string',
        language: 'string',
        position: { line: 'number', character: 'number' },
      },
      description: 'Provides code completion suggestions',
    });
  }

  private setupPrompts() {
    // Add a code review prompt
    this.mcpServer.prompt('review-code', { code: z.string() }, ({ code }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Please review this code:\n\n${code}`,
          },
        },
      ],
    }));
    // Track the prompt
    this.prompts.push({
      id: 'review-code',
      parameters: { code: 'string' },
    });

    // Add a documentation generation prompt
    this.mcpServer.prompt(
      'generate-docs',
      {
        code: z.string(),
        language: z.string(),
      },
      ({ code, language }) => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please generate documentation for this ${language} code:\n\n${code}`,
            },
          },
        ],
      })
    );
    // Track the prompt
    this.prompts.push({
      id: 'generate-docs',
      parameters: { code: 'string', language: 'string' },
    });
  }

  private setupRoutes() {
    this.app.get('/health', async (_req, res) => {
      res.json({ status: 'ok' });
    });

    // Admin endpoint to stop the server
    this.app.post('/admin/stopServer', express.json({ strict: false }), async (_req, res) => {
      logger.info('Received request to stop MCP server via admin endpoint');

      // Send response before stopping the server
      res.json({ status: 'stopping' });

      // Stop the server after a short delay to allow the response to be sent
      setTimeout(() => {
        logger.info('Stopping MCP server via admin endpoint');
        this.stop().catch(error => {
          logger.error('Error stopping MCP server:', error);
        });
      }, 100);
    });

    this.app.get('/info', async (_req, res) => {
      logger.info('MCP server info requested');
      res.json(this.getServerInfo());
    });

    this.app.get('/sse', async (_req, res) => {
      logger.info('MCP client connected to SSE endpoint');

      const transport = new SSEServerTransport('/messages', res);
      this.transports[transport.sessionId] = transport;

      res.on('close', () => {
        logger.warn(`MCP SSE connection closed for session: ${transport.sessionId}`);
        delete this.transports[transport.sessionId];
      });

      await this.mcpServer.connect(transport).catch(error => {
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

  /**
   * Get information about the MCP server
   * @returns Information about the MCP server
   */
  public getServerInfo(): MCPServerInfo {
    // Get dynamically loaded extensions
    const dynamicTools = getLoadedTools();
    const dynamicResources = getLoadedResources();
    const dynamicPrompts = getLoadedPrompts();

    return {
      name: this.config.name,
      version: this.config.version,
      resources: [...this.resources, ...dynamicResources],
      tools: [...this.tools, ...dynamicTools],
      prompts: [...this.prompts, ...dynamicPrompts],
    };
  }

  public async start(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        // Get the workspace root path from globals
        // This will be set by the VS Code extension or default to process.cwd()
        const workspaceRoot = workspaceRootPath;

        // Initialize MCP servers
        if (this.config.servers.enabled) {
          logger.info('Loading MCP servers...');
          await initializeMCPServers(this.mcpServer, workspaceRoot);
        }

        this.httpServer = this.app.listen(this.config.port, this.config.host, () => {
          resolve();
        });

        this.httpServer.on('error', (error: Error) => {
          logger.error('Failed to start MCP server:', error);
          reject(error);
        });
      } catch (error) {
        logger.error('Failed to start MCP server:', error);
        reject(error);
      }
    });
  }

  public async stop(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      if (!this.httpServer) {
        logger.warn('MCP server HTTP server is not running');
        resolve();
        return;
      }

      try {
        // Cleanup MCP servers
        await cleanupMCPServers();

        // Close all open connections
        for (const sessionId in this.transports) {
          try {
            logger.info(`Closing MCP transport for session: ${sessionId}`);
            delete this.transports[sessionId];
          } catch (err) {
            logger.warn(`Error closing transport for session ${sessionId}:`, err);
          }
        }

        // Close the HTTP server
        this.httpServer.close(() => {
          logger.info('MCP HTTP server stopped');
          this.httpServer = null;
          resolve();
        });
      } catch (error) {
        logger.error('Failed to stop MCP server:', error);
        reject(error);
      }
    });
  }
}

export default ExpressMCPServer;
