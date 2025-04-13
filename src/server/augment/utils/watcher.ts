import * as chokidar from 'chokidar';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { logger } from '../../utils/logger';
import { getConfig } from '../../utils/config';

/**
 * File watcher for the Augment Context Engine
 */
export class FileWatcher {
  private watcher: chokidar.FSWatcher | null = null;
  private config = getConfig().augment;
  private rootDirectory: string;
  private onChangeCallback: (filePath: string) => void;

  /**
   * Create a new file watcher
   * @param rootDirectory The root directory to watch
   * @param onChange Callback function when a file changes
   */
  constructor(rootDirectory: string, onChange: (filePath: string) => void) {
    this.rootDirectory = rootDirectory;
    this.onChangeCallback = onChange;
    logger.info(`FileWatcher initialized with root directory: ${rootDirectory}`);
  }

  /**
   * Start watching for file changes
   */
  public start(): void {
    if (this.watcher) {
      logger.warn('FileWatcher is already running');
      return;
    }

    if (!this.config.realtimeUpdates) {
      logger.info('Real-time updates are disabled in config, not starting FileWatcher');
      return;
    }

    logger.info('Starting FileWatcher');

    // Create a glob pattern from the include and exclude patterns
    const includePatterns = this.config.include.map(pattern =>
      path.join(this.rootDirectory, pattern)
    );
    const excludePatterns = this.config.exclude.map(pattern =>
      path.join(this.rootDirectory, pattern)
    );

    // Create the watcher with platform-specific options
    const watchOptions: chokidar.WatchOptions = {
      ignored: excludePatterns,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100,
      },
    };

    // Disable fsevents on non-macOS platforms
    if (os.platform() !== 'darwin') {
      watchOptions.useFsEvents = false;
    }

    try {
      this.watcher = chokidar.watch(includePatterns, watchOptions);
    } catch (error) {
      logger.error('Error creating file watcher:', error);
      // Fall back to a simpler configuration
      try {
        this.watcher = chokidar.watch(includePatterns, {
          ignored: excludePatterns,
          persistent: true,
          ignoreInitial: true,
          useFsEvents: false,
        });
      } catch (fallbackError) {
        logger.error('Error creating fallback file watcher:', fallbackError);
        return;
      }
    }

    // Add event listeners
    this.watcher
      .on('add', filePath => this.handleFileChange('add', filePath))
      .on('change', filePath => this.handleFileChange('change', filePath))
      .on('unlink', filePath => this.handleFileChange('unlink', filePath))
      .on('error', error => logger.error('FileWatcher error:', error));

    logger.info('FileWatcher started');
  }

  /**
   * Stop watching for file changes
   */
  public stop(): void {
    if (!this.watcher) {
      logger.warn('FileWatcher is not running');
      return;
    }

    logger.info('Stopping FileWatcher');
    this.watcher.close();
    this.watcher = null;
    logger.info('FileWatcher stopped');
  }

  /**
   * Handle a file change event
   * @param event The event type
   * @param filePath The path to the file
   */
  private handleFileChange(event: string, filePath: string): void {
    // Get the relative path
    const relativePath = path.relative(this.rootDirectory, filePath);

    logger.debug(`FileWatcher detected ${event} event for ${relativePath}`);

    // Call the callback
    this.onChangeCallback(relativePath);
  }
}
