import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { RegistryStorage, MCPServerInfo } from './storage';
import { logger } from '../utils/logger';
import { getConfig } from '../utils/config';

export class RegistryServer {
  private app: Hono;
  private storage: RegistryStorage;
  private config = getConfig().registry;

  constructor() {
    this.storage = new RegistryStorage();
    this.app = new Hono();
    this.setupMiddleware();
    this.setupRoutes();
    this.startCleanupInterval();
  }

  private setupMiddleware() {
    // Enable CORS
    this.app.use('*', cors());
    
    // Add error handling middleware
    this.app.onError((err, c) => {
      logger.error('Registry server error:', err);
      return c.json({
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      }, 500);
    });
  }

  private setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (c) => {
      return c.json({ status: 'ok' });
    });
    
    // Get all registered servers
    this.app.get('/api/servers', (c) => {
      const servers = this.storage.getAllServers();
      return c.json({ servers });
    });
    
    // Get a specific server by ID
    this.app.get('/api/servers/:id', (c) => {
      const id = c.req.param('id');
      const server = this.storage.getServerById(id);
      
      if (!server) {
        return c.json({ error: 'Server not found' }, 404);
      }
      
      return c.json({ server });
    });
    
    // Register a new server
    this.app.post('/api/servers', async (c) => {
      const body = await c.req.json<Omit<MCPServerInfo, 'id' | 'registeredAt' | 'lastSeenAt'>>();
      
      if (!body.name || !body.url) {
        return c.json({ error: 'Missing required fields: name, url' }, 400);
      }
      
      const server = this.storage.registerServer(body);
      return c.json({ server }, 201);
    });
    
    // Update a server
    this.app.put('/api/servers/:id', async (c) => {
      const id = c.req.param('id');
      const body = await c.req.json<Partial<Omit<MCPServerInfo, 'id' | 'registeredAt'>>>();
      
      const server = this.storage.updateServer(id, body);
      
      if (!server) {
        return c.json({ error: 'Server not found' }, 404);
      }
      
      return c.json({ server });
    });
    
    // Remove a server
    this.app.delete('/api/servers/:id', (c) => {
      const id = c.req.param('id');
      const success = this.storage.removeServer(id);
      
      if (!success) {
        return c.json({ error: 'Server not found' }, 404);
      }
      
      return c.json({ success: true });
    });
    
    // Server heartbeat
    this.app.post('/api/servers/:id/heartbeat', (c) => {
      const id = c.req.param('id');
      const success = this.storage.heartbeat(id);
      
      if (!success) {
        return c.json({ error: 'Server not found' }, 404);
      }
      
      return c.json({ success: true });
    });
  }

  private startCleanupInterval() {
    // Clean up stale servers every hour
    setInterval(() => {
      const removed = this.storage.cleanupStaleServers();
      if (removed > 0) {
        logger.info(`Cleaned up ${removed} stale MCP servers`);
      }
    }, 60 * 60 * 1000);
  }

  public getApp() {
    return this.app;
  }
}

export default RegistryServer;
