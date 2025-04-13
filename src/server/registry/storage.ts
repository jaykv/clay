import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';

export interface MCPServerInfo {
  id: string;
  name: string;
  url: string;
  description?: string;
  version?: string;
  capabilities?: string[];
  registeredAt: number;
  lastSeenAt: number;
}

export class RegistryStorage {
  private storagePath: string;
  private servers: Record<string, MCPServerInfo> = {};

  constructor(storagePath: string = path.join(process.cwd(), 'data', 'registry')) {
    this.storagePath = storagePath;
    this.ensureStorageDirectory();
    this.loadServers();
  }

  private ensureStorageDirectory() {
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
      logger.info(`Created registry storage directory: ${this.storagePath}`);
    }
  }

  private getServersFilePath() {
    return path.join(this.storagePath, 'servers.json');
  }

  private loadServers() {
    const filePath = this.getServersFilePath();

    if (fs.existsSync(filePath)) {
      try {
        const data = fs.readFileSync(filePath, 'utf-8');
        this.servers = JSON.parse(data);
        logger.info(`Loaded ${Object.keys(this.servers).length} MCP servers from storage`);
      } catch (error) {
        logger.error('Failed to load MCP servers from storage:', error);
        this.servers = {};
      }
    } else {
      logger.info('No existing MCP servers found in storage');
      this.servers = {};
    }
  }

  private saveServers() {
    const filePath = this.getServersFilePath();

    try {
      fs.writeFileSync(filePath, JSON.stringify(this.servers, null, 2), 'utf-8');
      logger.debug('Saved MCP servers to storage');
    } catch (error) {
      logger.error('Failed to save MCP servers to storage:', error);
    }
  }

  public getAllServers(): MCPServerInfo[] {
    return Object.values(this.servers);
  }

  public getServerById(id: string): MCPServerInfo | undefined {
    return this.servers[id];
  }

  public registerServer(
    server: Omit<MCPServerInfo, 'id' | 'registeredAt' | 'lastSeenAt'>
  ): MCPServerInfo {
    const id = Math.random().toString(36).substring(2, 15);
    const now = Date.now();

    const serverInfo: MCPServerInfo = {
      id,
      ...server,
      registeredAt: now,
      lastSeenAt: now,
    };

    this.servers[id] = serverInfo;
    this.saveServers();

    logger.info(`Registered new MCP server: ${server.name} (${id})`);
    return serverInfo;
  }

  public updateServer(
    id: string,
    updates: Partial<Omit<MCPServerInfo, 'id' | 'registeredAt'>>
  ): MCPServerInfo | undefined {
    const server = this.servers[id];

    if (!server) {
      return undefined;
    }

    const updatedServer: MCPServerInfo = {
      ...server,
      ...updates,
      lastSeenAt: Date.now(),
    };

    this.servers[id] = updatedServer;
    this.saveServers();

    logger.info(`Updated MCP server: ${server.name} (${id})`);
    return updatedServer;
  }

  public removeServer(id: string): boolean {
    if (!this.servers[id]) {
      return false;
    }

    const serverName = this.servers[id].name;
    delete this.servers[id];
    this.saveServers();

    logger.info(`Removed MCP server: ${serverName} (${id})`);
    return true;
  }

  public heartbeat(id: string): boolean {
    const server = this.servers[id];

    if (!server) {
      return false;
    }

    server.lastSeenAt = Date.now();
    this.saveServers();

    return true;
  }

  public cleanupStaleServers(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
    const now = Date.now();
    const staleIds = Object.keys(this.servers).filter(id => {
      const server = this.servers[id];
      return now - server.lastSeenAt > maxAgeMs;
    });

    staleIds.forEach(id => {
      logger.info(`Removing stale MCP server: ${this.servers[id].name} (${id})`);
      delete this.servers[id];
    });

    if (staleIds.length > 0) {
      this.saveServers();
    }

    return staleIds.length;
  }
}

export default RegistryStorage;
