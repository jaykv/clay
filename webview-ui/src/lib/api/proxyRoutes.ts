// API client for the proxy routes

export interface ProxyRoute {
  path: string;
  target: string;
  description?: string;
}

// Use relative URLs when accessed directly via the proxy server
// or absolute URLs when in VS Code webview
const API_BASE_URL = typeof window.acquireVsCodeApi === 'function'
  ? 'http://localhost:3000'
  : '';

/**
 * Get all proxy routes
 * @returns Promise with the list of proxy routes
 */
export async function getProxyRoutes(): Promise<ProxyRoute[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/proxy/routes`);
    if (!response.ok) {
      throw new Error(`Failed to fetch proxy routes: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching proxy routes:', error);
    throw error;
  }
}

/**
 * Add or update a proxy route
 * @param route The route to add or update
 * @returns Promise with the added/updated route
 */
export async function addProxyRoute(route: ProxyRoute): Promise<ProxyRoute> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/proxy/routes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(route),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to add proxy route: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error adding proxy route:', error);
    throw error;
  }
}

/**
 * Delete a proxy route
 * @param path The path of the route to delete
 * @returns Promise with the success status
 */
export async function deleteProxyRoute(path: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/proxy/routes/${encodeURIComponent(path)}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to delete proxy route: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error('Error deleting proxy route:', error);
    throw error;
  }
}
