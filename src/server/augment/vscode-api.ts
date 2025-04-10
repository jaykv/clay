import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../utils/logger';
import { CodeFile, CodeSymbol, CodeSnippet, SearchResult } from './models';
import { SymbolType } from './models/symbol';

// Define VS Code types for when the module is not available
type VSCodeExtensionContext = any;
type VSCodeTextDocument = any;
type VSCodePosition = any;
type VSCodeRange = any;
type VSCodeLocation = any;
type VSCodeDocumentSymbol = any;
type VSCodeSymbolInformation = any;
type VSCodeHover = any;
type VSCodeCompletionItem = any;
type VSCodeSignatureHelp = any;
type VSCodeDefinition = any;
type VSCodeReference = any;
type VSCodeTypeDefinition = any;
type VSCodeImplementation = any;
type VSCodeCallHierarchyItem = any;
type VSCodeCallHierarchyIncomingCall = any;
type VSCodeCallHierarchyOutgoingCall = any;
type VSCodeSemanticTokens = any;
type VSCodeWorkspaceEdit = any;
type VSCodeFormattingOptions = any;
type VSCodeCancellationToken = any;
type VSCodeUri = any;
type VSCodeWorkspaceFolder = any;
type VSCodeSymbolKind = any;

// Try to import vscode, but don't fail if it's not available
let vscode: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  vscode = require('vscode');
} catch (error) {
  // vscode module is not available
  vscode = undefined;
}

/**
 * VS Code API wrapper for the Augment Context Engine
 * This class provides access to VS Code's language features
 * It should only be used when running as a VS Code extension
 */
export class VSCodeAPI {
  private static instance: VSCodeAPI;
  private initialized = false;
  private context?: any; // VS Code extension context
  private workspaceFolders: string[] = [];
  private rootPath: string = '';

  private constructor() {
    logger.info('VSCodeAPI created');
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): VSCodeAPI {
    if (!VSCodeAPI.instance) {
      VSCodeAPI.instance = new VSCodeAPI();
    }
    return VSCodeAPI.instance;
  }

  /**
   * Initialize the VS Code API with the extension context
   * @param context The VS Code extension context
   */
  public initialize(context?: any): void {
    if (this.initialized) {
      return;
    }

    this.context = context;

    // Check if we're running in VS Code
    if (typeof vscode === 'undefined') {
      logger.warn('VS Code API is not available');
      this.initialized = true;
      return;
    }

    // Get workspace folders
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      this.workspaceFolders = vscode.workspace.workspaceFolders.map((folder: any) => folder.uri.fsPath);
      this.rootPath = this.workspaceFolders[0];
      logger.info(`VS Code workspace folders: ${this.workspaceFolders.join(', ')}`);
    } else if (vscode.workspace.rootPath) {
      // Fallback for older VS Code versions
      this.rootPath = vscode.workspace.rootPath;
      this.workspaceFolders = [this.rootPath];
      logger.info(`VS Code root path: ${this.rootPath}`);
    } else {
      logger.warn('No VS Code workspace folder found');
    }

