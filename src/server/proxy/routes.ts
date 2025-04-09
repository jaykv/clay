import { logger } from '../utils/logger';

// Type definition for proxy routes
export interface ProxyRoute {
  path: string;
  target: string;
  description?: string;
  createdAt: number;
}

// In-memory storage for proxy routes
// In a production app, this would be replaced with a persistent storage
const proxyRoutes: Map<string, ProxyRoute> = new Map();

// Add a default route
proxyRoutes.set('ai', {
  path: 'ai',
  target: 'http://localhost:3001',
  description: 'Default AI service route',
  createdAt: Date.now()
});

// Get all proxy routes
export function getProxyRoutes(): ProxyRoute[] {
  return Array.from(proxyRoutes.values());
}

// Get a specific proxy route by path
export function getProxyRoute(path: string): ProxyRoute | undefined {
  return proxyRoutes.get(path);
}

// Add or update a proxy route
export function setProxyRoute(path: string, target: string, description?: string): ProxyRoute {
  const route: ProxyRoute = {
    path,
    target,
    description,
    createdAt: proxyRoutes.get(path)?.createdAt || Date.now()
  };
  
  proxyRoutes.set(path, route);
  logger.info(`Proxy route set: ${path} -> ${target}`);
  return route;
}

// Delete a proxy route
export function deleteProxyRoute(path: string): boolean {
  const result = proxyRoutes.delete(path);
  if (result) {
    logger.info(`Proxy route deleted: ${path}`);
  }
  return result;
}

// Find the best matching route for a given path
export function findMatchingRoute(requestPath: string): ProxyRoute | undefined {
  // Remove leading slash if present
  const normalizedPath = requestPath.startsWith('/') ? requestPath.substring(1) : requestPath;
  
  // First, try exact match
  for (const [path, route] of proxyRoutes.entries()) {
    if (normalizedPath === path) {
      return route;
    }
  }
  
  // Then, try prefix match (longest prefix first)
  const sortedPaths = Array.from(proxyRoutes.keys())
    .sort((a, b) => b.length - a.length);
  
  for (const path of sortedPaths) {
    if (normalizedPath.startsWith(path + '/')) {
      return proxyRoutes.get(path);
    }
  }
  
  return undefined;
}
