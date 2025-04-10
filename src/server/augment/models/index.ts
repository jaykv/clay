import { CodeFile, CodeSnippet } from './file';
import { CodeSymbol } from './symbol';

/**
 * Represents a search result from the codebase
 */
export interface SearchResult {
  /**
   * The snippets that match the search query
   */
  snippets: CodeSnippet[];

  /**
   * The symbols that match the search query, if any
   */
  symbols?: CodeSymbol[];

  /**
   * The relevance score of the result (higher is more relevant)
   */
  relevanceScore: number;
}

/**
 * Represents the status of the codebase index
 */
export interface IndexStatus {
  /**
   * Whether the index is currently being built
   */
  isIndexing: boolean;

  /**
   * The total number of files indexed
   */
  totalFiles: number;

  /**
   * The total number of symbols indexed
   */
  totalSymbols: number;

  /**
   * The last time the index was updated
   */
  lastUpdated: number;

  /**
   * The root directory of the indexed codebase
   */
  rootDirectory: string;
}

/**
 * Export all models
 */
export * from './file';
export * from './symbol';