    this.initialized = true;
    logger.info('VS Code API initialized successfully');
  }

  /**
   * Check if the VS Code API is available
   */
  public isAvailable(): boolean {
    return this.initialized && typeof vscode !== 'undefined';
  }

  /**
   * Get the workspace root path
   */
  public getRootPath(): string {
    return this.rootPath;
  }

  /**
   * Get all workspace folders
   */
  public getWorkspaceFolders(): string[] {
    return [...this.workspaceFolders];
  }

  /**
   * Get document symbols for a file
   * @param filePath The path to the file
   * @returns The symbols in the file
   */
  public async getDocumentSymbols(filePath: string): Promise<CodeSymbol[]> {
    if (!this.isAvailable()) {
      logger.warn('VS Code API is not available');
      return [];
    }

    try {
      // Create a URI for the file
      const uri = vscode.Uri.file(filePath);

      // Try to open the document
      let document: any;
      try {
        document = await vscode.workspace.openTextDocument(uri);
      } catch (error) {
        logger.error(`Could not open document for ${filePath}:`, error);
        return [];
      }

      // Get document symbols
      const symbols = await vscode.commands.executeCommand(
        'vscode.executeDocumentSymbolProvider',
        uri
      ) as any[];

      if (!symbols || symbols.length === 0) {
        logger.debug(`No symbols found for ${filePath}`);
        return [];
      }

      // Convert to our model
      return this.convertDocumentSymbols(symbols, filePath);
    } catch (error) {
      logger.error(`Error getting document symbols for ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Convert VS Code document symbols to our model
   */
  private convertDocumentSymbols(
    symbols: any[],
    filePath: string,
    parentName?: string
  ): CodeSymbol[] {
    const result: CodeSymbol[] = [];

    for (const symbol of symbols) {
      // Check if this is a DocumentSymbol or a SymbolInformation
      const isDocumentSymbol = symbol.children !== undefined;

      // Get the symbol properties
      const name = symbol.name;
      const kind = symbol.kind;
      const range = isDocumentSymbol ? symbol.range : symbol.location.range;
      const containerName = isDocumentSymbol ? parentName : symbol.containerName;
      const detail = isDocumentSymbol ? symbol.detail : undefined;

      // Convert VS Code symbol kind to our symbol type
      const type = this.convertSymbolKind(kind);

      // Create our symbol model
      const codeSymbol: CodeSymbol = {
        name,
        type,
        filePath,
        startLine: range.start.line + 1, // Convert to 1-based
        endLine: range.end.line + 1,
        parent: containerName,
        signature: detail || undefined
      };

      // Add to result
      result.push(codeSymbol);

      // Process children recursively if this is a DocumentSymbol
      if (isDocumentSymbol && symbol.children && symbol.children.length > 0) {
        const childSymbols = this.convertDocumentSymbols(symbol.children, filePath, name);
        result.push(...childSymbols);
      }
    }

    return result;
  }

  /**
   * Search the workspace for symbols
   * @param query The search query
   * @param maxResults The maximum number of results to return
   * @returns The search results
   */
  public async searchWorkspace(query: string, maxResults: number = 10): Promise<SearchResult[]> {
    if (!this.isAvailable()) {
      logger.warn('VS Code API is not available');
      return [];
    }

    try {
      // Use VS Code's workspace symbol provider
      const symbols = await vscode.commands.executeCommand(
        'vscode.executeWorkspaceSymbolProvider',
        query
      ) as any[];

      if (!symbols || symbols.length === 0) {
        logger.debug(`No workspace symbols found for query: ${query}`);
        return [];
      }

      // Group symbols by file
      const fileSymbolMap = new Map<string, any[]>();

      for (const symbol of symbols) {
        const filePath = symbol.location.uri.fsPath;
        const fileSymbols = fileSymbolMap.get(filePath) || [];
        fileSymbols.push(symbol);
        fileSymbolMap.set(filePath, fileSymbols);
      }

      // Convert to our search results format
      const results: SearchResult[] = [];

      for (const [filePath, fileSymbols] of fileSymbolMap.entries()) {
        try {
          // Get the document
          const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));

          // Extract snippets around the symbols
          const snippets: CodeSnippet[] = [];
          const convertedSymbols: CodeSymbol[] = [];

          for (const symbol of fileSymbols) {
            // Convert to our symbol model
            const convertedSymbol = this.convertSymbolInformation(symbol, filePath);
            convertedSymbols.push(convertedSymbol);

            // Extract snippet
            const range = symbol.location.range;
            const startLine = Math.max(0, range.start.line - 2);
            const endLine = Math.min(document.lineCount - 1, range.end.line + 2);

            const snippetContent = document.getText(new vscode.Range(
              new vscode.Position(startLine, 0),
              new vscode.Position(endLine, document.lineAt(endLine).text.length)
            ));

            snippets.push({
              filePath,
              content: snippetContent,
              startLine: startLine + 1, // Convert to 1-based
              endLine: endLine + 1,
              language: document.languageId
            });
          }

          // Add to results
          results.push({
            snippets,
            symbols: convertedSymbols,
            relevanceScore: fileSymbols.length * 2 // VS Code results get higher relevance
          });
        } catch (error) {
          logger.error(`Error processing file ${filePath}:`, error);
          // Continue with other files even if one fails
        }
      }

      // Sort by relevance score
      results.sort((a, b) => b.relevanceScore - a.relevanceScore);

      // Limit results
      return results.slice(0, maxResults);
    } catch (error) {
      logger.error('Error searching workspace:', error);
      return [];
    }
  }

  /**
   * Convert VS Code symbol information to our model
   */
  private convertSymbolInformation(symbol: any, filePath: string): CodeSymbol {
    return {
      name: symbol.name,
      type: this.convertSymbolKind(symbol.kind),
      filePath,
      startLine: symbol.location.range.start.line + 1, // Convert to 1-based
      endLine: symbol.location.range.end.line + 1,
      parent: symbol.containerName || undefined
    };
  }

  /**
   * Convert VS Code symbol kind to our symbol type
   */
  private convertSymbolKind(kind: any): SymbolType {
    if (!vscode) {
      return SymbolType.UNKNOWN;
    }

    switch (kind) {
      case vscode.SymbolKind.Function:
        return SymbolType.FUNCTION;
      case vscode.SymbolKind.Method:
        return SymbolType.METHOD;
      case vscode.SymbolKind.Class:
        return SymbolType.CLASS;
      case vscode.SymbolKind.Interface:
        return SymbolType.INTERFACE;
      case vscode.SymbolKind.Enum:
        return SymbolType.ENUM;
      case vscode.SymbolKind.Variable:
        return SymbolType.VARIABLE;
      case vscode.SymbolKind.Property:
        return SymbolType.PROPERTY;
      case vscode.SymbolKind.Module:
      case vscode.SymbolKind.Namespace:
        return SymbolType.NAMESPACE;
      case vscode.SymbolKind.Constructor:
        return SymbolType.METHOD;
      case vscode.SymbolKind.TypeParameter:
        return SymbolType.TYPE;
      default:
        return SymbolType.UNKNOWN;
    }
  }

  /**
   * Get the definition of a symbol
   * @param filePath The path to the file
   * @param line The line number (1-based)
   * @param character The character position
   * @returns The definition of the symbol
   */
  public async getDefinition(filePath: string, line: number, character: number): Promise<CodeSymbol | undefined> {
    if (!this.isAvailable()) {
      logger.warn('VS Code API is not available');
      return undefined;
    }

    try {
      // Create a URI for the file
      const uri = vscode.Uri.file(filePath);

      // Create a position (0-based)
      const position = new vscode.Position(line - 1, character);

      // Get definition
      const definitions = await vscode.commands.executeCommand(
        'vscode.executeDefinitionProvider',
        uri,
        position
      ) as any[];

      if (!definitions || definitions.length === 0) {
        logger.debug(`No definition found at ${filePath}:${line}:${character}`);
        return undefined;
      }

      // Get the first definition
      const definition = definitions[0];

      // Get the document
      const document = await vscode.workspace.openTextDocument(definition.uri);

      // Try to get more information about the symbol
      const symbols = await vscode.commands.executeCommand(
        'vscode.executeDocumentSymbolProvider',
        definition.uri
      ) as any[];

      if (symbols && symbols.length > 0) {
        // Find the symbol that contains the definition
        const symbol = this.findSymbolAtPosition(symbols, definition.range.start);

        if (symbol) {
          return {
            name: symbol.name,
            type: this.convertSymbolKind(symbol.kind),
            filePath: definition.uri.fsPath,
            startLine: symbol.range.start.line + 1, // Convert to 1-based
            endLine: symbol.range.end.line + 1,
            signature: symbol.detail || undefined
          };
        }
      }

      // If we couldn't find the symbol, create a basic one
      return {
        name: document.getText(definition.range),
        type: SymbolType.UNKNOWN,
        filePath: definition.uri.fsPath,
        startLine: definition.range.start.line + 1, // Convert to 1-based
        endLine: definition.range.end.line + 1
      };
    } catch (error) {
      logger.error('Error getting definition:', error);
      return undefined;
    }
  }

  /**
   * Find a symbol at a position
   */
  private findSymbolAtPosition(symbols: any[], position: any): any {
    for (const symbol of symbols) {
      // Check if this is a DocumentSymbol (has children) or a SymbolInformation
      const isDocumentSymbol = symbol.children !== undefined;
      const range = isDocumentSymbol ? symbol.range : symbol.location.range;

      if (this.rangeContainsPosition(range, position)) {
        // Check if any child contains the position
        if (isDocumentSymbol && symbol.children && symbol.children.length > 0) {
          const childSymbol = this.findSymbolAtPosition(symbol.children, position);
          if (childSymbol) {
            return childSymbol;
          }
        }

        // Return this symbol
        return symbol;
      }
    }

    return undefined;
  }

  /**
   * Check if a range contains a position
   */
  private rangeContainsPosition(range: any, position: any): boolean {
    if (!range || !position) {
      return false;
    }

    // Check if position is within the range
    if (position.line < range.start.line || position.line > range.end.line) {
      return false;
    }

    if (position.line === range.start.line && position.character < range.start.character) {
      return false;
    }

    if (position.line === range.end.line && position.character > range.end.character) {
      return false;
    }

    return true;
  }

  /**
   * Get a file
   * @param filePath The path to the file
   * @returns The file
   */
  public async getFile(filePath: string): Promise<CodeFile | undefined> {
    if (!this.isAvailable()) {
      // If VS Code API is not available, try to read the file from disk
      try {
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');
          const stats = fs.statSync(filePath);
          const extension = path.extname(filePath).toLowerCase();

          return {
            path: filePath,
            content,
            language: this.getLanguageFromExtension(extension),
            size: stats.size,
            lastModified: stats.mtimeMs
          };
        }
      } catch (error) {
        logger.error(`Error reading file ${filePath} from disk:`, error);
      }

      return undefined;
    }

    try {
      // Create a URI for the file
      const uri = vscode.Uri.file(filePath);

      // Get the document
      const document = await vscode.workspace.openTextDocument(uri);

      // Create file object
      return {
        path: filePath,
        content: document.getText(),
        language: document.languageId,
        size: document.getText().length,
        lastModified: Date.now()
      };
    } catch (error) {
      logger.error(`Error getting file ${filePath}:`, error);
      return undefined;
    }
  }

  /**
   * Get the language from a file extension
   */
  private getLanguageFromExtension(extension: string): string {
    switch (extension) {
      case '.js':
        return 'javascript';
      case '.ts':
        return 'typescript';
      case '.jsx':
        return 'javascriptreact';
      case '.tsx':
        return 'typescriptreact';
      case '.py':
        return 'python';
      case '.java':
        return 'java';
      case '.c':
        return 'c';
      case '.cpp':
      case '.cc':
      case '.cxx':
        return 'cpp';
      case '.go':
        return 'go';
      case '.rs':
        return 'rust';
      case '.php':
        return 'php';
      case '.rb':
        return 'ruby';
      case '.cs':
        return 'csharp';
      case '.swift':
        return 'swift';
      case '.kt':
      case '.kts':
        return 'kotlin';
      case '.dart':
        return 'dart';
      case '.html':
      case '.htm':
        return 'html';
      case '.css':
        return 'css';
      case '.scss':
        return 'scss';
      case '.less':
        return 'less';
      case '.json':
        return 'json';
      case '.xml':
        return 'xml';
      case '.yaml':
      case '.yml':
        return 'yaml';
      case '.md':
        return 'markdown';
      case '.sh':
        return 'shellscript';
      case '.sql':
        return 'sql';
      default:
        return 'plaintext';
    }
  }

  /**
   * Get references to a symbol
   * @param filePath The path to the file
   * @param line The line number (1-based)
   * @param character The character position
   * @returns The references to the symbol
   */
  public async getReferences(filePath: string, line: number, character: number): Promise<CodeSymbol[]> {
    if (!this.isAvailable()) {
      logger.warn('VS Code API is not available');
      return [];
    }

    try {
      // Create a URI for the file
      const uri = vscode.Uri.file(filePath);

      // Create a position (0-based)
      const position = new vscode.Position(line - 1, character);

      // Get references
      const references = await vscode.commands.executeCommand(
        'vscode.executeReferenceProvider',
        uri,
        position,
        { includeDeclaration: true }
      ) as any[];

      if (!references || references.length === 0) {
        logger.debug(`No references found for symbol at ${filePath}:${line}:${character}`);
        return [];
      }

      // Convert to our model
      const result: CodeSymbol[] = [];

      for (const reference of references) {
        try {
          // Get the document
          const document = await vscode.workspace.openTextDocument(reference.uri);

          // Create symbol
          result.push({
            name: document.getText(reference.range),
            type: SymbolType.UNKNOWN,
            filePath: reference.uri.fsPath,
            startLine: reference.range.start.line + 1, // Convert to 1-based
            endLine: reference.range.end.line + 1
          });
        } catch (error) {
          logger.error(`Error processing reference at ${reference.uri.fsPath}:`, error);
          // Continue with other references even if one fails
        }
      }

      return result;
    } catch (error) {
      logger.error('Error getting references:', error);
      return [];
    }
  }

  /**
   * Get hover information for a symbol
   * @param filePath The path to the file
   * @param line The line number (1-based)
   * @param character The character position
   * @returns The hover information for the symbol
   */
  public async getHover(filePath: string, line: number, character: number): Promise<string | undefined> {
    if (!this.isAvailable()) {
      logger.warn('VS Code API is not available');
      return undefined;
    }

    try {
      // Create a URI for the file
      const uri = vscode.Uri.file(filePath);

      // Create a position (0-based)
      const position = new vscode.Position(line - 1, character);

      // Get hover information
      const hovers = await vscode.commands.executeCommand(
        'vscode.executeHoverProvider',
        uri,
        position
      ) as any[];

      if (!hovers || hovers.length === 0) {
        logger.debug(`No hover information found at ${filePath}:${line}:${character}`);
        return undefined;
      }

      // Get the first hover
      const hover = hovers[0];

      // Extract the content
      let content = '';

      if (hover.contents) {
        if (Array.isArray(hover.contents)) {
          // Multiple contents
          for (const item of hover.contents) {
            if (typeof item === 'string') {
              content += item + '\n';
            } else if (item.value) {
              content += item.value + '\n';
            }
          }
        } else if (typeof hover.contents === 'string') {
          // Single string content
          content = hover.contents;
        } else if (hover.contents.value) {
          // Single object content
          content = hover.contents.value;
        }
      }

      return content.trim();
    } catch (error) {
      logger.error('Error getting hover information:', error);
      return undefined;
    }
  }

  /**
   * Get type definition of a symbol
   * @param filePath The path to the file
   * @param line The line number (1-based)
   * @param character The character position
   * @returns The type definition of the symbol
   */
  public async getTypeDefinition(filePath: string, line: number, character: number): Promise<CodeSymbol | undefined> {
    if (!this.isAvailable()) {
      logger.warn('VS Code API is not available');
      return undefined;
    }

    try {
      // Create a URI for the file
      const uri = vscode.Uri.file(filePath);

      // Create a position (0-based)
      const position = new vscode.Position(line - 1, character);

      // Get type definition
      const typeDefinitions = await vscode.commands.executeCommand(
        'vscode.executeTypeDefinitionProvider',
        uri,
        position
      ) as any[];

      if (!typeDefinitions || typeDefinitions.length === 0) {
        logger.debug(`No type definition found at ${filePath}:${line}:${character}`);
        return undefined;
      }

      // Get the first type definition
      const typeDefinition = typeDefinitions[0];

      // Get the document
      const document = await vscode.workspace.openTextDocument(typeDefinition.uri);

      // Try to get more information about the symbol
      const symbols = await vscode.commands.executeCommand(
        'vscode.executeDocumentSymbolProvider',
        typeDefinition.uri
      ) as any[];

      if (symbols && symbols.length > 0) {
        // Find the symbol that contains the type definition
        const symbol = this.findSymbolAtPosition(symbols, typeDefinition.range.start);

        if (symbol) {
          return {
            name: symbol.name,
            type: this.convertSymbolKind(symbol.kind),
            filePath: typeDefinition.uri.fsPath,
            startLine: symbol.range.start.line + 1, // Convert to 1-based
            endLine: symbol.range.end.line + 1,
            signature: symbol.detail || undefined
          };
        }
      }

      // If we couldn't find the symbol, create a basic one
      return {
        name: document.getText(typeDefinition.range),
        type: SymbolType.UNKNOWN,
        filePath: typeDefinition.uri.fsPath,
        startLine: typeDefinition.range.start.line + 1, // Convert to 1-based
        endLine: typeDefinition.range.end.line + 1
      };
    } catch (error) {
      logger.error('Error getting type definition:', error);
      return undefined;
    }
  }

  /**
   * Get implementations of a symbol
   * @param filePath The path to the file
   * @param line The line number (1-based)
   * @param character The character position
   * @returns The implementations of the symbol
   */
  public async getImplementations(filePath: string, line: number, character: number): Promise<CodeSymbol[]> {
    if (!this.isAvailable()) {
      logger.warn('VS Code API is not available');
      return [];
    }

    try {
      // Create a URI for the file
      const uri = vscode.Uri.file(filePath);

      // Create a position (0-based)
      const position = new vscode.Position(line - 1, character);

      // Get implementations
      const implementations = await vscode.commands.executeCommand(
        'vscode.executeImplementationProvider',
        uri,
        position
      ) as any[];

      if (!implementations || implementations.length === 0) {
        logger.debug(`No implementations found for symbol at ${filePath}:${line}:${character}`);
        return [];
      }

      // Convert to our model
      const result: CodeSymbol[] = [];

      for (const implementation of implementations) {
        try {
          // Get the document
          const document = await vscode.workspace.openTextDocument(implementation.uri);

          // Try to get more information about the symbol
          const symbols = await vscode.commands.executeCommand(
            'vscode.executeDocumentSymbolProvider',
            implementation.uri
          ) as any[];

          if (symbols && symbols.length > 0) {
            // Find the symbol that contains the implementation
            const symbol = this.findSymbolAtPosition(symbols, implementation.range.start);

            if (symbol) {
              result.push({
                name: symbol.name,
                type: this.convertSymbolKind(symbol.kind),
                filePath: implementation.uri.fsPath,
                startLine: symbol.range.start.line + 1, // Convert to 1-based
                endLine: symbol.range.end.line + 1,
                signature: symbol.detail || undefined
              });
              continue;
            }
          }

          // If we couldn't find the symbol, create a basic one
          result.push({
            name: document.getText(implementation.range),
            type: SymbolType.UNKNOWN,
            filePath: implementation.uri.fsPath,
            startLine: implementation.range.start.line + 1, // Convert to 1-based
            endLine: implementation.range.end.line + 1
          });
        } catch (error) {
          logger.error(`Error processing implementation at ${implementation.uri.fsPath}:`, error);
          // Continue with other implementations even if one fails
        }
      }

      return result;
    } catch (error) {
      logger.error('Error getting implementations:', error);
      return [];
    }
  }

  /**
   * Get call hierarchy items for a symbol
   * @param filePath The path to the file
   * @param line The line number (1-based)
   * @param character The character position
   * @returns The call hierarchy items for the symbol
   */
  public async getCallHierarchyItems(filePath: string, line: number, character: number): Promise<any[]> {
    if (!this.isAvailable()) {
      logger.warn('VS Code API is not available');
      return [];
    }

    try {
      // Create a URI for the file
      const uri = vscode.Uri.file(filePath);

      // Create a position (0-based)
      const position = new vscode.Position(line - 1, character);

      // Get call hierarchy items
      const items = await vscode.commands.executeCommand(
        'vscode.prepareCallHierarchy',
        uri,
        position
      ) as any[];

      if (!items || items.length === 0) {
        logger.debug(`No call hierarchy items found at ${filePath}:${line}:${character}`);
        return [];
      }

      return items;
    } catch (error) {
      logger.error('Error getting call hierarchy items:', error);
      return [];
    }
  }

  /**
   * Get incoming calls for a call hierarchy item
   * @param item The call hierarchy item
   * @returns The incoming calls for the item
   */
  public async getIncomingCalls(item: any): Promise<any[]> {
    if (!this.isAvailable()) {
      logger.warn('VS Code API is not available');
      return [];
    }

    try {
      // Get incoming calls
      const calls = await vscode.commands.executeCommand(
        'vscode.provideIncomingCalls',
        item
      ) as any[];

      if (!calls || calls.length === 0) {
        logger.debug(`No incoming calls found for ${item.name}`);
        return [];
      }

      return calls;
    } catch (error) {
      logger.error('Error getting incoming calls:', error);
      return [];
    }
  }

  /**
   * Get outgoing calls for a call hierarchy item
   * @param item The call hierarchy item
   * @returns The outgoing calls for the item
   */
  public async getOutgoingCalls(item: any): Promise<any[]> {
    if (!this.isAvailable()) {
      logger.warn('VS Code API is not available');
      return [];
    }

    try {
      // Get outgoing calls
      const calls = await vscode.commands.executeCommand(
        'vscode.provideOutgoingCalls',
        item
      ) as any[];

      if (!calls || calls.length === 0) {
        logger.debug(`No outgoing calls found for ${item.name}`);
        return [];
      }

      return calls;
    } catch (error) {
      logger.error('Error getting outgoing calls:', error);
      return [];
    }
  }

  /**
   * Get semantic tokens for a file
   * @param filePath The path to the file
   * @returns The semantic tokens for the file
   */
  public async getSemanticTokens(filePath: string): Promise<any | undefined> {
    if (!this.isAvailable()) {
      logger.warn('VS Code API is not available');
      return undefined;
    }

    try {
      // Create a URI for the file
      const uri = vscode.Uri.file(filePath);

      // Get semantic tokens
      const tokens = await vscode.commands.executeCommand(
        'vscode.provideDocumentSemanticTokens',
        uri
      ) as any;

      if (!tokens) {
        logger.debug(`No semantic tokens found for ${filePath}`);
        return undefined;
      }

      return tokens;
    } catch (error) {
      logger.error('Error getting semantic tokens:', error);
      return undefined;
    }
  }

  /**
   * Format a document
   * @param filePath The path to the file
   * @returns The formatted document text
   */
  public async formatDocument(filePath: string): Promise<string | undefined> {
    if (!this.isAvailable()) {
      logger.warn('VS Code API is not available');
      return undefined;
    }

    try {
      // Create a URI for the file
      const uri = vscode.Uri.file(filePath);

      // Get the document
      const document = await vscode.workspace.openTextDocument(uri);

      // Get formatting edits
      const edits = await vscode.commands.executeCommand(
        'vscode.executeFormatDocumentProvider',
        uri,
        {
          insertSpaces: true,
          tabSize: 2
        }
      ) as any[];

      if (!edits || edits.length === 0) {
        logger.debug(`No formatting edits found for ${filePath}`);
        return document.getText();
      }

      // Apply edits to the document text
      let text = document.getText();

      // Sort edits in reverse order to avoid position changes
      edits.sort((a: any, b: any) => {
        if (a.range.start.line !== b.range.start.line) {
          return b.range.start.line - a.range.start.line;
        }
        return b.range.start.character - a.range.start.character;
      });

      // Apply edits
      for (const edit of edits) {
        const startOffset = document.offsetAt(edit.range.start);
        const endOffset = document.offsetAt(edit.range.end);
        text = text.substring(0, startOffset) + edit.newText + text.substring(endOffset);
      }

      return text;
    } catch (error) {
      logger.error('Error formatting document:', error);
      return undefined;
    }
  }


}
