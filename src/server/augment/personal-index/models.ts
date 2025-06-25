/**
 * Models for Personal Index System (Augment-style)
 * Defines the core data structures for branch-aware, real-time code indexing
 */

/**
 * Code chunk types based on AST analysis
 */
export type CodeChunkType = 
  | 'function' 
  | 'class' 
  | 'interface' 
  | 'method'
  | 'property'
  | 'import' 
  | 'export'
  | 'comment' 
  | 'module'
  | 'variable'
  | 'type';

/**
 * Supported programming languages
 */
export type SupportedLanguage = 'javascript' | 'typescript' | 'python' | 'markdown' | 'json';

/**
 * Code chunk with semantic information (Augment-style)
 */
export interface CodeChunk {
  /** Unique identifier for the chunk */
  id: string;
  
  /** File path relative to workspace root */
  filePath: string;
  
  /** Type of code construct */
  type: CodeChunkType;
  
  /** Name of the construct (function name, class name, etc.) */
  name?: string;
  
  /** Start line number (1-based) */
  startLine: number;
  
  /** End line number (1-based) */
  endLine: number;
  
  /** Raw content of the chunk */
  content: string;
  
  /** Surrounding context for better understanding */
  context: string;
  
  /** Dependencies (imports, references) */
  dependencies: string[];
  
  /** File hash for security verification */
  hash: string;
  
  /** Language of the code */
  language: SupportedLanguage;
  
  /** Metadata for enhanced search */
  metadata: {
    /** Complexity score (for prioritization) */
    complexity?: number;
    /** Is this exported/public? */
    isPublic?: boolean;
    /** Documentation/comments */
    documentation?: string;
    /** Related symbols */
    relatedSymbols?: string[];
  };
  
  /** Timestamp when chunk was created */
  createdAt: number;
  
  /** Timestamp when chunk was last updated */
  updatedAt: number;
}

/**
 * Personal index for a specific user and workspace (Augment pattern)
 */
export interface PersonalIndex {
  /** Unique identifier for the index */
  id: string;
  
  /** User identifier */
  userId: string;
  
  /** Workspace identifier */
  workspaceId: string;
  
  /** Current git branch */
  branch: string;
  
  /** Current git commit hash */
  commit: string;
  
  /** Workspace root path */
  workspacePath: string;
  
  /** All code chunks in the index */
  chunks: Map<string, CodeChunk>;
  
  /** Embeddings for each chunk */
  embeddings: Map<string, Float32Array>;
  
  /** File hashes for security verification */
  fileHashes: Map<string, string>;
  
  /** Index metadata */
  metadata: {
    /** Total number of files indexed */
    totalFiles: number;
    /** Total number of chunks */
    totalChunks: number;
    /** Index size in bytes */
    sizeBytes: number;
    /** Last update timestamp */
    lastUpdated: number;
    /** Index creation timestamp */
    createdAt: number;
    /** Indexing status */
    status: IndexingStatus;
  };
}

/**
 * Indexing status
 */
export type IndexingStatus = 
  | 'idle'
  | 'initializing'
  | 'indexing'
  | 'updating'
  | 'paused'
  | 'error'
  | 'completed';

/**
 * Indexing progress information
 */
export interface IndexingProgress {
  /** Current status */
  status: IndexingStatus;
  
  /** Current file being processed */
  currentFile?: string;
  
  /** Files processed so far */
  filesProcessed: number;
  
  /** Total files to process */
  totalFiles: number;
  
  /** Progress percentage (0-100) */
  percentage: number;
  
  /** Estimated time remaining in milliseconds */
  estimatedTimeRemaining?: number;
  
  /** Start time of current operation */
  startTime: number;
  
  /** Errors encountered during indexing */
  errors: IndexingError[];
  
  /** Current operation details */
  operation: {
    type: 'bulk' | 'incremental' | 'file-change';
    description: string;
  };
}

/**
 * Indexing error information
 */
export interface IndexingError {
  /** File path where error occurred */
  filePath: string;
  
  /** Error message */
  message: string;
  
  /** Error type */
  type: 'parse-error' | 'file-access' | 'embedding-error' | 'unknown';
  
  /** Timestamp when error occurred */
  timestamp: number;
  
  /** Whether this error is recoverable */
  recoverable: boolean;
}

/**
 * File selection configuration
 */
export interface FileSelection {
  /** Selected file paths */
  selectedPaths: string[];
  
  /** Ignore patterns */
  ignorePatterns: string[];
  
  /** Include patterns */
  includePatterns: string[];
  
  /** Maximum file size to index */
  maxFileSize: number;
  
  /** Supported file extensions */
  supportedExtensions: string[];
}

/**
 * Search result with semantic scoring
 */
export interface SemanticSearchResult {
  /** Matching code chunk */
  chunk: CodeChunk;
  
  /** Similarity score (0-1) */
  score: number;
  
  /** Relevance explanation */
  relevance: {
    /** Why this chunk is relevant */
    reason: string;
    /** Matching terms/concepts */
    matches: string[];
    /** Context that makes it relevant */
    context: string;
  };
  
  /** File information */
  file: {
    path: string;
    language: SupportedLanguage;
    lastModified: number;
  };
}

/**
 * Branch information for git integration
 */
export interface BranchInfo {
  /** Current branch name */
  name: string;
  
  /** Current commit hash */
  commit: string;
  
  /** Remote tracking branch */
  remote?: string;
  
  /** Whether there are uncommitted changes */
  hasUncommittedChanges: boolean;
  
  /** List of modified files */
  modifiedFiles: string[];
  
  /** Branch creation/switch timestamp */
  timestamp: number;
}

/**
 * Update operation for incremental indexing
 */
export interface UpdateOperation {
  /** Operation type */
  type: 'add' | 'modify' | 'delete' | 'move';
  
  /** File path */
  filePath: string;
  
  /** Previous file path (for move operations) */
  previousPath?: string;
  
  /** File hash */
  hash: string;
  
  /** Operation timestamp */
  timestamp: number;
  
  /** Priority (higher = more urgent) */
  priority: number;
}
