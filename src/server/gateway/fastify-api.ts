import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  getProxyRoutes,
  getProxyRoute,
  setProxyRoute,
  deleteProxyRoute,
  reinitializeRoutes,
} from './routes';
import { logger } from '../utils/logger';

/**
 * Register the proxy routes API with Fastify
 */
export function registerProxyRoutesAPI(fastify: FastifyInstance, options: any, done: () => void) {
  // Get all proxy routes
  fastify.get('/api/proxy/routes', async (request, reply) => {
    try {
      const routes = getProxyRoutes();
      return { routes };
    } catch (error) {
      logger.error('Failed to get proxy routes:', error);
      return reply.status(500).send({ error: 'Failed to get proxy routes' });
    }
  });

  // Get a specific proxy route
  fastify.get<{
    Params: { path: string };
  }>('/api/proxy/routes/:path', async (request, reply) => {
    try {
      const path = request.params.path;
      const route = getProxyRoute(path);

      if (!route) {
        return reply.status(404).send({ error: 'Proxy route not found' });
      }

      return { route };
    } catch (error) {
      logger.error('Failed to get proxy route:', error);
      return reply.status(500).send({ error: 'Failed to get proxy route' });
    }
  });

  // Create or update a proxy route
  fastify.post<{
    Body: {
      path: string;
      target: string;
      description?: string;
    };
  }>('/api/proxy/routes', async (request, reply) => {
    try {
      const { path, target, description } = request.body;

      if (!path || !target) {
        return reply.status(400).send({ error: 'Missing required fields: path, target' });
      }

      const route = setProxyRoute(path, target, description);
      return { route, success: true };
    } catch (error) {
      logger.error('Failed to set proxy route:', error);
      return reply.status(500).send({ error: 'Failed to set proxy route' });
    }
  });

  // Delete a proxy route
  fastify.delete<{
    Params: { path: string };
  }>('/api/proxy/routes/:path', async (request, reply) => {
    try {
      const path = request.params.path;
      const success = deleteProxyRoute(path);

      if (!success) {
        return reply.status(404).send({ error: 'Proxy route not found' });
      }

      return { success: true };
    } catch (error) {
      logger.error('Failed to delete proxy route:', error);
      return reply.status(500).send({ error: 'Failed to delete proxy route' });
    }
  });

  // Reinitialize routes from storage
  fastify.post('/api/proxy/routes/reinitialize', async (request, reply) => {
    try {
      reinitializeRoutes();
      const routes = getProxyRoutes();
      return { success: true, routes };
    } catch (error) {
      logger.error('Failed to reinitialize proxy routes:', error);
      return reply.status(500).send({ error: 'Failed to reinitialize proxy routes' });
    }
  });

  done();
}
