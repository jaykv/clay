/**
 * Personal Index Manager - Main orchestrator for Augment-style personal indexing
 * Coordinates branch tracking, code chunking, embedding generation, and real-time updates
 */

import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import { getConfig } from '../../utils/config';
import { BranchTracker } from './branch-tracker';
import { LocalEmbedder } from './local-embedder';
import { CodeChunker } from './code-chunker';
import { 
  PersonalIndex, 
  IndexingProgress, 
  IndexingStatus, 
  CodeChunk, 
  SemanticSearchResult,
  UpdateOperation,
  FileSelection 
} from './models';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import * as crypto from 'crypto';

/**
 * Events emitted by PersonalIndexManager
 */
export interface PersonalIndexEvents {
  'indexing-started': (progress: IndexingProgress) => void;
  'indexing-progress': (progress: IndexingProgress) => void;
  'indexing-completed': (index: PersonalIndex) => void;
  'indexing-error': (error: Error) => void;
  'file-updated': (filePath: string, chunks: CodeChunk[]) => void;
  'branch-changed': (oldBranch: string, newBranch: string) => void;
}

/**
 * Personal Index Manager (Augment-style architecture)
 */
export class PersonalIndexManager extends EventEmitter {
  private workspacePath: string;
  private userId: string;
  private branchTracker: BranchTracker;
  private embedder: LocalEmbedder;
  private chunker: CodeChunker;
  private currentIndex: PersonalIndex | null = null;
  private indexingProgress: IndexingProgress | null = null;
  private config = getConfig().augment.personalIndex;
  private updateQueue: UpdateOperation[] = [];
  private isProcessingUpdates = false;

  constructor(workspacePath: string, userId: string = 'default') {
    super();
    this.workspacePath = workspacePath;
    this.userId = userId;
    
    // Initialize components
    this.branchTracker = new BranchTracker(workspacePath);
    this.embedder = new LocalEmbedder();
    this.chunker = new CodeChunker();

    // Set up event listeners
    this.setupEventListeners();

    logger.info(`PersonalIndexManager initialized for user ${userId} at ${workspacePath}`);
  }

  /**
   * Initialize the personal index system
   */
  public async initialize(): Promise<void> {
    try {
      logger.info('Initializing personal index system...');

      // Initialize embedder
      await this.embedder.initialize();

      // Start branch tracking
      await this.branchTracker.startTracking();

      // Load existing index or create new one
      await this.loadOrCreateIndex();

      logger.info('Personal index system initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize personal index system:', error);
      throw error;
    }
  }

  /**
   * Start indexing with file selection
   */
  public async startIndexing(fileSelection: FileSelection): Promise<void> {
    if (this.indexingProgress?.status === 'indexing') {
      throw new Error('Indexing is already in progress');
    }

    try {
      // Get files to index
      const filesToIndex = await this.getFilesToIndex(fileSelection);
      
      // Initialize progress tracking
      this.indexingProgress = {
        status: 'indexing',
        filesProcessed: 0,
        totalFiles: filesToIndex.length,
        percentage: 0,
        startTime: Date.now(),
        errors: [],
        operation: {
          type: 'bulk',
          description: 'Initial indexing of selected files',
        },
      };

      this.emit('indexing-started', this.indexingProgress);

      // Process files
      await this.processFiles(filesToIndex);

      // Complete indexing
      this.indexingProgress.status = 'completed';
      this.indexingProgress.percentage = 100;
      this.emit('indexing-completed', this.currentIndex!);

      logger.info(`Indexing completed: ${filesToIndex.length} files processed`);
    } catch (error) {
      if (this.indexingProgress) {
        this.indexingProgress.status = 'error';
      }
      this.emit('indexing-error', error as Error);
      throw error;
    }
  }

