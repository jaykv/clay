import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { spawn, ChildProcess } from 'child_process';
import { logger } from '../../utils/logger';
import { getConfig, MCPServerConfig } from '../../utils/config';
import { workspaceRootPath } from '../../utils/server-context';
import * as fs from 'fs';
import * as path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { z } from 'zod';

export interface MCPToolInfo {
  id: string;
  parameters: Record<string, any>;
  description?: string;
}

export interface MCPResourceInfo {
  id: string;
  template: string;
}

export interface MCPPromptInfo {
  id: string;
  parameters: Record<string, any>;
}

/**
 * Class for loading standard MCP servers
 */
export class MCPServerLoader {
  private server: McpServer;
  private config = getConfig().mcp.servers;
  private workspaceRoot: string;
  private envVars: Record<string, string> = {};

  // Track loaded servers and their capabilities
  private loadedServers: Map<string, any> = new Map();
  private externalClients: Map<string, { client: Client; process?: ChildProcess }> = new Map();
  private loadedTools: MCPToolInfo[] = [];
  private loadedResources: MCPResourceInfo[] = [];
  private loadedPrompts: MCPPromptInfo[] = [];

  /**
   * Create a new MCP server loader
   * @param server The main MCP server to register tools with
   * @param workspaceRoot The workspace root path
   */
  constructor(server: McpServer, workspaceRoot: string) {
    this.server = server;
    this.workspaceRoot = workspaceRoot;
    this.loadEnvVars();
  }

  /**
   * Load environment variables from .env file
   */
  private loadEnvVars(): void {
    try {
      const envPath = path.join(this.workspaceRoot, '.env');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        const lines = envContent.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const [key, ...valueParts] = trimmed.split('=');
            if (key && valueParts.length > 0) {
              this.envVars[key.trim()] = valueParts.join('=').trim();
            }
          }
        }

