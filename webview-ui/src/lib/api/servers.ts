/**
 * API functions for interacting with the servers
 */

/**
 * Check if a server is running by calling its health endpoint
 * @param url The URL of the server's health endpoint
 * @returns Promise that resolves to true if the server is running, false otherwise
 */
export async function checkServerHealth(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      // Add a timeout to avoid hanging if the server is not responding
      signal: AbortSignal.timeout(2000),
    });

    if (response.ok) {
      const data = await response.json();
      return data.status === 'ok';
    }

    return false;
  } catch (error) {
    console.error(`Error checking server health at ${url}:`, error);
    return false;
  }
}

/**
 * Stop a server by calling its admin/stopServer endpoint
 * @param url The URL of the server's admin/stopServer endpoint
 * @returns Promise that resolves to true if the request was successful, false otherwise
 */
export async function stopServer(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      // Include an empty object as the request body to satisfy content-type requirements
      body: JSON.stringify({}),
      // Add a timeout to avoid hanging if the server is not responding
      signal: AbortSignal.timeout(2000),
    });

    if (response.ok) {
      const data = await response.json();
      return data.status === 'stopping';
    }

    return false;
  } catch (error) {
    console.error(`Error stopping server at ${url}:`, error);
    return false;
  }
}
