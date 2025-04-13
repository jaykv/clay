import { logger } from '../utils/logger';
import { yamlStorage } from '../utils/yaml-storage';

// Type definition for proxy routes
export interface ProxyRoute {
  path: string;
  target: string;
  description?: string;
  createdAt: number;
}

// Storage key for proxy routes in YAML config
const PROXY_ROUTES_STORAGE_KEY = 'proxyRoutes';

// In-memory storage for proxy routes
// This will be synchronized with the YAML config file
const proxyRoutes: Map<string, ProxyRoute> = new Map();

// Initialize routes from storage or with defaults
logger.info('Initializing proxy routes from YAML storage');
initializeRoutes();

/**
 * Initialize routes from YAML storage or with defaults
 */
function initializeRoutes(): void {
  try {
    // Try to load routes from YAML storage
    const storedRoutes = yamlStorage.get<ProxyRoute[]>(PROXY_ROUTES_STORAGE_KEY, []);

    if (Array.isArray(storedRoutes) && storedRoutes.length > 0) {
      // Clear any existing routes
      proxyRoutes.clear();

      // Add stored routes to the map
      storedRoutes.forEach(route => {
        proxyRoutes.set(route.path, route);
      });

      logger.info(`Loaded ${storedRoutes.length} proxy routes from YAML config`);
      return;
    }

    // If no stored routes, add default route
    if (proxyRoutes.size === 0) {
      proxyRoutes.set('ai', {
        path: 'ai',
        target: 'http://localhost:3001',
        description: 'Default AI service route',
        createdAt: Date.now(),
      });

      // Save the default route to storage
      saveRoutesToStorage();
      logger.info('Initialized default proxy route');
    }
  } catch (error) {
    logger.error('Failed to initialize proxy routes:', error);

    // Ensure we have at least the default route
    if (proxyRoutes.size === 0) {
      proxyRoutes.set('ai', {
        path: 'ai',
        target: 'http://localhost:3001',
        description: 'Default AI service route',
        createdAt: Date.now(),
      });
    }
  }
}

/**
 * Save routes to YAML storage
 */
function saveRoutesToStorage(): void {
  try {
    const routesArray = Array.from(proxyRoutes.values());
    yamlStorage.set(PROXY_ROUTES_STORAGE_KEY, routesArray);
    logger.debug(`Saved ${routesArray.length} proxy routes to YAML config`);
  } catch (error) {
    logger.error('Failed to save proxy routes to storage:', error);
  }
}

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
    createdAt: proxyRoutes.get(path)?.createdAt || Date.now(),
  };

  proxyRoutes.set(path, route);
  saveRoutesToStorage();
  logger.info(`Proxy route set: ${path} -> ${target}`);
  return route;
}

// Delete a proxy route
export function deleteProxyRoute(path: string): boolean {
  const result = proxyRoutes.delete(path);
  if (result) {
    saveRoutesToStorage();
    logger.info(`Proxy route deleted: ${path}`);
  }
  return result;
}

/**
 * Reinitialize routes from storage
 */
export function reinitializeRoutes(): void {
  logger.info('Reinitializing proxy routes from storage');
  initializeRoutes();
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
  const sortedPaths = Array.from(proxyRoutes.keys()).sort((a, b) => b.length - a.length);

  for (const path of sortedPaths) {
    if (normalizedPath.startsWith(path + '/')) {
      return proxyRoutes.get(path);
    }
  }

  return undefined;
}
