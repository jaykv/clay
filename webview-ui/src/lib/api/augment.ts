/**
 * API functions for interacting with the Augment Context Engine
 */

// Use relative URLs when accessed directly via the proxy server
// or absolute URLs when in VS Code webview
const API_BASE_URL = typeof window.acquireVsCodeApi === 'function' ? 'http://localhost:3000' : '';

// Types for the API responses
export interface IndexedFile {
  path: string;
  language: string;
  size: number;
  lastModified: number;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface FilesResponse {
  files: IndexedFile[];
  pagination: Pagination;
}

export interface LanguagesResponse {
  languages: string[];
}

/**
 * Get all indexed files with pagination and filtering
 * @param page Page number (starting from 1)
 * @param limit Number of files per page
 * @param filter Optional filter string to search in file paths
 * @param language Optional language filter
 * @returns Promise with the files and pagination data
 */
export async function getIndexedFiles(
  page: number = 1,
  limit: number = 100,
  filter?: string,
  language?: string
): Promise<FilesResponse> {
  try {
    // Build query parameters
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());

    if (filter) {
      params.append('filter', filter);
    }

    if (language) {
      params.append('language', language);
    }

    const response = await fetch(`${API_BASE_URL}/api/augment/files?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch files: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching indexed files:', error);
    throw error;
  }
}

/**
 * Get all available languages in the indexed files
 * @returns Promise with the list of languages
 */
export async function getLanguages(): Promise<string[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/augment/languages`);

    if (!response.ok) {
      throw new Error(`Failed to fetch languages: ${response.statusText}`);
    }

    const data: LanguagesResponse = await response.json();
    return data.languages;
  } catch (error) {
    console.error('Error fetching languages:', error);
    throw error;
  }
}

/**
 * Trigger a reindex of the codebase
 * @returns Promise with the success status
 */
export async function reindexCodebase(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/augment/reindex`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Failed to start reindexing: ${response.statusText}`);
    }

    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('Error starting reindexing:', error);
    throw error;
  }
}

/**
 * Search the codebase
 * @param query Search query
 * @param maxResults Maximum number of results to return
 * @param format Output format (json or html)
 * @returns Promise with the search results
 */
export async function searchCodebase(
  query: string,
  maxResults: number = 10,
  format: 'json' | 'html' = 'json'
): Promise<any> {
  try {
    const params = new URLSearchParams();
    params.append('q', query);
    params.append('limit', maxResults.toString());
    params.append('format', format);

    console.log(
      `Searching codebase with URL: ${API_BASE_URL}/api/augment/search?${params.toString()}`
    );

    const response = await fetch(`${API_BASE_URL}/api/augment/search?${params.toString()}`);
    console.log('Search response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response body:', errorText);
      throw new Error(`Failed to search codebase: ${response.statusText}`);
    }

    const result = format === 'json' ? await response.json() : await response.text();
    console.log('Search API returned:', result);
    return result;
  } catch (error) {
    console.error('Error searching codebase:', error);
    // Return empty results instead of throwing to prevent UI from breaking
    return format === 'json' ? { results: [] } : '';
  }
}

/**
 * Get the index status
 * @returns Promise with the index status
 */
export async function getIndexStatus(): Promise<any> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/augment/status`);

    if (!response.ok) {
      throw new Error(`Failed to get index status: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting index status:', error);
    throw error;
  }
}
