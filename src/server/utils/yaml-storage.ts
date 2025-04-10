import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'js-yaml';
import { logger } from './logger';

/**
 * YAML Storage utility for persisting data to disk
 */
export class YAMLStorage {
  private configPath: string;
  private data: Record<string, any> = {};

  /**
   * Create a new YAML storage instance
   * @param configFile The config file name (default: config.yaml)
   */
  constructor(configFile: string = 'config.yaml') {
    // Create base path at ~/.clay
    const basePath = path.join(os.homedir(), '.clay');
    this.configPath = path.join(basePath, configFile);

    logger.info(`YAML Storage initialized with config path: ${this.configPath}`);

    // Ensure the directory exists
    this.ensureDirectory(basePath);

    // Load the config file
    this.loadConfig();
  }

  /**
   * Ensure the storage directory exists
   */
  private ensureDirectory(dirPath: string): void {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        logger.info(`Created storage directory: ${dirPath}`);
      }
    } catch (error) {
      logger.error(`Failed to create storage directory: ${dirPath}`, error);
      throw new Error(`Failed to create storage directory: ${error}`);
    }
  }

  /**
   * Load the config file
   */
  private loadConfig(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const fileContent = fs.readFileSync(this.configPath, 'utf-8');
        const parsedData = yaml.load(fileContent);

        if (parsedData && typeof parsedData === 'object') {
          this.data = parsedData as Record<string, any>;
          logger.info(`Loaded config from ${this.configPath}`);
        } else {
          logger.warn(`Config file ${this.configPath} is empty or invalid, using defaults`);
          this.data = {};
        }
      } else {
        logger.info(`Config file ${this.configPath} does not exist, using defaults`);
        this.data = {};
      }
    } catch (error) {
      logger.error(`Failed to load config from ${this.configPath}:`, error);
      this.data = {};
    }
  }

  /**
   * Save the config file
   */
  private saveConfig(): boolean {
    try {
      const yamlStr = yaml.dump(this.data, {
        indent: 2,
        lineWidth: 120,
        noRefs: true
      });

      fs.writeFileSync(this.configPath, yamlStr, 'utf-8');
      logger.debug(`Saved config to ${this.configPath}`);
      return true;
    } catch (error) {
      logger.error(`Failed to save config to ${this.configPath}:`, error);
      return false;
    }
  }

  /**
   * Get a value from the config
   * @param key The key to get
   * @param defaultValue The default value if the key doesn't exist
   * @returns The value or the default value
   */
  public get<T>(key: string, defaultValue: T): T {
    return (this.data[key] as T) ?? defaultValue;
  }

  /**
   * Set a value in the config
   * @param key The key to set
   * @param value The value to set
   * @returns True if successful, false otherwise
   */
  public set<T>(key: string, value: T): boolean {
    this.data[key] = value;
    return this.saveConfig();
  }

  /**
   * Check if a key exists in the config
   * @param key The key to check
   * @returns True if the key exists, false otherwise
   */
  public has(key: string): boolean {
    return key in this.data;
  }

  /**
   * Delete a key from the config
   * @param key The key to delete
   * @returns True if successful, false otherwise
   */
  public delete(key: string): boolean {
    if (key in this.data) {
      delete this.data[key];
      return this.saveConfig();
    }
    return false;
  }

  /**
   * Get all keys in the config
   * @returns Array of keys
   */
  public keys(): string[] {
    return Object.keys(this.data);
  }

  /**
   * Get the entire config data
   * @returns The config data
   */
  public getAll(): Record<string, any> {
    return { ...this.data };
  }
}

// Create a default storage instance
export const yamlStorage = new YAMLStorage();
