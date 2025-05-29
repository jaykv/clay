import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { getConfig } from '../utils/config';
import { logger } from '../utils/logger';
import { setPhoenixServerInstance, getPhoenixServerInstance } from '../utils/server-bridge';
import { killProcessByPort } from '../utils/port';

let phoenixProcess: ChildProcess | null = null;

/**
 * Phoenix Server Manager
 * Manages the lifecycle of the Arize Phoenix server process
 */
export class PhoenixServer {
  private process: ChildProcess | null = null;
  private config = getConfig().phoenix;

  constructor() {
    // No need to find .pyz file - we'll use pip to install Phoenix
  }

  /**
   * Find Python command to use (similar to MCP extension logic)
   */
  private findPythonCommand(): string {
    // Use configured Python command if provided
    if (this.config.pythonCommand) {
      return this.config.pythonCommand;
    }

    // Check for virtual environment in .clay/mcp (reuse MCP venv if available)
    const clayMcpPath = path.join(process.cwd(), '.clay', 'mcp');
    const venvPath = path.join(clayMcpPath, '.venv');

    if (fs.existsSync(venvPath)) {
      const venvPython = process.platform === 'win32'
        ? path.join(venvPath, 'Scripts', 'python.exe')
        : path.join(venvPath, 'bin', 'python');

      if (fs.existsSync(venvPython)) {
        logger.info(`Using virtual environment Python for Phoenix: ${venvPython}`);
        return venvPython;
      }
    }

    // Fall back to system Python
    return process.platform === 'win32' ? 'python.exe' : 'python';
  }

  /**
   * Find the Phoenix .pyz file in the extension bundle
   */
  private findPhoenixPyz(): string {
    const extensionRoot = process.env.CLAY_EXTENSION_ROOT;
    if (!extensionRoot) {
      throw new Error('CLAY_EXTENSION_ROOT environment variable not set');
    }

    // Look for phoenix.pyz in the extension root and dist directories
    const possiblePaths = [
      path.join(extensionRoot, 'phoenix.pyz'),
      path.join(extensionRoot, 'dist', 'phoenix.pyz'),
      path.join(extensionRoot, 'resources', 'phoenix.pyz'),
    ];

    for (const phoenixPath of possiblePaths) {
      if (fs.existsSync(phoenixPath)) {
        logger.info(`Found Phoenix .pyz at: ${phoenixPath}`);
        return phoenixPath;
      }
    }

    throw new Error(`Phoenix .pyz file not found. Searched paths: ${possiblePaths.join(', ')}`);
  }

  /**
   * Start the Phoenix server
   */
  public async start(): Promise<void> {
    if (this.process) {
      logger.warn('Phoenix server is already running');
      return;
    }

    try {
      const pythonCommand = this.findPythonCommand();
      const phoenixPyzPath = this.findPhoenixPyz();
      const args = [phoenixPyzPath, 'serve'];

      // Phoenix uses environment variables for configuration, not command line args
      const phoenixEnv: Record<string, string> = {
        ...process.env,
        // Phoenix server configuration via environment variables
        PHOENIX_HOST: this.config.host,
        PHOENIX_PORT: this.config.port.toString(),
        PHOENIX_GRPC_PORT: (this.config.grpcPort || 4317).toString(),
      };

      // Add optional configuration via environment variables
      if (this.config.workingDir) {
        phoenixEnv.PHOENIX_WORKING_DIR = this.config.workingDir;
      }

      if (this.config.databaseUrl) {
        phoenixEnv.PHOENIX_SQL_DATABASE_URL = this.config.databaseUrl;
      }

      if (this.config.enablePrometheus) {
        phoenixEnv.PHOENIX_ENABLE_PROMETHEUS = 'true';
      }

      logger.info(`Starting Phoenix server with command: ${pythonCommand} ${args.join(' ')}`);
      logger.info(`Phoenix environment: PHOENIX_HOST=${phoenixEnv.PHOENIX_HOST}, PHOENIX_PORT=${phoenixEnv.PHOENIX_PORT}`);

      this.process = spawn(pythonCommand, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: phoenixEnv,
      });

      // Handle process output
      this.process.stdout?.on('data', (data) => {
        const output = data.toString().trim();
        if (output) {
          logger.info(`Phoenix stdout: ${output}`);
        }
      });

      this.process.stderr?.on('data', (data) => {
        const output = data.toString().trim();
        if (output) {
          logger.warn(`Phoenix stderr: ${output}`);
        }
      });

      // Handle process exit
      this.process.on('exit', (code, signal) => {
        logger.info(`Phoenix process exited with code ${code} and signal ${signal}`);
        this.process = null;
      });

      this.process.on('error', (error) => {
        logger.error('Phoenix process error:', error);
        this.process = null;
      });

      // Wait a moment for the process to start
      await new Promise(resolve => setTimeout(resolve, 2000));

      if (this.process && !this.process.killed) {
        logger.info(`Phoenix server started successfully on http://${this.config.host}:${this.config.port}`);
      } else {
        throw new Error('Phoenix server failed to start');
      }
    } catch (error) {
      logger.error('Failed to start Phoenix server:', error);
      this.process = null;
      throw error;
    }
  }

  /**
   * Stop the Phoenix server
   */
  public async stop(): Promise<void> {
    if (!this.process) {
      logger.warn('Phoenix server is not running');
      return;
    }

    try {
      logger.info(`Stopping Phoenix server (PID: ${this.process.pid})...`);

      const processToKill = this.process;

      // Try graceful shutdown first
      processToKill.kill('SIGTERM');

      // Wait for graceful shutdown
      const stopped = await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          logger.warn('Phoenix server did not stop gracefully within 5 seconds, forcing shutdown');
          if (processToKill && !processToKill.killed) {
            try {
              processToKill.kill('SIGKILL');
              logger.info('Sent SIGKILL to Phoenix process');
            } catch (killError) {
              logger.error('Error sending SIGKILL:', killError);
            }
          }
          resolve(false); // Indicate forced shutdown
        }, 5000);

        processToKill.on('exit', (code, signal) => {
          clearTimeout(timeout);
          logger.info(`Phoenix process exited with code ${code} and signal ${signal}`);
          resolve(true); // Indicate graceful shutdown
        });
      });

      this.process = null;

      if (stopped) {
        logger.info('Phoenix server stopped gracefully');
      } else {
        logger.info('Phoenix server stopped (forced)');
      }
    } catch (error) {
      logger.error('Failed to stop Phoenix server:', error);
      this.process = null; // Clear reference even on error
      throw error;
    }
  }

  /**
   * Check if Phoenix server is running
   */
  public isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }

  /**
   * Get server status
   */
  public getStatus(): { running: boolean; pid?: number; port: number; host: string } {
    return {
      running: this.isRunning(),
      pid: this.process?.pid,
      port: this.config.port,
      host: this.config.host,
    };
  }
}