        logger.info(`Loaded ${Object.keys(this.envVars).length} environment variables`);
      }
    } catch (error) {
      logger.warn('Failed to load environment variables:', error);
    }
  }

  /**
   * Load all configured MCP servers
   */
  public async loadServers(): Promise<void> {
    if (!this.config.enabled) {
      logger.info('MCP servers loading is disabled');
      return;
    }

    const serversPath = path.resolve(this.workspaceRoot, this.config.serversPath);

    // Ensure servers directory exists
    if (!fs.existsSync(serversPath)) {
      logger.info(`Creating MCP servers directory: ${serversPath}`);
      fs.mkdirSync(serversPath, { recursive: true });
      await this.createExampleServers(serversPath);
    }

    logger.info(`Loading MCP servers...`);

    // Load each configured server
    for (const serverConfig of this.config.servers) {
      if (serverConfig.enabled === false) {
        logger.info(`Skipping disabled server: ${serverConfig.name}`);
        continue;
      }

      try {
        await this.loadServer(serverConfig, serversPath);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        logger.error(`Failed to load MCP server ${serverConfig.name}: ${errorMessage}`);
        if (errorStack) {
          logger.debug(`Stack trace for ${serverConfig.name}:`, errorStack);
        }
      }
    }

    logger.info(`Loaded ${this.loadedTools.length} tools, ${this.loadedResources.length} resources, ${this.loadedPrompts.length} prompts from MCP servers`);
  }

  /**
   * Load a single MCP server based on its configuration
   */
  private async loadServer(serverConfig: MCPServerConfig, serversPath: string): Promise<void> {
    logger.info(`Loading MCP server: ${serverConfig.name} (type: ${serverConfig.type})`);

    switch (serverConfig.type) {
      case 'builtin':
        await this.loadBuiltinServer(serverConfig);
        break;
      case 'module':
        await this.loadModuleServer(serverConfig, serversPath);
        break;
      case 'external':
        await this.loadExternalServer(serverConfig);
        break;
      default:
        throw new Error(`Unknown server type: ${(serverConfig as any).type}`);
    }
  }

  /**
   * Load a built-in server (like Augment)
   */
  private async loadBuiltinServer(serverConfig: MCPServerConfig): Promise<void> {
    switch (serverConfig.name) {
      case 'augment':
        // Import and register Augment MCP components
        const { registerAugmentMCP } = await import('../../augment/mcp');
        registerAugmentMCP(this.server);
        logger.info('Registered built-in Augment MCP server');
        break;
      default:
        logger.warn(`Unknown built-in server: ${serverConfig.name}`);
    }
  }

  /**
   * Load a module-based MCP server
   */
  private async loadModuleServer(serverConfig: MCPServerConfig, serversPath: string): Promise<void> {
    if (!serverConfig.path) {
      throw new Error(`Module server ${serverConfig.name} requires a path`);
    }

    const modulePath = path.resolve(serversPath, serverConfig.path);

    if (!fs.existsSync(modulePath)) {
      throw new Error(`Module not found: ${modulePath}`);
    }

    try {
      // Import the module
      const module = await import(modulePath);

      // Look for standard MCP server exports
      if (module.server && typeof module.server === 'object') {
        // This is a standard MCP server module
        await this.registerServerCapabilities(module.server, serverConfig);
      } else if (typeof module.registerTools === 'function') {
        // This is a module that exports a registration function
        await module.registerTools(this.server, serverConfig.config || {});
      } else {
        throw new Error(`Module ${modulePath} does not export a valid MCP server or registerTools function`);
      }

      this.loadedServers.set(serverConfig.name, module);
      logger.info(`Loaded module server: ${serverConfig.name}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load module ${modulePath}: ${errorMessage}`);
    }
  }

  /**
   * Load an external MCP server via subprocess
   */
  private async loadExternalServer(serverConfig: MCPServerConfig): Promise<void> {
    if (!serverConfig.command) {
      throw new Error(`External server ${serverConfig.name} requires a command`);
    }

    try {
      // Create client transport for the external server
      const env: Record<string, string> = {};
      for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined) {
          env[key] = value;
        }
      }
      for (const [key, value] of Object.entries(this.envVars)) {
        env[key] = value;
      }

      const transport = new StdioClientTransport({
        command: serverConfig.command,
        args: serverConfig.args || [],
        env,
      });

      // Create client to connect to the external server
      const client = new Client({
        name: `clay-client-${serverConfig.name}`,
        version: '1.0.0',
      });

      await client.connect(transport);

      // Store the client for later use
      this.externalClients.set(serverConfig.name, { client });

      // Proxy the external server's capabilities to our main server
      await this.proxyExternalServerCapabilities(client, serverConfig);

      logger.info(`Connected to external MCP server: ${serverConfig.name}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to connect to external server ${serverConfig.name}: ${errorMessage}`);
    }
  }

  /**
   * Register capabilities from a loaded MCP server module
   */
  private async registerServerCapabilities(mcpServer: any, serverConfig: MCPServerConfig): Promise<void> {
    // This is a placeholder for registering capabilities from a loaded MCP server
    // The actual implementation would depend on how the MCP server module exposes its capabilities
    logger.warn(`registerServerCapabilities not yet implemented for ${serverConfig.name}`);
  }

  /**
   * Proxy capabilities from an external MCP server
   */
  private async proxyExternalServerCapabilities(client: Client, serverConfig: MCPServerConfig): Promise<void> {
    try {
      // Get tools from external server
      const tools = await client.listTools();

      for (const tool of tools.tools) {
        // Register a proxy tool that forwards calls to the external server
        this.server.tool(
          `${serverConfig.name}_${tool.name}`,
          this.convertInputSchemaToZod(tool.inputSchema),
          async (params: any) => {
            const result = await client.callTool({
              name: tool.name,
              arguments: params,
            });
            return {
              content: Array.isArray(result.content)
                ? result.content
                : [{ type: 'text', text: 'No content returned' }]
            };
          }
        );

        this.loadedTools.push({
          id: `${serverConfig.name}_${tool.name}`,
          parameters: tool.inputSchema?.properties || {},
          description: tool.description,
        });
      }

      logger.info(`Proxied ${tools.tools.length} tools from external server ${serverConfig.name}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to proxy capabilities from ${serverConfig.name}: ${errorMessage}`);
    }
  }

  /**
   * Convert MCP input schema to Zod schema (simplified)
   */
  private convertInputSchemaToZod(inputSchema: any): Record<string, z.ZodType> {
    const zodSchema: Record<string, z.ZodType> = {};

    if (inputSchema?.properties) {
      for (const [key, prop] of Object.entries(inputSchema.properties as any)) {
        const propSchema = prop as any;

        // Basic type conversion (can be expanded)
        switch (propSchema.type) {
          case 'string':
            zodSchema[key] = z.string();
            break;
          case 'number':
            zodSchema[key] = z.number();
            break;
          case 'boolean':
            zodSchema[key] = z.boolean();
            break;
          case 'array':
            zodSchema[key] = z.array(z.any());
            break;
          default:
            zodSchema[key] = z.any();
        }

        // Handle optional properties
        if (!inputSchema.required?.includes(key)) {
          zodSchema[key] = zodSchema[key].optional();
        }
      }
    }

    return zodSchema;
  }

  /**
   * Create example MCP servers
   */
  private async createExampleServers(serversPath: string): Promise<void> {
    // Create a simple calculator example
    const calculatorExample = `import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'Calculator',
  version: '1.0.0'
});

// Add calculator tool
server.tool('add',
  {
    a: z.number().describe('First number'),
    b: z.number().describe('Second number')
  },
  async ({ a, b }) => ({
    content: [{ type: 'text', text: String(a + b) }]
  })
);

server.tool('multiply',
  {
    a: z.number().describe('First number'),
    b: z.number().describe('Second number')
  },
  async ({ a, b }) => ({
    content: [{ type: 'text', text: String(a * b) }]
  })
);

// Export for Clay to load
export { server };
`;

    fs.writeFileSync(path.join(serversPath, 'calculator.mjs'), calculatorExample);

    // Create README
    const readme = `# MCP Servers

This directory contains MCP server modules that Clay can load.

## Server Types

1. **Module Servers**: Standard MCP server modules (TypeScript/JavaScript)
2. **External Servers**: External MCP servers (Python, etc.) via subprocess
3. **Built-in Servers**: Built-in Clay servers (like Augment)

## Creating a Module Server

Create a \`.mjs\` file that exports a standard MCP server:

\`\`\`javascript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'MyServer',
  version: '1.0.0'
});

server.tool('my_tool',
  { param: z.string() },
  async ({ param }) => ({
    content: [{ type: 'text', text: \`Hello \${param}\` }]
  })
);

export { server };
\`\`\`

## Configuration

Add your server to Clay's configuration:

\`\`\`yaml
mcp:
  servers:
    servers:
      - name: "my-server"
        type: "module"
        path: "./my-server.mjs"
        enabled: true
\`\`\`
`;

    fs.writeFileSync(path.join(serversPath, 'README.md'), readme);

    logger.info('Created example MCP servers');
  }

  /**
   * Get the loaded tools
   */
  public getLoadedTools(): MCPToolInfo[] {
    return this.loadedTools;
  }

  /**
   * Get the loaded resources
   */
  public getLoadedResources(): MCPResourceInfo[] {
    return this.loadedResources;
  }

  /**
   * Get the loaded prompts
   */
  public getLoadedPrompts(): MCPPromptInfo[] {
    return this.loadedPrompts;
  }

  /**
   * Cleanup external connections
   */
  public async cleanup(): Promise<void> {
    for (const [name, { client, process }] of this.externalClients) {
      try {
        await client.close();
        if (process) {
          process.kill();
        }
        logger.info(`Cleaned up external server: ${name}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Failed to cleanup external server ${name}: ${errorMessage}`);
      }
    }
    this.externalClients.clear();
  }
}
