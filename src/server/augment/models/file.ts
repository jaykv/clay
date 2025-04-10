/**
 * Represents a file in the codebase
 */
export interface CodeFile {
  /**
   * The path to the file, relative to the workspace root
   */
  path: string;

  /**
   * The content of the file
   */
  content: string;

  /**
   * The language of the file
   */
  language: string;

  /**
   * The size of the file in bytes
   */
  size: number;

  /**
   * The last modified time of the file
   */
  lastModified: number;
}

/**
 * Represents a code snippet from a file
 */
export interface CodeSnippet {
  /**
   * The file the snippet is from
   */
  filePath: string;

  /**
   * The content of the snippet
   */
  content: string;

  /**
   * The start line of the snippet (1-based)
   */
  startLine: number;

  /**
   * The end line of the snippet (1-based)
   */
  endLine: number;

  /**
   * The language of the snippet
   */
  language: string;
}
