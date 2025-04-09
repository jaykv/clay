import { LogLevel } from './logger';

export interface ProxyConfig {
  port: number;
  host: string;
  logLevel: LogLevel;
  dashboardEnabled: boolean;
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

export interface Config {
  proxy: ProxyConfig;
  mcp: MCPConfig;
  registry: RegistryConfig;
}

const defaultConfig: Config = {
  proxy: {
    port: 3000,
    host: 'localhost',
    logLevel: LogLevel.INFO,
    dashboardEnabled: true
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
    }
  };
}
