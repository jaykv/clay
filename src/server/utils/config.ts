import { LogLevel } from './logger';

export interface ProxyConfig {
  port: number;
  host: string;
  logLevel: LogLevel;
  dashboardEnabled: boolean;
  mcpEnabled: boolean;
}

export interface MCPConfig {
  port: number;
  host: string;
  name: string;
  version: string;
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

export interface Config {
  proxy: ProxyConfig;
  mcp: MCPConfig;
  registry: RegistryConfig;
  augment: AugmentConfig;
}

const defaultConfig: Config = {
  proxy: {
    port: 3000,
    host: 'localhost',
    logLevel: LogLevel.INFO,
    dashboardEnabled: true,
    mcpEnabled: true
  },
  mcp: {
    port: 3001,
    host: 'localhost',
    name: 'VSCode MCP Server',
    version: '1.0.0'
  },
  registry: {
    port: 3002,
    host: 'localhost'
  },
  augment: {
    enabled: true,
    indexPath: '.clay/index',
    include: [
      '**/*.{js,ts,jsx,tsx,py,java,c,cpp,go,rs}'
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.git/**'
    ],
    maxFileSize: 1000000, // 1MB
    realtimeUpdates: true
  }
};

let config: Config = { ...defaultConfig };

export function getConfig(): Config {
  return config;
}

export function updateConfig(newConfig: Partial<Config>): void {
  config = {
    ...config,
    ...newConfig,
    proxy: {
      ...config.proxy,
      ...(newConfig.proxy || {})
    },
    mcp: {
      ...config.mcp,
      ...(newConfig.mcp || {})
    },
    registry: {
      ...config.registry,
      ...(newConfig.registry || {})
    },
    augment: {
      ...config.augment,
      ...(newConfig.augment || {})
    }
  };
}
