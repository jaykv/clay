/**
 * Code Chunker - AST-based code parsing for semantic chunks (Augment pattern)
 * Creates meaningful code chunks based on language structure, not arbitrary text splits
 */

import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { logger } from '../../utils/logger';
import { CodeChunk, CodeChunkType, SupportedLanguage } from './models';
import * as crypto from 'crypto';
import * as path from 'path';

/**
 * Parser configuration for different languages
 */
interface ParserConfig {
  language: SupportedLanguage;
  extensions: string[];
  parseOptions: any;
}

/**
 * Code chunker using AST analysis (Augment-style semantic understanding)
 */
export class CodeChunker {
  private parserConfigs: Map<SupportedLanguage, ParserConfig>;

  constructor() {
    this.parserConfigs = new Map([
      ['javascript', {
        language: 'javascript',
        extensions: ['.js', '.jsx'],
        parseOptions: {
          sourceType: 'module',
          allowImportExportEverywhere: true,
          allowReturnOutsideFunction: true,
          plugins: ['jsx', 'decorators-legacy', 'dynamicImport'],
        },
      }],
      ['typescript', {
        language: 'typescript',
        extensions: ['.ts', '.tsx'],
        parseOptions: {
          sourceType: 'module',
          allowImportExportEverywhere: true,
          allowReturnOutsideFunction: true,
          plugins: ['typescript', 'jsx', 'decorators-legacy', 'dynamicImport'],
        },
      }],
    ]);

    logger.info('CodeChunker initialized with AST-based parsing');
  }

  /**
   * Parse file into semantic code chunks
   */
  public async parseFile(filePath: string, content: string): Promise<CodeChunk[]> {
    const language = this.detectLanguage(filePath);
    if (!language) {
      logger.debug(`Unsupported file type: ${filePath}`);
      return this.createFallbackChunks(filePath, content, 'markdown');
    }

    try {
      switch (language) {
        case 'javascript':
        case 'typescript':
          return this.parseJavaScriptTypeScript(filePath, content, language);
        case 'python':
          return this.parsePython(filePath, content);
        case 'markdown':
          return this.parseMarkdown(filePath, content);
        case 'json':
          return this.parseJSON(filePath, content);
        default:
          return this.createFallbackChunks(filePath, content, language);
      }
    } catch (error) {
      logger.error(`Failed to parse ${filePath}:`, error);
      return this.createFallbackChunks(filePath, content, language);
    }
  }

  /**
   * Parse JavaScript/TypeScript using Babel AST
   */
  private parseJavaScriptTypeScript(
    filePath: string,
    content: string,
    language: SupportedLanguage
  ): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const config = this.parserConfigs.get(language)!;

