import { LogLevel } from './logger';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'js-yaml';
import { logger } from './logger';

export interface TracingConfig {
  enabled: boolean;
  detailedBodyCapture: boolean;
  detailedSSECapture: boolean;
  maxBodySize: number;
  maxResponseSize: number;
  maxStreamSize: number;
  excludePaths: string[];
}

export interface GatewayConfig {
  port: number;
  host: string;
  logLevel: LogLevel;
  proxyEnabled: boolean;
  mcpEnabled: boolean;
  tracing: TracingConfig;
}

export interface MCPServerConfig {
  name: string;
  type: 'module' | 'external' | 'builtin';
  path?: string; // For module type
  command?: string; // For external type
  args?: string[]; // For external type
  config?: Record<string, any>; // Server-specific configuration
  enabled?: boolean; // Default true
}

export interface MCPServersConfig {
  enabled: boolean;
  serversPath: string; // Directory containing MCP server modules
  servers: MCPServerConfig[];
}

export interface MCPConfig {
  port: number;
  host: string;
  name: string;
  version: string;
  autostart: boolean;
  servers: MCPServersConfig;
}

export interface RegistryConfig {
  port: number;
  host: string;
}

export interface AugmentConfig {
  enabled: boolean;
  indexPath: string;
  include: string[];
  exclude: string[];
  maxFileSize: number; // in bytes
  realtimeUpdates: boolean;
}

export interface PhoenixConfig {
  port: number;
  host: string;
  enabled: boolean;
  autostart: boolean;
  pythonCommand?: string; // Optional override for Python command
  workingDir?: string; // PHOENIX_WORKING_DIR - directory for data storage
  grpcPort?: number; // PHOENIX_GRPC_PORT - gRPC trace collector port
  databaseUrl?: string; // PHOENIX_SQL_DATABASE_URL - custom database URL
  enablePrometheus?: boolean; // PHOENIX_ENABLE_PROMETHEUS - enable metrics
}

export interface Config {
  gateway: GatewayConfig;
  mcp: MCPConfig;
  registry: RegistryConfig;
  augment: AugmentConfig;
  phoenix: PhoenixConfig;
}

const defaultConfig: Config = {
  gateway: {
    port: 3000,
    host: 'localhost',
    logLevel: LogLevel.INFO,
    proxyEnabled: true,
    mcpEnabled: true,
    tracing: {
      enabled: true,
      detailedBodyCapture: false, // Disabled by default for performance
      detailedSSECapture: false, // Disabled by default for performance
      maxBodySize: 100 * 1024, // 100KB
      maxResponseSize: 100 * 1024, // 100KB
      maxStreamSize: 1 * 1024 * 1024, // 1MB
      excludePaths: ['/api/traces', '/api/augment', '/ws/', '/assets/', '/health', '/sse'],
    },
  },
  mcp: {
    port: 3001,
    host: 'localhost',
    name: 'Clay MCP Server',
    version: '1.0.0',
    autostart: true,
    servers: {
      enabled: true,
      serversPath: '.clay/mcp-servers',
      servers: [
        {
          name: 'augment',
          type: 'builtin',
          enabled: true,
        },
        // Example external server (commented out by default)
        // {
        //   name: 'filesystem',
        //   type: 'external',
        //   command: 'npx',
        //   args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()],
        //   enabled: false,
        // },
      ],
    },
  },
  registry: {
    port: 3002,
    host: 'localhost',
  },
  augment: {
    enabled: true,
    indexPath: '.clay/index',
    include: ['**/*.{js,ts,jsx,tsx,py,java,c,cpp,go,rs}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
    maxFileSize: 1000000, // 1MB
    realtimeUpdates: true,
  },
  phoenix: {
    port: 6006,
    host: 'localhost',
    enabled: true,
    autostart: false, // Don't autostart by default
    pythonCommand: undefined, // Use system Python detection
    workingDir: undefined, // Use default Phoenix working directory (~/.phoenix)
    grpcPort: 4317, // Default gRPC port for trace collection
    databaseUrl: undefined, // Use default SQLite database
    enablePrometheus: false, // Disable Prometheus metrics by default
  },
};

// Initialize config with default values
let config: Config = { ...defaultConfig };

// Path to the config file
const configDir = path.join(os.homedir(), '.clay');
const configPath = path.join(configDir, 'config.yaml');

/**
 * Load configuration from YAML file
 */
export function loadConfigFromFile(): void {
  try {
    // Create config directory if it doesn't exist
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
      logger.info(`Created config directory: ${configDir}`);
    }

    // Check if config file exists
    if (!fs.existsSync(configPath)) {
      // Create default config file
      fs.writeFileSync(configPath, yaml.dump(defaultConfig));
      logger.info(`Created default config file: ${configPath}`);
      return;
    }

    // Read config file
    const fileContent = fs.readFileSync(configPath, 'utf8');
    const fileConfig = yaml.load(fileContent) as Partial<Config>;

    // Update config with values from file
    updateConfig(fileConfig);
    logger.info(`Loaded configuration from ${configPath}`);
  } catch (error) {
    logger.error(`Failed to load configuration from ${configPath}:`, error);
    logger.info('Using default configuration');
  }
}

// Load configuration from file when module is imported
loadConfigFromFile();

/**
 * Get the current configuration
 */
export function getConfig(): Config {
  return config;
}

/**
 * Update the configuration and save to file
 */
export function updateConfig(newConfig: Partial<Config>): void {
  // Update in-memory config
  config = {
    ...config,
    ...newConfig,
    gateway: {
      ...config.gateway,
      ...(newConfig.gateway || {}),
    },
    mcp: {
      ...config.mcp,
      ...(newConfig.mcp || {}),
    },
    registry: {
      ...config.registry,
      ...(newConfig.registry || {}),
    },
    augment: {
      ...config.augment,
      ...(newConfig.augment || {}),
    },
    phoenix: {
      ...config.phoenix,
      ...(newConfig.phoenix || {}),
    },
  };

  // Save to file
  try {
    fs.writeFileSync(configPath, yaml.dump(config));
    logger.info(`Saved configuration to ${configPath}`);
  } catch (error) {
    logger.error(`Failed to save configuration to ${configPath}:`, error);
  }
}
