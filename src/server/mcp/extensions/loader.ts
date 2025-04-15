import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import { z } from 'zod';
import { spawn } from 'child_process';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { logger } from '../../utils/logger';
import { getConfig } from '../../utils/config';
import { MCPToolInfo, MCPResourceInfo, MCPPromptInfo } from '../express-server';
import * as dotenv from 'dotenv';

/**
 * Interface for MCP extension metadata
 */
export interface MCPExtensionMeta {
  id: string;
  type: 'tool' | 'resource' | 'prompt';
  description?: string;
  author?: string;
  version?: string;
}

/**
 * Interface for MCP tool extension
 */
export interface MCPToolExtension extends MCPExtensionMeta {
  type: 'tool';
  parameters: Record<string, z.ZodType<any>>;
  handler: (params: any) => Promise<any>;
}

/**
 * Interface for MCP resource extension
 */
export interface MCPResourceExtension extends MCPExtensionMeta {
  type: 'resource';
  template: string;
  handler: (uri: URL, params: any) => Promise<any>;
}

/**
 * Interface for MCP prompt extension
 */
export interface MCPPromptExtension extends MCPExtensionMeta {
  type: 'prompt';
  parameters: Record<string, z.ZodType<any>>;
  handler: (params: any) => any;
}

/**
 * Union type for all MCP extensions
 */
export type MCPExtension = MCPToolExtension | MCPResourceExtension | MCPPromptExtension;

/**
 * Class for loading MCP extensions
 */
export class MCPExtensionsLoader {
  private server: McpServer;
  private config = getConfig().mcp.extensions;
  private workspaceRoot: string;
  private envVars: Record<string, string> = {};

  // Track loaded extensions
  private loadedExtensionFiles: string[] = [];
  private loadedTools: MCPToolInfo[] = [];
  private loadedResources: MCPResourceInfo[] = [];
  private loadedPrompts: MCPPromptInfo[] = [];

  /**
   * Create a new MCP extensions loader
   * @param server The MCP server
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
      const extensionsPath = path.resolve(this.workspaceRoot, this.config.extensionsPath);
      const envPath = path.join(extensionsPath, '.env');

      if (fs.existsSync(envPath)) {
        logger.info(`Loading environment variables from ${envPath}`);
        const result = dotenv.config({ path: envPath });

        if (result.error) {
          logger.error(`Error loading .env file: ${result.error}`);
          return;
        }

        // Store the parsed environment variables
        this.envVars = result.parsed || {};
        logger.info(
          `Loaded ${Object.keys(this.envVars).length} environment variables from .env file`
        );
      } else {
        logger.info(`No .env file found at ${envPath}`);
      }
    } catch (error) {
      logger.error('Failed to load environment variables:', error);
    }
  }

  /**
   * Load all extensions
   */
  public async loadExtensions(): Promise<void> {
    if (!this.config.enabled) {
      logger.info('MCP extensions are disabled');
      return;
    }

    const extensionsPath = path.resolve(this.workspaceRoot, this.config.extensionsPath);

    // Create extensions directory if it doesn't exist
    if (!fs.existsSync(extensionsPath)) {
      fs.mkdirSync(extensionsPath, { recursive: true });
      logger.info(`Created MCP extensions directory: ${extensionsPath}`);

      // Create example extensions
      await this.createExampleExtensions(extensionsPath);
      return;
    }

    logger.info(`Loading MCP extensions from ${extensionsPath}`);

    // Find all extension files
    const extensionFiles = await this.findExtensionFiles(extensionsPath);

    if (extensionFiles.length === 0) {
      logger.info('No MCP extensions found');

      // Create example extensions if directory is empty
      const dirContents = fs.readdirSync(extensionsPath);
      if (dirContents.length === 0) {
        await this.createExampleExtensions(extensionsPath);
      }

      return;
    }

    logger.info(`Found ${extensionFiles.length} MCP extension files`);

    // Load each extension
    for (const file of extensionFiles) {
      try {
        await this.loadExtensionFile(file);
      } catch (error) {
        logger.error(`Failed to load MCP extension ${file}:`, error);
      }
    }

    logger.info(`Loaded ${this.loadedExtensionFiles.length} MCP extensions`);
    logger.info(`- Tools: ${this.loadedTools.length}`);
    logger.info(`- Resources: ${this.loadedResources.length}`);
    logger.info(`- Prompts: ${this.loadedPrompts.length}`);
  }

