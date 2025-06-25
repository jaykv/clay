/**
 * Branch Tracker - Git integration for branch-aware indexing (Augment pattern)
 * Tracks git state changes and triggers re-indexing when branches change
 */

import { simpleGit, SimpleGit, StatusResult } from 'simple-git';
import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import { BranchInfo } from './models';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Events emitted by BranchTracker
 */
export interface BranchTrackerEvents {
  'branch-changed': (oldBranch: string, newBranch: string) => void;
  'files-changed': (changedFiles: string[]) => void;
  'commit-changed': (oldCommit: string, newCommit: string) => void;
  'git-error': (error: Error) => void;
}

/**
 * Branch tracker for git integration (Augment-style)
 */
export class BranchTracker extends EventEmitter {
  private git: SimpleGit;
  private workspacePath: string;
  private currentBranch: BranchInfo | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private isTracking = false;
  private pollIntervalMs = 2000; // Check every 2 seconds

  constructor(workspacePath: string) {
    super();
    this.workspacePath = workspacePath;
    this.git = simpleGit(workspacePath);
    
    logger.info(`BranchTracker initialized for workspace: ${workspacePath}`);
  }

  /**
   * Start tracking git changes
   */
  public async startTracking(): Promise<void> {
    if (this.isTracking) {
      logger.warn('BranchTracker is already tracking');
      return;
    }

    try {
      // Check if this is a git repository
      const isRepo = await this.isGitRepository();
      if (!isRepo) {
        logger.warn('Workspace is not a git repository, branch tracking disabled');
        return;
      }

      // Get initial branch info
      this.currentBranch = await this.getCurrentBranchInfo();
      this.isTracking = true;

      // Start polling for changes
      this.pollInterval = setInterval(() => {
        this.checkForChanges().catch(error => {
          logger.error('Error checking for git changes:', error);
          this.emit('git-error', error);
        });
      }, this.pollIntervalMs);

      logger.info(`Branch tracking started on branch: ${this.currentBranch.name}`);
    } catch (error) {
      logger.error('Failed to start branch tracking:', error);
      throw error;
    }
  }

  /**
   * Stop tracking git changes
   */
  public stopTracking(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isTracking = false;
    logger.info('Branch tracking stopped');
  }

  /**
   * Get current branch information
   */
  public getCurrentBranch(): BranchInfo | null {
    return this.currentBranch;
  }

  /**
   * Check if workspace is a git repository
   */
  private async isGitRepository(): Promise<boolean> {
    try {
      await this.git.status();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get current branch information
   */
  private async getCurrentBranchInfo(): Promise<BranchInfo> {
    try {
      const [status, branch, commit] = await Promise.all([
        this.git.status(),
        this.git.branch(),
        this.git.revparse(['HEAD'])
      ]);

      const modifiedFiles = [
        ...status.modified,
        ...status.created,
        ...status.deleted,
        ...status.renamed.map(r => r.to),
      ];

      return {
        name: branch.current || 'unknown',
        commit: commit.trim(),
        remote: (branch as any).tracking || undefined,
        hasUncommittedChanges: !status.isClean(),
        modifiedFiles,
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error('Failed to get branch info:', error);
      throw error;
    }
  }

  /**
   * Check for git changes and emit events
   */
  private async checkForChanges(): Promise<void> {
    if (!this.currentBranch) {
      return;
    }

    try {
      const newBranchInfo = await this.getCurrentBranchInfo();
      
      // Check for branch change
      if (newBranchInfo.name !== this.currentBranch.name) {
        logger.info(`Branch changed: ${this.currentBranch.name} -> ${newBranchInfo.name}`);
        this.emit('branch-changed', this.currentBranch.name, newBranchInfo.name);
      }

      // Check for commit change
      if (newBranchInfo.commit !== this.currentBranch.commit) {
        logger.info(`Commit changed: ${this.currentBranch.commit} -> ${newBranchInfo.commit}`);
        this.emit('commit-changed', this.currentBranch.commit, newBranchInfo.commit);
      }

      // Check for file changes
      const oldFiles = new Set(this.currentBranch.modifiedFiles);
      const newFiles = new Set(newBranchInfo.modifiedFiles);
      
      const hasFileChanges = oldFiles.size !== newFiles.size || 
        [...oldFiles].some(file => !newFiles.has(file)) ||
        [...newFiles].some(file => !oldFiles.has(file));

      if (hasFileChanges) {
        logger.debug(`File changes detected: ${newBranchInfo.modifiedFiles.length} files`);
        this.emit('files-changed', newBranchInfo.modifiedFiles);
      }

      this.currentBranch = newBranchInfo;
    } catch (error) {
      logger.error('Error checking for git changes:', error);
      this.emit('git-error', error as Error);
    }
  }

  /**
   * Get list of all files in the repository
   */
  public async getTrackedFiles(): Promise<string[]> {
    try {
      const result = await this.git.raw(['ls-files']);
      return result.split('\n').filter(file => file.trim().length > 0);
    } catch (error) {
      logger.error('Failed to get tracked files:', error);
      return [];
    }
  }

  /**
   * Get file content at specific commit
   */
  public async getFileAtCommit(filePath: string, commit: string): Promise<string | null> {
    try {
      const content = await this.git.show([`${commit}:${filePath}`]);
      return content;
    } catch (error) {
      logger.debug(`Failed to get file ${filePath} at commit ${commit}:`, error);
      return null;
    }
  }

  /**
   * Check if file has changed since last commit
   */
  public async hasFileChanged(filePath: string): Promise<boolean> {
    try {
      const status = await this.git.status([filePath]);
      return !status.isClean();
    } catch (error) {
      logger.error(`Failed to check if file ${filePath} has changed:`, error);
      return false;
    }
  }

  /**
   * Get file hash for security verification
   */
  public async getFileHash(filePath: string): Promise<string | null> {
    try {
      const fullPath = path.join(this.workspacePath, filePath);
      if (!fs.existsSync(fullPath)) {
        return null;
      }

      const hash = await this.git.hashObject(fullPath);
      return hash.trim();
    } catch (error) {
      logger.error(`Failed to get hash for file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Get diff for a file
   */
  public async getFileDiff(filePath: string): Promise<string | null> {
    try {
      const diff = await this.git.diff([filePath]);
      return diff || null;
    } catch (error) {
      logger.error(`Failed to get diff for file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Check if file is ignored by git
   */
  public async isFileIgnored(filePath: string): Promise<boolean> {
    try {
      await this.git.raw(['check-ignore', filePath]);
      return true; // If no error, file is ignored
    } catch (error) {
      return false; // If error, file is not ignored
    }
  }
}

/**
 * Typed event emitter for BranchTracker
 */
export interface BranchTracker {
  on<K extends keyof BranchTrackerEvents>(event: K, listener: BranchTrackerEvents[K]): this;
  emit<K extends keyof BranchTrackerEvents>(event: K, ...args: Parameters<BranchTrackerEvents[K]>): boolean;
}
