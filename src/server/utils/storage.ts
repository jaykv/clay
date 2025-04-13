import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { logger } from './logger';

/**
 * Storage utility for persisting data to disk
 */
export class Storage {
  private basePath: string;

  /**
   * Create a new storage instance
   * @param configDir The directory name under ~/.clay/
   */
  constructor(configDir: string = '') {
    // Create base path at ~/.clay
    this.basePath = path.join(os.homedir(), '.clay');

    // Add config subdirectory if specified
    if (configDir) {
      this.basePath = path.join(this.basePath, configDir);
    }

    // Ensure the directory exists
    this.ensureDirectory();
  }

  /**
   * Ensure the storage directory exists
   */
  private ensureDirectory(): void {
    try {
      if (!fs.existsSync(this.basePath)) {
        fs.mkdirSync(this.basePath, { recursive: true });
        logger.info(`Created storage directory: ${this.basePath}`);
      }
    } catch (error) {
      logger.error(`Failed to create storage directory: ${this.basePath}`, error);
      throw new Error(`Failed to create storage directory: ${error}`);
    }
  }

  /**
   * Get the full path to a file
   * @param filename The filename
   * @returns The full path
   */
  private getFilePath(filename: string): string {
    return path.join(this.basePath, filename);
  }

  /**
   * Read data from a file
   * @param filename The filename
   * @param defaultValue The default value if the file doesn't exist
   * @returns The parsed data or the default value
   */
  public read<T>(filename: string, defaultValue: T): T {
    const filePath = this.getFilePath(filename);

    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data) as T;
      }
    } catch (error) {
      logger.error(`Failed to read from ${filePath}:`, error);
    }

    return defaultValue;
  }

  /**
   * Write data to a file
   * @param filename The filename
   * @param data The data to write
   * @returns True if successful, false otherwise
   */
  public write<T>(filename: string, data: T): boolean {
    const filePath = this.getFilePath(filename);

    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      logger.debug(`Wrote data to ${filePath}`);
      return true;
    } catch (error) {
      logger.error(`Failed to write to ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Check if a file exists
   * @param filename The filename
   * @returns True if the file exists, false otherwise
   */
  public exists(filename: string): boolean {
    return fs.existsSync(this.getFilePath(filename));
  }

  /**
   * Delete a file
   * @param filename The filename
   * @returns True if successful, false otherwise
   */
  public delete(filename: string): boolean {
    const filePath = this.getFilePath(filename);

    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.debug(`Deleted ${filePath}`);
        return true;
      }
    } catch (error) {
      logger.error(`Failed to delete ${filePath}:`, error);
    }

    return false;
  }
}

// Create a default storage instance for the proxy routes
export const proxyStorage = new Storage('proxy');
