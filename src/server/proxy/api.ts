import { Hono } from 'hono';
import { getProxyRoutes, setProxyRoute, deleteProxyRoute } from './routes';
import { logger } from '../utils/logger';

/**
 * Create API routes for managing proxy routes
 * @returns Hono app with proxy routes API
 */
export function createProxyRoutesAPI(): Hono {
  const app = new Hono();

  // Get all proxy routes
  app.get('/api/proxy/routes', (c) => {
    return c.json(getProxyRoutes());
  });

  // Add or update a proxy route
  app.post('/api/proxy/routes', async (c) => {
    try {
      const { path, target, description } = await c.req.json();
      
      if (!path || !target) {
        return c.json({ error: 'Path and target are required' }, 400);
      }
      
      // Validate path format
      if (!/^[a-zA-Z0-9_\\-\\/]+$/.test(path)) {
        return c.json({ error: 'Path can only contain alphanumeric characters, underscores, hyphens, and slashes' }, 400);
      }
      
      // Validate target URL
      try {
        new URL(target);
      } catch (e) {
        return c.json({ error: 'Target must be a valid URL' }, 400);
      }
      
      const route = setProxyRoute(path, target, description);
      return c.json(route, 201);
    } catch (error) {
      logger.error('Failed to add proxy route:', error);
      return c.json({ error: 'Failed to add proxy route' }, 500);
    }
  });

  // Delete a proxy route
  app.delete('/api/proxy/routes/:path', (c) => {
    const path = c.req.param('path');
    const deleted = deleteProxyRoute(path);
    
    if (deleted) {
      return c.json({ success: true });
    } else {
      return c.json({ error: 'Route not found' }, 404);
    }
  });

  return app;
}
