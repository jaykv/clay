import { exec } from 'child_process';
import { promisify } from 'util';
import fetch from 'node-fetch';
import { logger } from './logger';

const execAsync = promisify(exec);

/**
 * Find the process ID (PID) using a specific port
 * @param port Port to check
 * @returns Promise that resolves to the PID or null if not found
 */
export async function findProcessIdByPort(port: number): Promise<number | null> {
  try {
    // Use different commands based on the platform
    const cmd =
      process.platform === 'win32' ? `netstat -ano | findstr :${port}` : `lsof -i :${port} -t`;

    const { stdout } = await execAsync(cmd);

    if (!stdout.trim()) {
      return null;
    }

    // Parse the output to get the PID
    if (process.platform === 'win32') {
      // Windows netstat output format: "  TCP    127.0.0.1:3001         0.0.0.0:0              LISTENING       12345"
      const lines = stdout.split('\n');
      for (const line of lines) {
        if (line.includes(`${port}`) && line.includes('LISTENING')) {
          const parts = line.trim().split(/\s+/);
          const pid = parseInt(parts[parts.length - 1], 10);
          return isNaN(pid) ? null : pid;
        }
      }
    } else {
      // Unix lsof output is just the PID
      const pid = parseInt(stdout.trim().split('\n')[0], 10);
      return isNaN(pid) ? null : pid;
    }

    return null;
  } catch (error) {
    logger.error(`Error finding process using port ${port}:`, error);
    return null;
  }
}

/**
 * Check if a server running on a specific port is an MCP server
 * @param port Port to check
 * @param host Host to check
 * @returns Promise that resolves to true if it's an MCP server, false otherwise
 */
export async function isMCPServer(port: number, host: string = 'localhost'): Promise<boolean> {
  try {
    // Try to access the /health endpoint which should be available on MCP servers
    const response = await fetch(`http://${host}:${port}/health`, {
      method: 'GET',
      timeout: 2000, // 2 second timeout
    });

    if (response.ok) {
      const data = await response.json();
      // Check if it has the expected format for an MCP server health response
      if (data && data.status === 'ok') {
        logger.info(`Server on port ${port} appears to be an MCP server`);
        return true;
      }
    }

    logger.info(`Server on port ${port} does not appear to be an MCP server`);
    return false;
  } catch (error) {
    logger.debug(`Error checking if server on port ${port} is an MCP server:`, error);
    return false;
  }
}

/**
 * Check if a server running on a specific port is a Gateway server
 * @param port Port to check
 * @param host Host to check
 * @returns Promise that resolves to true if it's a Gateway server, false otherwise
 */
export async function isGatewayServer(port: number, host: string = 'localhost'): Promise<boolean> {
  try {
    // Try to access the /api/health endpoint which should be available on Gateway servers
    const response = await fetch(`http://${host}:${port}/api/health`, {
      method: 'GET',
      timeout: 2000, // 2 second timeout
    });

    if (response.ok) {
      const data = await response.json();
      // Check if it has the expected format for a Gateway server health response
      if (data && data.status === 'ok') {
        logger.info(`Server on port ${port} appears to be a Gateway server`);
        return true;
      }
    }

    logger.info(`Server on port ${port} does not appear to be a Gateway server`);
    return false;
  } catch (error) {
    logger.debug(`Error checking if server on port ${port} is a Gateway server:`, error);
    return false;
  }
}

/**
 * Check if a server running on a specific port is a Phoenix server
 * @param port Port to check
 * @param host Host to check
 * @returns Promise that resolves to true if it's a Phoenix server, false otherwise
 */
export async function isPhoenixServer(port: number, host: string = 'localhost'): Promise<boolean> {
  try {
    // Try to access the root endpoint which should return Phoenix UI
    const response = await fetch(`http://${host}:${port}/`, {
      method: 'GET',
      timeout: 2000, // 2 second timeout
    });

    if (response.ok) {
      const text = await response.text();
      // Check if the response contains Phoenix-specific content
      if (text.includes('Phoenix') || text.includes('Arize')) {
        logger.info(`Server on port ${port} appears to be a Phoenix server`);
        return true;
      }
    }

    logger.info(`Server on port ${port} does not appear to be a Phoenix server`);
    return false;
  } catch (error) {
    logger.debug(`Error checking if server on port ${port} is a Phoenix server:`, error);
    return false;
  }
}

/**
 * Kill the process using a specific port, but only if it's a known server type
 * @param port Port to check
 * @param host Host to check
 * @param serverType The type of server to check for ('mcp', 'gateway', or 'any')
 * @param forceKill If true, kill the process even if it's not the specified server type
 * @returns Promise that resolves to true if the process was killed, false otherwise
 */
export async function killProcessByPort(
  port: number,
  host: string = 'localhost',
  serverType: 'mcp' | 'gateway' | 'phoenix' | 'any' = 'any',
  forceKill: boolean = false
): Promise<boolean> {
  try {
    const pid = await findProcessIdByPort(port);

    if (!pid) {
      logger.warn(`No process found using port ${port}`);
      return false;
    }

    // Only check server type if forceKill is false
    if (!forceKill && serverType !== 'any') {
      let isKnownServer = false;

      if (serverType === 'mcp') {
        // Check if it's an MCP server
        isKnownServer = await isMCPServer(port, host);
        if (!isKnownServer) {
          logger.warn(`Process ${pid} on port ${port} is not an MCP server. Not killing it.`);
          return false;
        }
      } else if (serverType === 'gateway') {
        // Check if it's a Gateway server
        isKnownServer = await isGatewayServer(port, host);
        if (!isKnownServer) {
          logger.warn(`Process ${pid} on port ${port} is not a Gateway server. Not killing it.`);
          return false;
        }
      } else if (serverType === 'phoenix') {
        // Check if it's a Phoenix server
        isKnownServer = await isPhoenixServer(port, host);
        if (!isKnownServer) {
          logger.warn(`Process ${pid} on port ${port} is not a Phoenix server. Not killing it.`);
          return false;
        }
      }
    }

    logger.info(`Killing process ${pid} using port ${port}`);

    // Use different commands based on the platform
    const cmd = process.platform === 'win32' ? `taskkill /F /PID ${pid}` : `kill -9 ${pid}`;

    await execAsync(cmd);
    logger.info(`Successfully killed process ${pid}`);
    return true;
  } catch (error) {
    logger.error(`Error killing process using port ${port}:`, error);
    return false;
  }
}
