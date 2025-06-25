/**
 * API functions for Personal Index System (Augment-style)
 */

// Use localhost when in VS Code webview
const API_BASE_URL = typeof window.acquireVsCodeApi === 'function' ? 'http://localhost:3000' : '';

// Types for Personal Index API
export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: FileTreeNode[];
  selected?: boolean;
}

export interface FileSelection {
  selectedPaths: string[];
  ignorePatterns: string[];
  includePatterns: string[];
  maxFileSize: number;
  supportedExtensions: string[];
}

export interface IndexingProgress {
  status: 'idle' | 'initializing' | 'indexing' | 'updating' | 'paused' | 'error' | 'completed';
  currentFile?: string;
  filesProcessed: number;
  totalFiles: number;
  percentage: number;
  estimatedTimeRemaining?: number;
  startTime: number;
  errors: IndexingError[];
  operation: {
    type: 'bulk' | 'incremental' | 'file-change';
    description: string;
  };
}

export interface IndexingError {
  filePath: string;
  message: string;
  type: 'parse-error' | 'file-access' | 'embedding-error' | 'unknown';
  timestamp: number;
  recoverable: boolean;
}

export interface IndexStatus {
  initialized: boolean;
  index: {
    id: string;
    branch: string;
    commit: string;
    metadata: {
      totalFiles: number;
      totalChunks: number;
      lastUpdated: number;
      status: string;
    };
  } | null;
  progress: IndexingProgress | null;
}

export interface SemanticSearchResult {
  chunk: {
    id: string;
    filePath: string;
    type: string;
    name?: string;
    content: string;
    startLine: number;
    endLine: number;
  };
  score: number;
  relevance: {
    reason: string;
    matches: string[];
    context: string;
  };
  file: {
    path: string;
    language: string;
    lastModified: number;
  };
}

/**
 * Initialize the personal index system
 */
export async function initializePersonalIndex(workspacePath: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/augment/personal-index/initialize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ workspacePath }),
    });

    if (!response.ok) {
      throw new Error(`Failed to initialize: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error initializing personal index:', error);
    throw error;
  }
}

/**
 * Get workspace file tree
 */
export async function getWorkspaceTree(workspacePath: string): Promise<{ tree: FileTreeNode[] }> {
  try {
    const params = new URLSearchParams();
    params.append('workspacePath', workspacePath);

    const response = await fetch(`${API_BASE_URL}/api/augment/personal-index/workspace-tree?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`Failed to get workspace tree: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting workspace tree:', error);
    throw error;
  }
}

/**
 * Start indexing with file selection
 */
export async function startIndexing(workspacePath: string, fileSelection: FileSelection): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/augment/personal-index/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workspacePath,
        fileSelection,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to start indexing: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error starting indexing:', error);
    throw error;
  }
}

/**
 * Get indexing progress
 */
export async function getIndexingProgress(): Promise<{ progress: IndexingProgress | null }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/augment/personal-index/progress`);

    if (!response.ok) {
      throw new Error(`Failed to get progress: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting indexing progress:', error);
    throw error;
  }
}

/**
 * Stop indexing
 */
export async function stopIndexing(): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/augment/personal-index/stop`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Failed to stop indexing: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error stopping indexing:', error);
    throw error;
  }
}

/**
 * Perform semantic search
 */
export async function searchSemantic(query: string, maxResults: number = 10): Promise<{ results: SemanticSearchResult[] }> {
  try {
    const params = new URLSearchParams();
    params.append('query', query);
    params.append('maxResults', maxResults.toString());

    const response = await fetch(`${API_BASE_URL}/api/augment/personal-index/search?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`Failed to search: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error performing semantic search:', error);
    throw error;
  }
}

/**
 * Get index status
 */
export async function getPersonalIndexStatus(): Promise<IndexStatus> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/augment/personal-index/status`);

    if (!response.ok) {
      throw new Error(`Failed to get status: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting index status:', error);
    throw error;
  }
}

/**
 * Get ignore patterns
 */
export async function getIgnorePatterns(workspacePath: string): Promise<{ patterns: string[] }> {
  try {
    const params = new URLSearchParams();
    params.append('workspacePath', workspacePath);

    const response = await fetch(`${API_BASE_URL}/api/augment/personal-index/ignore-patterns?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`Failed to get ignore patterns: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting ignore patterns:', error);
    throw error;
  }
}

/**
 * Update ignore patterns
 */
export async function updateIgnorePatterns(workspacePath: string, patterns: string[]): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/augment/personal-index/ignore-patterns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workspacePath,
        patterns,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update ignore patterns: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error updating ignore patterns:', error);
    throw error;
  }
}