  /**
   * Find all extension files
   * @param extensionsPath The extensions directory path
   * @returns The list of extension files
   */
  private async findExtensionFiles(extensionsPath: string): Promise<string[]> {
    const patterns = this.config.include.map(pattern => path.join(extensionsPath, pattern));
    const ignorePatterns = this.config.exclude;

    // Use glob.sync with each pattern individually
    let files: string[] = [];
    for (const pattern of patterns) {
      const matches = glob.sync(pattern, { ignore: ignorePatterns });
      files = [...files, ...matches];
    }
    return files;
  }

  /**
   * Load an extension file
   * @param filePath The path to the extension file
   */
  private async loadExtensionFile(filePath: string): Promise<void> {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.js' || ext === '.ts') {
      await this.loadJavaScriptExtension(filePath);
    } else if (ext === '.py') {
      await this.loadPythonExtension(filePath);
    } else {
      logger.warn(`Unsupported extension file type: ${ext}`);
    }
  }

  /**
   * Load a JavaScript/TypeScript extension
   * @param filePath The path to the extension file
   */
  private async loadJavaScriptExtension(filePath: string): Promise<void> {
    try {
      // For TypeScript files, we need to check if they're compiled
      if (filePath.endsWith('.ts')) {
        const jsFilePath = filePath.replace(/\.ts$/, '.js');

        // If the JS file doesn't exist, warn the user
        if (!fs.existsSync(jsFilePath)) {
          logger.warn(`TypeScript file ${filePath} needs to be compiled to JavaScript first`);
          logger.warn(`Please run 'tsc ${filePath}' to compile it`);
          return;
        }

        // Use the compiled JS file instead
        filePath = jsFilePath;
      }

      // Import the extension module
      const extensionModule = await import(filePath);

      // Get the default export or the 'extension' export
      const extension = extensionModule.default || extensionModule.extension;

      if (!extension) {
        logger.warn(`No extension export found in ${filePath}`);
        return;
      }

      // Skip static format extensions
      logger.warn(`Static format extensions are no longer supported: ${filePath}`);
    } catch (error) {
      logger.error(`Failed to load JavaScript extension ${filePath}:`, error);
    }
  }

  /**
   * Find the Python interpreter in the shared virtual environment
   * @returns Path to the Python interpreter or null if not found
   */
  private findVenvPython(): string | null {
    try {
      // Get the MCP extensions directory (.clay/mcp)
      const mcpDir = path.resolve(this.workspaceRoot, this.config.extensionsPath);

      // Check for a .venv directory
      const venvDir = path.join(mcpDir, '.venv');
      if (!fs.existsSync(venvDir) || !fs.statSync(venvDir).isDirectory()) {
        return null;
      }

      // Find the Python executable based on the platform
      const isWindows = process.platform === 'win32';
      const pythonPath = isWindows
        ? path.join(venvDir, 'Scripts', 'python.exe')
        : path.join(venvDir, 'bin', 'python');

      // Check if the Python executable exists
      if (fs.existsSync(pythonPath) && fs.statSync(pythonPath).isFile()) {
        // Check if it's executable (not relevant on Windows)
        if (isWindows || (fs.accessSync(pythonPath, fs.constants.X_OK), true)) {
          return pythonPath;
        }
      }
    } catch (error) {
      logger.debug(`Error finding venv Python: ${error}`);
    }

    return null;
  }

  /**
   * Load a Python extension
   * @param filePath The path to the extension file
   */
  private async loadPythonExtension(filePath: string): Promise<void> {
    try {
      // Create a temporary JSON file to store the extension definition
      const tempJsonPath = `${filePath}.json`;

      // Get the path to the Python loader script
      const loaderScriptPath = path.resolve(__dirname, 'python-loader.py');

      // Check for a virtual environment Python interpreter
      const venvPython = this.findVenvPython();
      const pythonCommand = venvPython || 'python';

      if (venvPython) {
        logger.info(`Using virtual environment Python: ${venvPython}`);
      }

      // Run the Python loader script
      const pythonProcess = spawn(pythonCommand, [
        '-u', // Unbuffered output for immediate logging
        loaderScriptPath,
        filePath,
        tempJsonPath,
      ]);

      // Capture Python process output for better debugging
      let stdoutData = '';
      let stderrData = '';

      pythonProcess.stdout?.on('data', data => {
        stdoutData += data.toString();
        logger.debug(`Python stdout: ${data}`);
      });

      pythonProcess.stderr?.on('data', data => {
        stderrData += data.toString();
        logger.error(`Python stderr: ${data}`);
      });

      // Wait for the process to complete
      await new Promise<void>((resolve, reject) => {
        pythonProcess.on('close', code => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Python process exited with code ${code}. Stderr: ${stderrData}`));
          }
        });

        pythonProcess.on('error', error => {
          reject(error);
        });
      });

      // Read the extension definition from the temporary file
      if (fs.existsSync(tempJsonPath)) {
        const tempFileContent = fs.readFileSync(tempJsonPath, 'utf-8');

        try {
          const extensionJson = JSON.parse(tempFileContent);

          // Clean up the temporary file
          fs.unlinkSync(tempJsonPath);

          if (extensionJson.error) {
            logger.warn(`Error in Python extension ${filePath}: ${extensionJson.error}`);
            return;
          }

          // Process dynamic format with multiple tools/resources/prompts
          await this.processDynamicPythonExtension(extensionJson, filePath);
        } catch (parseError) {
          logger.error(`Failed to parse Python extension JSON from ${filePath}:`, parseError);
          logger.error(`JSON content: ${tempFileContent}`);

          // Clean up the temporary file
          fs.unlinkSync(tempJsonPath);
          return;
        }
      } else {
        logger.warn(`No extension definition found in Python file ${filePath}`);
      }
    } catch (error) {
      logger.error(`Failed to load Python extension ${filePath}:`, error);
    }
  }

  /**
   * Process a dynamic Python extension with multiple tools/resources/prompts
   * @param extensionJson The extension definition
   * @param filePath The path to the extension file
   */
  private async processDynamicPythonExtension(extensionJson: any, filePath: string): Promise<void> {
    try {
      // Track this as a loaded extension file
      if (!this.loadedExtensionFiles.includes(filePath)) {
        this.loadedExtensionFiles.push(filePath);
      }
      // Process tools
      if (extensionJson.tools && extensionJson.tools.length > 0) {
        for (const tool of extensionJson.tools) {
          // Convert parameters to Zod schema
          const zodParams: Record<string, z.ZodType<any>> = {};

          for (const [paramName, paramInfo] of Object.entries<any>(tool.parameters)) {
            // Create Zod schema based on parameter type
            let zodSchema: z.ZodType<any>;

            switch (paramInfo.zod_type) {
              case 'number().int()':
                zodSchema = z.number().int();
                break;
              case 'number()':
                zodSchema = z.number();
                break;
              case 'string()':
                zodSchema = z.string();
                break;
              case 'boolean()':
                zodSchema = z.boolean();
                break;
              case 'array()':
                zodSchema = z.array(z.any());
                break;
              case 'object()':
                zodSchema = z.record(z.any());
                break;
              default:
                zodSchema = z.any();
            }

            // Add description if available
            if (paramInfo.description) {
              zodSchema = zodSchema.describe(paramInfo.description);
            }

            // Make optional if needed
            if (paramInfo.is_optional) {
              zodSchema = zodSchema.optional();

              // Add default value if available
              if (paramInfo.has_default && paramInfo.default_value !== null) {
                zodSchema = zodSchema.default(paramInfo.default_value);
              }
            }

            zodParams[paramName] = zodSchema;
          }

          // Create handler function
          const handler = async (params: any) => {
            return this.callPythonHandler(filePath, 'tool', {
              function_name: tool.function_name,
              ...params,
            });
          };

          // Register the tool
          this.server.tool(tool.id, zodParams, handler);

          // Track the tool
          this.loadedTools.push({
            id: tool.id,
            parameters: this.convertZodSchemaToSimpleTypes(zodParams),
            description: tool.description,
          });

          logger.info(`Registered dynamic MCP tool: ${tool.id} from ${filePath}`);
        }
      }

      // Process resources
      if (extensionJson.resources && extensionJson.resources.length > 0) {
        for (const resource of extensionJson.resources) {
          // Create handler function
          const handler = async (uri: URL, params: any) => {
            return this.callPythonHandler(filePath, 'resource', {
              function_name: resource.function_name,
              uri: uri.toString(),
              params,
            });
          };

          // Register the resource
          this.server.resource(resource.id, resource.template, handler);

          // Track the resource
          this.loadedResources.push({
            id: resource.id,
            template: resource.template,
          });

          logger.info(`Registered dynamic MCP resource: ${resource.id} from ${filePath}`);
        }
      }

      // Process prompts
      if (extensionJson.prompts && extensionJson.prompts.length > 0) {
        for (const prompt of extensionJson.prompts) {
          // Convert parameters to Zod schema
          const zodParams: Record<string, z.ZodType<any>> = {};

          for (const [paramName, paramInfo] of Object.entries<any>(prompt.parameters)) {
            // Create Zod schema based on parameter type
            let zodSchema: z.ZodType<any>;

            switch (paramInfo.zod_type) {
              case 'number().int()':
                zodSchema = z.number().int();
                break;
              case 'number()':
                zodSchema = z.number();
                break;
              case 'string()':
                zodSchema = z.string();
                break;
              case 'boolean()':
                zodSchema = z.boolean();
                break;
              case 'array()':
                zodSchema = z.array(z.any());
                break;
              case 'object()':
                zodSchema = z.record(z.any());
                break;
              default:
                zodSchema = z.any();
            }

            // Add description if available
            if (paramInfo.description) {
              zodSchema = zodSchema.describe(paramInfo.description);
            }

            // Make optional if needed
            if (paramInfo.is_optional) {
              zodSchema = zodSchema.optional();

              // Add default value if available
              if (paramInfo.has_default && paramInfo.default_value !== null) {
                zodSchema = zodSchema.default(paramInfo.default_value);
              }
            }

            zodParams[paramName] = zodSchema;
          }

          // Create handler function
          const handler = (params: any) => {
            return this.callPythonHandler(filePath, 'prompt', {
              function_name: prompt.function_name,
              ...params,
            });
          };

          // Register the prompt
          this.server.prompt(prompt.id, zodParams, handler);

          // Track the prompt
          this.loadedPrompts.push({
            id: prompt.id,
            parameters: this.convertZodSchemaToSimpleTypes(zodParams),
          });

          logger.info(`Registered dynamic MCP prompt: ${prompt.id} from ${filePath}`);
        }
      }
    } catch (error) {
      logger.error(`Failed to process dynamic Python extension ${filePath}:`, error);
    }
  }

  /**
   * Call a Python extension handler
   * @param filePath The path to the Python file
   * @param handlerType The type of handler
   * @param params The parameters to pass to the handler
   * @returns The handler result
   */
  private async callPythonHandler(
    filePath: string,
    handlerType: string,
    params: any
  ): Promise<any> {
    // Create a temporary file for the parameters
    const paramsPath = `${filePath}.params.json`;
    const resultPath = `${filePath}.result.json`;
    const envPath = `${filePath}.env.json`;

    // Write the parameters to the temporary file
    fs.writeFileSync(paramsPath, JSON.stringify(params));

    // Write the environment variables to a temporary file
    fs.writeFileSync(envPath, JSON.stringify(this.envVars));

    // Get the path to the Python handler script
    const handlerScriptPath = path.resolve(__dirname, 'python-handler.py');

    // Check for a virtual environment Python interpreter
    const venvPython = this.findVenvPython();
    const pythonCommand = venvPython || 'python';

    if (venvPython) {
      logger.debug(`Using virtual environment Python for handler: ${venvPython}`);
    }

    // Run the Python script to call the handler
    const pythonProcess = spawn(pythonCommand, [
      '-u', // Unbuffered output for immediate logging
      handlerScriptPath,
      filePath,
      handlerType,
      paramsPath,
      resultPath,
      envPath, // Pass the environment variables file path
    ]);

    // Capture Python process output for better debugging
    let stdoutData = '';
    let stderrData = '';

    pythonProcess.stdout?.on('data', data => {
      stdoutData += data.toString();
      logger.debug(`Python handler stdout: ${data}`);
    });

    pythonProcess.stderr?.on('data', data => {
      stderrData += data.toString();
      logger.error(`Python handler stderr: ${data}`);
    });

    // Wait for the process to complete
    await new Promise<void>((resolve, reject) => {
      pythonProcess.on('close', code => {
        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error(`Python handler process exited with code ${code}. Stderr: ${stderrData}`)
          );
        }
      });

      pythonProcess.on('error', error => {
        reject(error);
      });
    });

    // Clean up the temporary files
    if (fs.existsSync(paramsPath)) {
      fs.unlinkSync(paramsPath);
    }

    if (fs.existsSync(envPath)) {
      fs.unlinkSync(envPath);
    }

    // Read the result from the temporary file
    if (fs.existsSync(resultPath)) {
      const resultContent = fs.readFileSync(resultPath, 'utf-8');

      try {
        const result = JSON.parse(resultContent);

        // Clean up the result file
        fs.unlinkSync(resultPath);

        if (result.error) {
          throw new Error(`Error in Python handler: ${result.error}`);
        }

        return result;
      } catch (parseError) {
        // Clean up the result file
        fs.unlinkSync(resultPath);

        logger.error(`Failed to parse Python handler result: ${parseError}`);
        logger.error(`Result content: ${resultContent}`);

        throw new Error(`Failed to parse Python handler result: ${parseError}`);
      }
    } else {
      throw new Error('No result from Python handler');
    }
  }

  // Static format extension registration methods have been removed

  /**
   * Convert a Zod schema to simple types for display
   * @param schema The Zod schema
   * @returns A simple type representation
   */
  private convertZodSchemaToSimpleTypes(
    schema: Record<string, z.ZodType<any>>
  ): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(schema)) {
      if (value instanceof z.ZodString) {
        result[key] = 'string';
      } else if (value instanceof z.ZodNumber) {
        result[key] = 'number';
      } else if (value instanceof z.ZodBoolean) {
        result[key] = 'boolean';
      } else if (value instanceof z.ZodArray) {
        result[key] = 'array';
      } else if (value instanceof z.ZodObject) {
        result[key] = 'object';
      } else if (value instanceof z.ZodEnum) {
        result[key] = 'enum';
      } else if (value instanceof z.ZodOptional) {
        // Try to get the inner type
        const innerType = this.convertZodSchemaToSimpleTypes({ inner: value._def.innerType });
        result[key] = `${innerType.inner} (optional)`;
      } else {
        result[key] = 'unknown';
      }
    }

    return result;
  }

  /**
   * Create example extensions
   * @param extensionsPath The extensions directory path
   */
  private async createExampleExtensions(extensionsPath: string): Promise<void> {
    logger.info('Creating example MCP extensions');

    // Create example tool
    const toolPath = path.join(extensionsPath, 'example-tool.js');
    fs.writeFileSync(
      toolPath,
      `/**
 * Example MCP tool extension
 */
const { z } = require('zod');

// Define the extension
const extension = {
  id: 'example-tool',
  type: 'tool',
  description: 'An example tool that reverses text',
  author: 'Clay',
  version: '1.0.0',
  parameters: {
    text: z.string().describe('The text to reverse'),
  },
  handler: async ({ text }) => {
    // Reverse the text
    const reversed = text.split('').reverse().join('');

    return {
      content: [
        {
          type: 'text',
          text: \`Reversed: \${reversed}\`,
        },
      ],
    };
  },
};

// Export the extension
module.exports = { extension };
`
    );

    // Create example resource
    const resourcePath = path.join(extensionsPath, 'example-resource.js');
    fs.writeFileSync(
      resourcePath,
      `/**
 * Example MCP resource extension
 */

// Define the extension
const extension = {
  id: 'example-resource',
  type: 'resource',
  description: 'An example resource that provides current date and time',
  author: 'Clay',
  version: '1.0.0',
  template: 'datetime://{format}',
  handler: async (uri, params) => {
    // Get the format parameter
    const format = params.format || 'iso';

    // Get the current date
    const now = new Date();

    // Format the date based on the format parameter
    let formattedDate;
    if (format === 'iso') {
      formattedDate = now.toISOString();
    } else if (format === 'local') {
      formattedDate = now.toLocaleString();
    } else if (format === 'unix') {
      formattedDate = Math.floor(now.getTime() / 1000).toString();
    } else {
      formattedDate = now.toString();
    }

    return {
      contents: [
        {
          uri: uri.href,
          text: formattedDate,
        },
      ],
    };
  },
};

// Export the extension
module.exports = { extension };
`
    );

    // Create example prompt
    const promptPath = path.join(extensionsPath, 'example-prompt.js');
    fs.writeFileSync(
      promptPath,
      `/**
 * Example MCP prompt extension
 */
const { z } = require('zod');

// Define the extension
const extension = {
  id: 'example-prompt',
  type: 'prompt',
  description: 'An example prompt for summarizing text',
  author: 'Clay',
  version: '1.0.0',
  parameters: {
    text: z.string().describe('The text to summarize'),
    length: z.number().optional().describe('The desired summary length'),
  },
  handler: ({ text, length }) => {
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: \`Please summarize the following text\${length ? \` in about \${length} words\` : ''}:\\n\\n\${text}\`,
          },
        },
      ],
    };
  },
};

// Export the extension
module.exports = { extension };
`
    );

    // Create example Python tool with dynamic format
    const pythonToolPath = path.join(extensionsPath, 'example-python-tool.py');
    fs.writeFileSync(
      pythonToolPath,
      `"""
Example MCP tool extension in Python using dynamic format
"""
from typing import Dict, List, Optional

def tool_calculate(expression: str) -> Dict:
    """Evaluates a mathematical expression

    Args:
        expression: The mathematical expression to evaluate
    """
    try:
        result = eval(expression)
        return {
            "content": [
                {
                    "type": "text",
                    "text": f"Result: {result}"
                }
            ]
        }
    except Exception as e:
        return {
            "content": [
                {
                    "type": "text",
                    "text": f"Error: {str(e)}"
                }
            ],
            "isError": True
        }

def main():
    """Define the extension"""
    return {
        "id": "python-calculator",
        "description": "A simple calculator implemented in Python",
        "author": "Clay",
        "version": "1.0.0",
        "tools": [tool_calculate],
        "resources": [],
        "prompts": []
    }
`
    );

    logger.info('Created example MCP extensions');
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
}
