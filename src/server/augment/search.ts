import { logger } from '../utils/logger';
import { CodeFile, CodeSnippet, CodeSymbol, SearchResult } from './models';
import { CodeIndexer } from './indexer';

/**
 * Class responsible for searching the codebase
 */
export class CodeSearch {
  private indexer: CodeIndexer;

  constructor(indexer: CodeIndexer) {
    this.indexer = indexer;
    logger.info('CodeSearch initialized');
  }

  /**
   * Search the codebase for a query
   * @param query The search query
   * @param maxResults The maximum number of results to return
   * @returns The search results
   */
  public search(query: string, maxResults: number = 10): SearchResult[] {
    logger.info(`Searching for: ${query}`);
    
    // Normalize query
    const normalizedQuery = query.toLowerCase().trim();
    
    // Get all files
    const files = this.indexer.getAllFiles();
    
    // Search results
    const results: SearchResult[] = [];
    
    // Search in files
    for (const file of files) {
      const fileResults = this.searchInFile(file, normalizedQuery);
      
      if (fileResults.length > 0) {
        // Group snippets by file
        const snippets = fileResults;
        
        // Get symbols in the file
        const symbols = this.indexer.getSymbolsInFile(file.path)
          .filter(symbol => this.symbolMatchesQuery(symbol, normalizedQuery));
        
        // Calculate relevance score (simple implementation)
        const relevanceScore = snippets.length + (symbols.length * 2);
        
        results.push({
          snippets,
          symbols: symbols.length > 0 ? symbols : undefined,
          relevanceScore
        });
      }
    }
    
    // Sort by relevance score (descending)
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    // Limit results
    return results.slice(0, maxResults);
  }

  /**
   * Search for a query in a file
   * @param file The file to search in
   * @param query The normalized search query
   * @returns The matching snippets
   */
  private searchInFile(file: CodeFile, query: string): CodeSnippet[] {
    const snippets: CodeSnippet[] = [];
    
    // Split content into lines
    const lines = file.content.split('\n');
    
    // Search for query in each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      
      if (line.includes(query)) {
        // Find the start and end of the snippet
        const snippetStart = Math.max(0, i - 2);
        const snippetEnd = Math.min(lines.length - 1, i + 2);
        
        // Extract the snippet
        const snippetContent = lines.slice(snippetStart, snippetEnd + 1).join('\n');
        
        snippets.push({
          filePath: file.path,
          content: snippetContent,
          startLine: snippetStart + 1, // 1-based line numbers
          endLine: snippetEnd + 1,
          language: file.language
        });
      }
    }
    
    return snippets;
  }

  /**
   * Check if a symbol matches a query
   * @param symbol The symbol to check
   * @param query The normalized search query
   * @returns Whether the symbol matches the query
   */
  private symbolMatchesQuery(symbol: CodeSymbol, query: string): boolean {
    return symbol.name.toLowerCase().includes(query) ||
      (symbol.signature?.toLowerCase().includes(query) ?? false) ||
      (symbol.documentation?.toLowerCase().includes(query) ?? false);
  }

  /**
   * Get a file by path
   * @param filePath The path to the file
   * @returns The file, if found
   */
  public getFile(filePath: string): CodeFile | undefined {
    return this.indexer.getFile(filePath);
  }

  /**
   * Get a symbol by name and file path
   * @param name The name of the symbol
   * @param filePath The path to the file
   * @returns The symbol, if found
   */
  public getSymbol(name: string, filePath: string): CodeSymbol | undefined {
    return this.indexer.getSymbol(name, filePath);
  }

  /**
   * Get all symbols in a file
   * @param filePath The path to the file
   * @returns The symbols in the file
   */
  public getSymbolsInFile(filePath: string): CodeSymbol[] {
    return this.indexer.getSymbolsInFile(filePath);
  }
}