/**
 * Start the Phoenix server
 */
export async function startPhoenixServer(): Promise<PhoenixServer> {
  try {
    const config = getConfig().phoenix;

    if (!config.enabled) {
      throw new Error('Phoenix server is disabled in configuration');
    }

    // Check if server is already running
    const existingServer = getPhoenixServerInstance();
    if (existingServer && existingServer.isRunning()) {
      logger.info('Phoenix server is already running');
      return existingServer;
    }

    // Create and start a new server
    const newServer = new PhoenixServer();
    await newServer.start();

    // Set the global reference
    setPhoenixServerInstance(newServer);

    logger.info(`Phoenix server is running on http://${config.host}:${config.port}`);

    return newServer;
  } catch (error) {
    logger.error('Failed to start Phoenix server:', error);
    throw error;
  }
}

/**
 * Stop the Phoenix server
 */
export async function stopPhoenixServer(force: boolean = false): Promise<void> {
  try {
    const config = getConfig().phoenix;

    // If we have a server instance, try to stop it
    const serverInstance = getPhoenixServerInstance();
    if (serverInstance) {
      logger.info('Stopping Phoenix server instance...');
      await serverInstance.stop();
      // Clear the global reference
      setPhoenixServerInstance(null);
      logger.info('Phoenix server instance stopped');
      return;
    }

    // If no instance but force is requested, try to kill any running process
    if (force) {
      logger.info('Force stopping any running Phoenix processes...');
      try {
        const killed = await killProcessByPort(config.port, config.host, 'phoenix', true);
        if (killed) {
          logger.info(`Forcefully killed Phoenix process on port ${config.port}`);
        } else {
          logger.info(`No Phoenix process found running on port ${config.port}`);
        }
      } catch (error) {
        logger.error('Error during force stop:', error);
      }
    }

    logger.info('No Phoenix server instance to stop');
  } catch (error) {
    logger.error('Failed to stop Phoenix server:', error);
    throw error;
  }
}

/**
 * Check if Phoenix server is running
 */
export async function isPhoenixServerRunning(): Promise<boolean> {
  const config = getConfig().phoenix;
  const { isPhoenixServer } = await import('../utils/port');

  // First check if there's actually a Phoenix server running on the configured port
  const isRunning = await isPhoenixServer(config.port, config.host);

  // If the server is not running but we have an instance reference, clear it
  const phoenixServerInstance = getPhoenixServerInstance();
  if (!isRunning && phoenixServerInstance !== null) {
    logger.warn(
      'Phoenix server instance reference exists but server is not running. Clearing reference.'
    );
    setPhoenixServerInstance(null);
    return false;
  }

  // If the server is running but we don't have an instance reference, that's fine
  // The dashboard will still show it as running based on the health check

  return isRunning;
}