  /**
   * Perform semantic search
   */
  public async search(query: string, maxResults: number = 10): Promise<SemanticSearchResult[]> {
    if (!this.currentIndex || !this.embedder.isReady()) {
      throw new Error('Index not ready for search');
    }

    try {
      // Generate query embedding
      const queryEmbedding = await this.embedder.generateEmbedding(query);

      // Find similar chunks
      const similarities = this.embedder.findSimilar(
        queryEmbedding,
        this.currentIndex.embeddings,
        maxResults
      );

      // Convert to search results
      const results: SemanticSearchResult[] = similarities.map(({ id, similarity }) => {
        const chunk = this.currentIndex!.chunks.get(id)!;
        return {
          chunk,
          score: similarity,
          relevance: {
            reason: this.generateRelevanceReason(chunk, query, similarity),
            matches: this.extractMatches(chunk, query),
            context: chunk.context,
          },
          file: {
            path: chunk.filePath,
            language: chunk.language,
            lastModified: chunk.updatedAt,
          },
        };
      });

      logger.debug(`Search for "${query}" returned ${results.length} results`);
      return results;
    } catch (error) {
      logger.error('Search failed:', error);
      throw error;
    }
  }

  /**
   * Get current index status
   */
  public getIndexStatus(): IndexingProgress | null {
    return this.indexingProgress;
  }

  /**
   * Get current index
   */
  public getCurrentIndex(): PersonalIndex | null {
    return this.currentIndex;
  }

  /**
   * Stop indexing
   */
  public stopIndexing(): void {
    if (this.indexingProgress?.status === 'indexing') {
      this.indexingProgress.status = 'paused';
      logger.info('Indexing stopped by user');
    }
  }

  /**
   * Dispose resources
   */
  public async dispose(): Promise<void> {
    this.branchTracker.stopTracking();
    await this.embedder.dispose();
    this.removeAllListeners();
    logger.info('PersonalIndexManager disposed');
  }

  /**
   * Private methods
   */

  private setupEventListeners(): void {
    // Branch tracking events
    this.branchTracker.on('branch-changed', (oldBranch, newBranch) => {
      logger.info(`Branch changed: ${oldBranch} -> ${newBranch}`);
      this.emit('branch-changed', oldBranch, newBranch);
      this.handleBranchChange(oldBranch, newBranch);
    });

    this.branchTracker.on('files-changed', (changedFiles) => {
      logger.debug(`Files changed: ${changedFiles.length} files`);
      this.queueFileUpdates(changedFiles);
    });

    this.branchTracker.on('git-error', (error) => {
      logger.error('Git error:', error);
    });
  }

  private async loadOrCreateIndex(): Promise<void> {
    const branchInfo = this.branchTracker.getCurrentBranch();
    if (!branchInfo) {
      throw new Error('No branch information available');
    }

    // Create new index
    this.currentIndex = {
      id: this.generateIndexId(),
      userId: this.userId,
      workspaceId: this.generateWorkspaceId(),
      branch: branchInfo.name,
      commit: branchInfo.commit,
      workspacePath: this.workspacePath,
      chunks: new Map(),
      embeddings: new Map(),
      fileHashes: new Map(),
      metadata: {
        totalFiles: 0,
        totalChunks: 0,
        sizeBytes: 0,
        lastUpdated: Date.now(),
        createdAt: Date.now(),
        status: 'idle',
      },
    };

    logger.info(`Created new index for branch ${branchInfo.name}`);
  }

  private async getFilesToIndex(fileSelection: FileSelection): Promise<string[]> {
    const patterns = fileSelection.includePatterns.length > 0 
      ? fileSelection.includePatterns 
      : ['**/*'];

    const allFiles: string[] = [];
    
    for (const pattern of patterns) {
      try {
        const files = await glob(pattern, {
          cwd: this.workspacePath,
          ignore: fileSelection.ignorePatterns,
          nodir: true,
        });
        allFiles.push(...files);
      } catch (error) {
        logger.error(`Error globbing pattern ${pattern}:`, error);
      }
    }

    // Filter by file size and extensions
    const filteredFiles: string[] = [];
    for (const file of allFiles) {
      const fullPath = path.join(this.workspacePath, file);
      try {
        const stats = fs.statSync(fullPath);
        if (stats.size <= fileSelection.maxFileSize) {
          const ext = path.extname(file);
          if (fileSelection.supportedExtensions.includes(ext)) {
            filteredFiles.push(file);
          }
        }
      } catch (error) {
        logger.debug(`Skipping file ${file}: ${error}`);
      }
    }

    logger.info(`Found ${filteredFiles.length} files to index`);
    return filteredFiles;
  }