    try {
      const ast = parse(content, config.parseOptions);
      const lines = content.split('\n');

      traverse(ast, {
        // Function declarations
        FunctionDeclaration: (path) => {
          const node = path.node;
          if (node.loc) {
            chunks.push(this.createChunk({
              filePath,
              type: 'function',
              name: node.id?.name || 'anonymous',
              startLine: node.loc.start.line,
              endLine: node.loc.end.line,
              content: this.extractLines(lines, node.loc.start.line, node.loc.end.line),
              context: this.getContext(lines, node.loc.start.line, node.loc.end.line),
              language,
              metadata: {
                isPublic: this.isExported(path),
                documentation: this.extractDocumentation(lines, node.loc.start.line),
              },
            }));
          }
        },

        // Arrow functions and function expressions
        VariableDeclarator: (path) => {
          const node = path.node;
          if (t.isArrowFunctionExpression(node.init) || t.isFunctionExpression(node.init)) {
            if (node.loc && node.init.loc) {
              chunks.push(this.createChunk({
                filePath,
                type: 'function',
                name: t.isIdentifier(node.id) ? node.id.name : 'anonymous',
                startLine: node.loc.start.line,
                endLine: node.init.loc.end.line,
                content: this.extractLines(lines, node.loc.start.line, node.init.loc.end.line),
                context: this.getContext(lines, node.loc.start.line, node.init.loc.end.line),
                language,
                metadata: {
                  isPublic: this.isExported(path),
                },
              }));
            }
          }
        },

        // Class declarations
        ClassDeclaration: (path) => {
          const node = path.node;
          if (node.loc) {
            chunks.push(this.createChunk({
              filePath,
              type: 'class',
              name: node.id?.name || 'anonymous',
              startLine: node.loc.start.line,
              endLine: node.loc.end.line,
              content: this.extractLines(lines, node.loc.start.line, node.loc.end.line),
              context: this.getContext(lines, node.loc.start.line, node.loc.end.line),
              language,
              metadata: {
                isPublic: this.isExported(path),
                documentation: this.extractDocumentation(lines, node.loc.start.line),
              },
            }));
          }
        },

        // Interface declarations (TypeScript)
        TSInterfaceDeclaration: (path) => {
          const node = path.node;
          if (node.loc) {
            chunks.push(this.createChunk({
              filePath,
              type: 'interface',
              name: node.id.name,
              startLine: node.loc.start.line,
              endLine: node.loc.end.line,
              content: this.extractLines(lines, node.loc.start.line, node.loc.end.line),
              context: this.getContext(lines, node.loc.start.line, node.loc.end.line),
              language,
              metadata: {
                isPublic: this.isExported(path),
                documentation: this.extractDocumentation(lines, node.loc.start.line),
              },
            }));
          }
        },

        // Import declarations
        ImportDeclaration: (path) => {
          const node = path.node;
          if (node.loc) {
            chunks.push(this.createChunk({
              filePath,
              type: 'import',
              name: node.source.value,
              startLine: node.loc.start.line,
              endLine: node.loc.end.line,
              content: this.extractLines(lines, node.loc.start.line, node.loc.end.line),
              context: '',
              language,
              dependencies: [node.source.value],
            }));
          }
        },

        // Export declarations
        ExportDeclaration: (path) => {
          const node = path.node;
          if (node.loc) {
            chunks.push(this.createChunk({
              filePath,
              type: 'export',
              name: this.getExportName(node),
              startLine: node.loc.start.line,
              endLine: node.loc.end.line,
              content: this.extractLines(lines, node.loc.start.line, node.loc.end.line),
              context: this.getContext(lines, node.loc.start.line, node.loc.end.line),
              language,
              metadata: {
                isPublic: true,
              },
            }));
          }
        },
      });

      logger.debug(`Parsed ${chunks.length} chunks from ${filePath}`);
      return chunks;
    } catch (error) {
      logger.error(`AST parsing failed for ${filePath}:`, error);
      return this.createFallbackChunks(filePath, content, language);
    }
  }

  /**
   * Parse Python files (basic implementation)
   */
  private parsePython(filePath: string, content: string): CodeChunk[] {
    // For now, use regex-based parsing for Python
    // TODO: Implement proper Python AST parsing
    return this.createFallbackChunks(filePath, content, 'python');
  }

  /**
   * Parse Markdown files
   */
  private parseMarkdown(filePath: string, content: string): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const lines = content.split('\n');
    
    let currentChunk: { start: number; title?: string } | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Detect headers
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headerMatch) {
        // Save previous chunk
        if (currentChunk) {
          chunks.push(this.createChunk({
            filePath,
            type: 'module',
            name: currentChunk.title || 'Section',
            startLine: currentChunk.start,
            endLine: i,
            content: this.extractLines(lines, currentChunk.start, i),
            context: '',
            language: 'markdown',
          }));
        }

        // Start new chunk
        currentChunk = {
          start: i + 1,
          title: headerMatch[2],
        };
      }
    }

    // Save final chunk
    if (currentChunk) {
      chunks.push(this.createChunk({
        filePath,
        type: 'module',
        name: currentChunk.title || 'Section',
        startLine: currentChunk.start,
        endLine: lines.length,
        content: this.extractLines(lines, currentChunk.start, lines.length),
        context: '',
        language: 'markdown',
      }));
    }

    return chunks;
  }

  /**
   * Parse JSON files
   */
  private parseJSON(filePath: string, content: string): CodeChunk[] {
    try {
      JSON.parse(content); // Validate JSON
      return [this.createChunk({
        filePath,
        type: 'module',
        name: path.basename(filePath),
        startLine: 1,
        endLine: content.split('\n').length,
        content,
        context: '',
        language: 'json',
      })];
    } catch (error) {
      logger.error(`Invalid JSON in ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Create fallback chunks for unsupported languages
   */
  private createFallbackChunks(
    filePath: string,
    content: string,
    language: SupportedLanguage
  ): CodeChunk[] {
    const lines = content.split('\n');
    const chunkSize = 50; // Lines per chunk
    const chunks: CodeChunk[] = [];

    for (let i = 0; i < lines.length; i += chunkSize) {
      const endLine = Math.min(i + chunkSize, lines.length);
      chunks.push(this.createChunk({
        filePath,
        type: 'module',
        name: `${path.basename(filePath)}_${Math.floor(i / chunkSize) + 1}`,
        startLine: i + 1,
        endLine,
        content: this.extractLines(lines, i + 1, endLine),
        context: '',
        language,
      }));
    }

    return chunks;
  }

  /**
   * Helper methods
   */
  private detectLanguage(filePath: string): SupportedLanguage | null {
    const ext = path.extname(filePath).toLowerCase();
    
    for (const [language, config] of this.parserConfigs) {
      if (config.extensions.includes(ext)) {
        return language;
      }
    }

    // Additional extensions
    if (['.md', '.mdx'].includes(ext)) return 'markdown';
    if (['.json'].includes(ext)) return 'json';
    if (['.py'].includes(ext)) return 'python';

    return null;
  }

  private createChunk(params: {
    filePath: string;
    type: CodeChunkType;
    name: string;
    startLine: number;
    endLine: number;
    content: string;
    context: string;
    language: SupportedLanguage;
    dependencies?: string[];
    metadata?: any;
  }): CodeChunk {
    const id = this.generateChunkId(params.filePath, params.startLine, params.endLine);
    const hash = crypto.createHash('sha256').update(params.content).digest('hex');
    const now = Date.now();

    return {
      id,
      filePath: params.filePath,
      type: params.type,
      name: params.name,
      startLine: params.startLine,
      endLine: params.endLine,
      content: params.content,
      context: params.context,
      dependencies: params.dependencies || [],
      hash,
      language: params.language,
      metadata: params.metadata || {},
      createdAt: now,
      updatedAt: now,
    };
  }

  private generateChunkId(filePath: string, startLine: number, endLine: number): string {
    return crypto
      .createHash('md5')
      .update(`${filePath}:${startLine}-${endLine}`)
      .digest('hex');
  }

  private extractLines(lines: string[], start: number, end: number): string {
    return lines.slice(start - 1, end).join('\n');
  }

  private getContext(lines: string[], start: number, end: number, contextLines = 3): string {
    const contextStart = Math.max(0, start - contextLines - 1);
    const contextEnd = Math.min(lines.length, end + contextLines);
    return lines.slice(contextStart, contextEnd).join('\n');
  }

  private extractDocumentation(lines: string[], lineNumber: number): string | undefined {
    // Look for JSDoc comments before the line
    for (let i = lineNumber - 2; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith('/**') || line.startsWith('/*')) {
        const docLines: string[] = [];
        for (let j = i; j < lineNumber - 1; j++) {
          docLines.push(lines[j]);
        }
        return docLines.join('\n');
      }
      if (line && !line.startsWith('//') && !line.startsWith('*')) {
        break;
      }
    }
    return undefined;
  }

  private isExported(path: any): boolean {
    // Check if the node is exported
    return path.isExportDeclaration() || 
           path.isExportDefaultDeclaration() ||
           path.isExportNamedDeclaration();
  }

  private getExportName(node: any): string {
    if (t.isExportDefaultDeclaration(node)) {
      return 'default';
    }
    if (t.isExportNamedDeclaration(node) && node.declaration) {
      if (t.isFunctionDeclaration(node.declaration) || t.isClassDeclaration(node.declaration)) {
        return node.declaration.id?.name || 'anonymous';
      }
    }
    return 'export';
  }
}
