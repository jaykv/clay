import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { logger } from '../utils/logger';
import { getConfig } from '../utils/config';
import { CodeFile, CodeSymbol, IndexStatus } from './models';
import { FileWatcher } from './utils/watcher';
import { SymbolType } from './models/symbol';

/**
 * Class responsible for indexing the codebase
 */
export class CodeIndexer {
  private indexStatus: IndexStatus;
  private files: Map<string, CodeFile> = new Map();
  private symbols: Map<string, CodeSymbol> = new Map();
  private config = getConfig().augment;
  private rootDirectory: string;
  private fileWatcher: FileWatcher;

  constructor(rootDirectory: string) {
    this.rootDirectory = rootDirectory;

    // Initialize index status
    this.indexStatus = {
      isIndexing: false,
      totalFiles: 0,
      totalSymbols: 0,
      lastUpdated: 0,
      rootDirectory: rootDirectory,
    };

    // Initialize file watcher
    this.fileWatcher = new FileWatcher(rootDirectory, filePath => this.handleFileChange(filePath));

    logger.info(`CodeIndexer initialized with root directory: ${rootDirectory}`);
  }

  /**
   * Start indexing the codebase
   */
  public async startIndexing(): Promise<void> {
    if (this.indexStatus.isIndexing) {
      logger.warn('Indexing is already in progress');
      return;
    }

    this.indexStatus.isIndexing = true;
    logger.info('Starting codebase indexing');

    try {
      // Clear existing index
      this.files.clear();
      this.symbols.clear();

      // Scan the directory for files
      await this.scanDirectory(this.rootDirectory);

      // Update index status
      this.indexStatus.totalFiles = this.files.size;
      this.indexStatus.totalSymbols = this.symbols.size;
      this.indexStatus.lastUpdated = Date.now();
      this.indexStatus.isIndexing = false;

      logger.info(
        `Indexing completed. Indexed ${this.files.size} files and ${this.symbols.size} symbols.`
      );
    } catch (error) {
      logger.error('Error during indexing:', error);
      this.indexStatus.isIndexing = false;
      throw error;
    }
  }

