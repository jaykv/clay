import * as path from 'path';
import * as os from 'os';
import { logger } from '../utils/logger';
import { getConfig } from '../utils/config';
import { CodeIndexer } from './indexer';
import { CodeSearch } from './search';
// We'll create a simple interface for the VSCodeAPI
interface IVSCodeAPI {
  initialize(context?: any): void;
  isAvailable(): boolean;
  getRootPath(): string;
  getWorkspaceFolders(): string[];
  searchWorkspace(query: string, maxResults?: number): Promise<SearchResult[]>;
  getDocumentSymbols(filePath: string): Promise<CodeSymbol[]>;
  getDefinition(filePath: string, line: number, character: number): Promise<CodeSymbol | undefined>;
  getReferences(filePath: string, line: number, character: number): Promise<CodeSymbol[]>;
  getFile(filePath: string): Promise<CodeFile | undefined>;
}

// Import VSCodeAPI only when running in VS Code
let VSCodeAPIClass: any;
try {
  VSCodeAPIClass = require('./vscode-api').VSCodeAPI;
} catch (error) {
  // VSCodeAPIClass is not available
  VSCodeAPIClass = undefined;
}
import { IndexStatus, SearchResult, CodeFile, CodeSymbol } from './models';

/**
 * Main class for the Augment Context Engine
 */
export class AugmentContextEngine {
  private static instance: AugmentContextEngine;
  private indexer: CodeIndexer;
  private search: CodeSearch;
  private vscodeAPI?: IVSCodeAPI;
  private config = getConfig().augment;
  private initialized = false;
  private useVSCode = false; // Will be set to true if VS Code API is available

  private constructor() {
    // Get the workspace root directory
    // In a real implementation, this would be passed in or determined dynamically
    const workspaceRoot = process.cwd();

    logger.info(`Initializing Augment Context Engine with workspace root: ${workspaceRoot}`);

    // VS Code API is only available when running as an extension
    // We'll set this up properly in the initialize method
    this.useVSCode = false;
    this.vscodeAPI = undefined;

    // Create the indexer and search engine
    this.indexer = new CodeIndexer(workspaceRoot);
    this.search = new CodeSearch(this.indexer);
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): AugmentContextEngine {
    if (!AugmentContextEngine.instance) {
      AugmentContextEngine.instance = new AugmentContextEngine();
    }
    return AugmentContextEngine.instance;
  }

  /**
   * Initialize the engine
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      logger.info('Augment Context Engine already initialized');
      return;
    }

    if (!this.config.enabled) {
      logger.info('Augment Context Engine is disabled in config');
      return;
    }

    logger.info('Initializing Augment Context Engine');

    try {
      // Check if VS Code API is available
      if (VSCodeAPIClass) {
        try {
          // Get the VS Code API instance
          const vscodeAPIInstance = VSCodeAPIClass.getInstance();

          // Check if it's available and initialized
          if (vscodeAPIInstance && vscodeAPIInstance.isAvailable()) {
            this.vscodeAPI = vscodeAPIInstance;
            this.useVSCode = true;
            logger.info('VS Code API is available, using enhanced features');

            // Update the workspace root if VS Code provides a different one
            const rootPath = vscodeAPIInstance.getRootPath();
            if (rootPath) {
              this.indexer.setRootDirectory(rootPath);
              logger.info(`Updated workspace root to: ${rootPath}`);
            }
          } else {
            logger.info('VS Code API is not available, using basic implementation');
          }
        } catch (error) {
          logger.warn('Error initializing VS Code API:', error);
          logger.info('Falling back to basic implementation');
        }
      } else {
        logger.info('VS Code API class not available, using basic implementation');
      }

      // Start indexing
      await this.indexer.startIndexing();

      // Start file watcher if real-time updates are enabled
      if (this.config.realtimeUpdates) {
        this.indexer.startWatcher();
      }

      this.initialized = true;
      logger.info('Augment Context Engine initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Augment Context Engine:', error);
      throw error;
    }
  }

  /**
   * Search the codebase
   * @param query The search query
   * @param maxResults The maximum number of results to return
   * @returns The search results
   */
  public async searchCode(query: string, maxResults: number = 10): Promise<SearchResult[]> {
    if (!this.initialized) {
      logger.warn('Augment Context Engine not initialized');
      return [];
    }

    if (this.useVSCode && this.vscodeAPI) {
      // Use VS Code API for search if available
      try {
        return await this.vscodeAPI.searchWorkspace(query, maxResults);
      } catch (error) {
        logger.error('Error using VS Code API for search:', error);
        // Fall back to basic search
        return this.search.search(query, maxResults);
      }
    } else {
      // Use basic search
      return this.search.search(query, maxResults);
    }
  }