  private async processFiles(filePaths: string[]): Promise<void> {
    for (let i = 0; i < filePaths.length; i++) {
      if (this.indexingProgress?.status !== 'indexing') {
        break; // Stop if indexing was paused/stopped
      }

      const filePath = filePaths[i];
      
      try {
        await this.processFile(filePath);
        
        // Update progress
        if (this.indexingProgress) {
          this.indexingProgress.filesProcessed = i + 1;
          this.indexingProgress.percentage = Math.round((i + 1) / filePaths.length * 100);
          this.indexingProgress.currentFile = filePath;
          this.emit('indexing-progress', this.indexingProgress);
        }
      } catch (error) {
        logger.error(`Failed to process file ${filePath}:`, error);
        if (this.indexingProgress) {
          this.indexingProgress.errors.push({
            filePath,
            message: (error as Error).message,
            type: 'parse-error',
            timestamp: Date.now(),
            recoverable: true,
          });
        }
      }
    }
  }

  private async processFile(filePath: string): Promise<void> {
    const fullPath = path.join(this.workspacePath, filePath);
    const content = fs.readFileSync(fullPath, 'utf-8');
    
    // Generate file hash
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    
    // Parse into chunks
    const chunks = await this.chunker.parseFile(filePath, content);
    
    // Generate embeddings
    const embeddings = await this.embedder.generateEmbeddings(chunks);
    
    // Store in index
    if (this.currentIndex) {
      chunks.forEach(chunk => {
        this.currentIndex!.chunks.set(chunk.id, chunk);
        const embedding = embeddings.get(chunk.id);
        if (embedding) {
          this.currentIndex!.embeddings.set(chunk.id, embedding);
        }
      });
      
      this.currentIndex.fileHashes.set(filePath, hash);
      this.currentIndex.metadata.totalFiles++;
      this.currentIndex.metadata.totalChunks += chunks.length;
      this.currentIndex.metadata.lastUpdated = Date.now();
    }

    this.emit('file-updated', filePath, chunks);
  }

  private generateIndexId(): string {
    return crypto.randomUUID();
  }

  private generateWorkspaceId(): string {
    return crypto.createHash('md5').update(this.workspacePath).digest('hex');
  }

  private handleBranchChange(oldBranch: string, newBranch: string): void {
    // For now, just update the branch info
    // TODO: Implement branch-specific index management
    if (this.currentIndex) {
      this.currentIndex.branch = newBranch;
      this.currentIndex.metadata.lastUpdated = Date.now();
    }
  }

  private queueFileUpdates(changedFiles: string[]): void {
    const operations: UpdateOperation[] = changedFiles.map(filePath => ({
      type: 'modify',
      filePath,
      hash: '',
      timestamp: Date.now(),
      priority: 1,
    }));

    this.updateQueue.push(...operations);
    this.processUpdateQueue();
  }

  private async processUpdateQueue(): Promise<void> {
    if (this.isProcessingUpdates || this.updateQueue.length === 0) {
      return;
    }

    this.isProcessingUpdates = true;
    
    try {
      while (this.updateQueue.length > 0) {
        const operation = this.updateQueue.shift()!;
        await this.processFile(operation.filePath);
      }
    } catch (error) {
      logger.error('Error processing update queue:', error);
    } finally {
      this.isProcessingUpdates = false;
    }
  }

  private generateRelevanceReason(chunk: CodeChunk, query: string, similarity: number): string {
    return `${Math.round(similarity * 100)}% similarity to "${query}" in ${chunk.type} "${chunk.name}"`;
  }

  private extractMatches(chunk: CodeChunk, query: string): string[] {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const content = chunk.content.toLowerCase();
    return queryTerms.filter(term => content.includes(term));
  }
}

/**
 * Typed event emitter for PersonalIndexManager
 */
export interface PersonalIndexManager {
  on<K extends keyof PersonalIndexEvents>(event: K, listener: PersonalIndexEvents[K]): this;
  emit<K extends keyof PersonalIndexEvents>(event: K, ...args: Parameters<PersonalIndexEvents[K]>): boolean;
}