  /**
   * Scan a directory for files to index
   */
  private async scanDirectory(directory: string): Promise<void> {
    try {
      // Use glob to find all files matching the include patterns
      // For simplicity, we'll use a more direct approach for now
      // In a real implementation, we would use proper glob patterns
      const entries = fs.readdirSync(directory, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);
        const relativePath = path.relative(this.rootDirectory, fullPath);

        // Skip excluded paths
        if (this.shouldExclude(relativePath)) {
          continue;
        }

        if (entry.isDirectory()) {
          // Recursively scan subdirectories
          await this.scanDirectory(fullPath);
        } else if (entry.isFile() && this.shouldInclude(relativePath)) {
          // Index the file if it should be included
          await this.indexFile(fullPath, relativePath);
        }
      }
    } catch (error) {
      logger.error(`Error scanning directory ${directory}:`, error);
      throw error;
    }
  }

  /**
   * Index a single file
   */
  private async indexFile(fullPath: string, relativePath: string): Promise<void> {
    try {
      // Get file stats
      const stats = fs.statSync(fullPath);

      // Skip files that are too large
      if (stats.size > this.config.maxFileSize) {
        logger.debug(`Skipping file ${relativePath} (too large: ${stats.size} bytes)`);
        return;
      }

      // Read file content
      const content = fs.readFileSync(fullPath, 'utf-8');

      // Determine language from file extension
      const language = this.getLanguageFromPath(relativePath);

      // Create file object
      const file: CodeFile = {
        path: relativePath,
        content,
        language,
        size: stats.size,
        lastModified: stats.mtimeMs,
      };

      // Add to index
      this.files.set(relativePath, file);

      // Extract symbols (basic implementation for now)
      // In a more advanced implementation, we would use language-specific parsers
      this.extractSymbols(file);

      logger.debug(`Indexed file: ${relativePath}`);
    } catch (error) {
      logger.error(`Error indexing file ${relativePath}:`, error);
      // Continue with other files even if one fails
    }
  }

  /**
   * Extract symbols from a file (basic implementation)
   */
  private extractSymbols(file: CodeFile): void {
    // This is a placeholder for a more sophisticated symbol extraction
    // In a real implementation, we would use language-specific parsers

    // For now, we'll just do a simple regex-based extraction for functions and classes
    if (file.language === 'typescript' || file.language === 'javascript') {
      // Extract function declarations
      const functionRegex = /function\s+([a-zA-Z0-9_]+)\s*\(/g;
      let match;

      while ((match = functionRegex.exec(file.content)) !== null) {
        const name = match[1];
        const startPos = match.index;
        const endPos = file.content.indexOf('}', startPos);

        if (endPos !== -1) {
          // Calculate line numbers
          const contentBeforeStart = file.content.substring(0, startPos);
          const contentBeforeEnd = file.content.substring(0, endPos);
          const startLine = (contentBeforeStart.match(/\n/g) || []).length + 1;
          const endLine = (contentBeforeEnd.match(/\n/g) || []).length + 1;

          const symbol: CodeSymbol = {
            name,
            type: SymbolType.FUNCTION,
            filePath: file.path,
            startLine,
            endLine,
          };

          this.symbols.set(`${file.path}:${name}`, symbol);
        }
      }
    }
  }

  /**
   * Check if a file should be included based on patterns
   */
  private shouldInclude(filePath: string): boolean {
    // Simple implementation for now
    // In a real implementation, we would use glob patterns
    const extension = path.extname(filePath).toLowerCase();
    const supportedExtensions = [
      '.js',
      '.ts',
      '.jsx',
      '.tsx',
      '.py',
      '.java',
      '.c',
      '.cpp',
      '.go',
      '.rs',
    ];

    return supportedExtensions.includes(extension);
  }

  /**
   * Check if a file should be excluded based on patterns
   */
  private shouldExclude(filePath: string): boolean {
    // Simple implementation for now
    // In a real implementation, we would use glob patterns
    const excludedDirs = ['node_modules', 'dist', 'build', '.git'];

    return excludedDirs.some(dir => filePath.includes(`/${dir}/`));
  }

  /**
   * Get the language from a file path
   */
  private getLanguageFromPath(filePath: string): string {
    const extension = path.extname(filePath).toLowerCase();

    switch (extension) {
      case '.js':
        return 'javascript';
      case '.ts':
        return 'typescript';
      case '.jsx':
        return 'jsx';
      case '.tsx':
        return 'tsx';
      case '.py':
        return 'python';
      case '.java':
        return 'java';
      case '.c':
        return 'c';
      case '.cpp':
        return 'cpp';
      case '.go':
        return 'go';
      case '.rs':
        return 'rust';
      default:
        return 'plaintext';
    }
  }

  /**
   * Get the current index status
   */
  public getIndexStatus(): IndexStatus {
    return { ...this.indexStatus };
  }

  /**
   * Get a file by path
   */
  public getFile(filePath: string): CodeFile | undefined {
    return this.files.get(filePath);
  }

  /**
   * Get all indexed files
   */
  public getAllFiles(): CodeFile[] {
    return Array.from(this.files.values());
  }

  /**
   * Get a symbol by name and file path
   */
  public getSymbol(name: string, filePath: string): CodeSymbol | undefined {
    return this.symbols.get(`${filePath}:${name}`);
  }

  /**
   * Get all symbols in a file
   */
  public getSymbolsInFile(filePath: string): CodeSymbol[] {
    return Array.from(this.symbols.values()).filter(symbol => symbol.filePath === filePath);
  }

  /**
   * Get all indexed symbols
   */
  public getAllSymbols(): CodeSymbol[] {
    return Array.from(this.symbols.values());
  }

  /**
   * Set the root directory for indexing
   * @param rootDirectory The new root directory
   */
  public setRootDirectory(rootDirectory: string): void {
    if (this.rootDirectory === rootDirectory) {
      return; // No change needed
    }

    logger.info(`Changing root directory from ${this.rootDirectory} to ${rootDirectory}`);
    this.rootDirectory = rootDirectory;

    // Update the index status
    this.indexStatus.rootDirectory = rootDirectory;

    // Update the file watcher
    this.fileWatcher.stop();
    this.fileWatcher = new FileWatcher(rootDirectory, filePath => this.handleFileChange(filePath));

    // We'll need to reindex with the new root directory
    // This will happen when startIndexing is called
  }

  /**
   * Start the file watcher
   */
  public startWatcher(): void {
    if (this.config.realtimeUpdates) {
      this.fileWatcher.start();
    }
  }

  /**
   * Stop the file watcher
   */
  public stopWatcher(): void {
    this.fileWatcher.stop();
  }

  /**
   * Handle a file change event
   * @param filePath The path to the file that changed
   */
  private async handleFileChange(filePath: string): Promise<void> {
    try {
      logger.info(`File changed: ${filePath}`);

      // Get the full path
      const fullPath = path.join(this.rootDirectory, filePath);

      // Check if the file exists
      if (fs.existsSync(fullPath)) {
        // File was added or modified
        await this.indexFile(fullPath, filePath);
      } else {
        // File was deleted
        this.files.delete(filePath);

        // Remove any symbols from this file
        const symbolsToRemove = Array.from(this.symbols.entries())
          .filter(([_, symbol]) => symbol.filePath === filePath)
          .map(([key, _]) => key);

        symbolsToRemove.forEach(key => this.symbols.delete(key));

        logger.info(`Removed file from index: ${filePath}`);
      }

      // Update index status
      this.indexStatus.totalFiles = this.files.size;
      this.indexStatus.totalSymbols = this.symbols.size;
      this.indexStatus.lastUpdated = Date.now();
    } catch (error) {
      logger.error(`Error handling file change for ${filePath}:`, error);
    }
  }
}