  /**
   * Get a file by path
   * @param filePath The path to the file
   * @returns The file, if found
   */
  public getFile(filePath: string): CodeFile | undefined {
    if (!this.initialized) {
      logger.warn('Augment Context Engine not initialized');
      return undefined;
    }

    return this.search.getFile(filePath);
  }

  /**
   * Get a symbol by name and file path
   * @param name The name of the symbol
   * @param filePath The path to the file
   * @returns The symbol, if found
   */
  public getSymbol(name: string, filePath: string): CodeSymbol | undefined {
    if (!this.initialized) {
      logger.warn('Augment Context Engine not initialized');
      return undefined;
    }

    return this.search.getSymbol(name, filePath);
  }

  /**
   * Get the current index status
   * @returns The index status
   */
  public getIndexStatus(): IndexStatus {
    if (!this.initialized) {
      logger.warn('Augment Context Engine not initialized');
      return {
        isIndexing: false,
        totalFiles: 0,
        totalSymbols: 0,
        lastUpdated: 0,
        rootDirectory: ''
      };
    }

    return this.indexer.getIndexStatus();
  }

  /**
   * Reindex the codebase
   */
  public async reindex(): Promise<void> {
    if (!this.initialized) {
      logger.warn('Augment Context Engine not initialized');
      return;
    }

    logger.info('Reindexing codebase');
    await this.indexer.startIndexing();
  }

  /**
   * Check if the engine is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get the VS Code API instance
   * @returns The VS Code API instance, if available
   */
  public getVSCodeAPI(): IVSCodeAPI | undefined {
    return this.vscodeAPI;
  }

  /**
   * Set the VS Code API instance
   * @param api The VS Code API instance
   */
  public setVSCodeAPI(api: IVSCodeAPI): void {
    if (this.initialized) {
      logger.warn('Cannot set VS Code API after initialization');
      return;
    }

    this.vscodeAPI = api;
    this.useVSCode = true;
    logger.info('VS Code API set explicitly');
  }

  /**
   * Check if VS Code API is being used
   * @returns Whether VS Code API is being used
   */
  public isUsingVSCodeAPI(): boolean {
    return this.useVSCode && !!this.vscodeAPI;
  }

  /**
   * Get all symbols in a file
   * @param filePath The path to the file
   * @returns The symbols in the file
   */
  public async getSymbolsInFile(filePath: string): Promise<CodeSymbol[]> {
    if (!this.initialized) {
      logger.warn('Augment Context Engine not initialized');
      return [];
    }

    if (this.useVSCode && this.vscodeAPI) {
      // Use VS Code API if available
      try {
        return await this.vscodeAPI.getDocumentSymbols(filePath);
      } catch (error) {
        logger.error('Error using VS Code API for getting symbols:', error);
        // Fall back to basic indexer
        return this.indexer.getSymbolsInFile(filePath);
      }
    } else {
      // Use basic indexer
      return this.indexer.getSymbolsInFile(filePath);
    }
  }

  /**
   * Shutdown the engine
   */
  public shutdown(): void {
    if (!this.initialized) {
      logger.warn('Augment Context Engine not initialized');
      return;
    }

    logger.info('Shutting down Augment Context Engine');

    // Stop file watcher
    this.indexer.stopWatcher();

    this.initialized = false;
    logger.info('Augment Context Engine shut down successfully');
  }
}

// Export the singleton instance
export const augmentEngine = AugmentContextEngine.getInstance();

// Export models
export * from './models';
