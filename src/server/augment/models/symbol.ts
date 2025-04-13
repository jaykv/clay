/**
 * Represents a symbol type in the codebase
 */
export enum SymbolType {
  FUNCTION = 'function',
  CLASS = 'class',
  METHOD = 'method',
  VARIABLE = 'variable',
  INTERFACE = 'interface',
  ENUM = 'enum',
  TYPE = 'type',
  NAMESPACE = 'namespace',
  MODULE = 'module',
  PROPERTY = 'property',
  UNKNOWN = 'unknown',
}

/**
 * Represents a symbol in the codebase
 */
export interface CodeSymbol {
  /**
   * The name of the symbol
   */
  name: string;

  /**
   * The type of the symbol
   */
  type: SymbolType;

  /**
   * The file the symbol is defined in
   */
  filePath: string;

  /**
   * The start line of the symbol definition (1-based)
   */
  startLine: number;

  /**
   * The end line of the symbol definition (1-based)
   */
  endLine: number;

  /**
   * The parent symbol, if any (e.g., a method's parent is a class)
   */
  parent?: string;

  /**
   * The signature of the symbol (for functions, methods, etc.)
   */
  signature?: string;

  /**
   * The documentation for the symbol, if any
   */
  documentation?: string;
}
