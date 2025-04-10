import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { getConfig } from '../utils/config';
import { FetchSSEServerTransport } from './fetch-sse-transport';

/**
 * MCP Server Manager for Hono integration
 */
export class MCPHonoServerManager {
  private server: McpServer;
  private transports: Record<string, FetchSSEServerTransport> = {};
  private config = getConfig().mcp;

  constructor() {
    this.server = new McpServer({
      name: this.config.name,
      version: this.config.version
    });

    this.setupResources();
    this.setupTools();
    this.setupPrompts();
    
    logger.info(`MCP Hono Server Manager initialized with name: ${this.config.name}, version: ${this.config.version}`);
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

  /**
   * Handle SSE connection for MCP
   * @param request Fetch Request
   * @returns Response
   */
  public async handleSSEConnection(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const messagesEndpoint = `${url.protocol}//${url.host}/mcp/messages`;
      
      const transport = new FetchSSEServerTransport(messagesEndpoint);
      this.transports[transport.sessionId] = transport;
      
      // Connect the transport to the MCP server
      this.server.connect(transport);
      
      // Handle the SSE request
      return await transport.handleSSERequest(request);
    } catch (error) {
      logger.error('Error handling SSE connection:', error);
      return new Response('Internal server error', { status: 500 });
    }
  }

  /**
   * Handle POST messages for MCP
   * @param request Fetch Request
   * @returns Response
   */
  public async handlePostMessage(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const sessionId = url.searchParams.get('sessionId');
      
      if (!sessionId) {
        return new Response('Missing sessionId parameter', { status: 400 });
      }
      
      const transport = this.transports[sessionId];
      if (!transport) {
        return new Response('No transport found for sessionId', { status: 400 });
      }
      
      // Handle the POST message
      return await transport.handlePostMessage(request);
    } catch (error) {
      logger.error('Error handling MCP message:', error);
      return new Response('Internal server error', { status: 500 });
    }
  }

  /**
   * Get the MCP server
   * @returns McpServer instance
   */
  public getServer(): McpServer {
    return this.server;
  }

  /**
   * Get all active transports
   * @returns Record of sessionId to transport
   */
  public getTransports(): Record<string, FetchSSEServerTransport> {
    return this.transports;
  }

  /**
   * Remove a transport by sessionId
   * @param sessionId Session ID
   */
  public removeTransport(sessionId: string): void {
    delete this.transports[sessionId];
  }
}

export default MCPHonoServerManager;
