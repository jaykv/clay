// API client for the traces

export interface TraceData {
  id: string;
  method: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body?: any;
  bodyTruncated?: boolean;
  startTime: number;
  endTime?: number;
  duration?: number;
  status?: number;
  response?: any;
  responseTruncated?: boolean;
  error?: Error;
}

export interface TraceStats {
  total: number;
  successRate: number;
  avgResponseTime: number;
  methodCounts: Record<string, number>;
  statusCounts: Record<string, number>;
  truncated?: {
    bodies: number;
    responses: number;
  };
}

export interface PaginationData {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface TracesResponse {
  traces: TraceData[];
  pagination: PaginationData;
}

// Use relative URLs when accessed directly via the proxy server
// or absolute URLs when in VS Code webview
const API_BASE_URL = typeof window.acquireVsCodeApi === 'function'
  ? 'http://localhost:3000'
  : '';

/**
 * Get traces with pagination
 * @param page Page number (starting from 1)
 * @param limit Number of traces per page
 * @returns Promise with the traces and pagination data
 */
export async function getTraces(page = 1, limit = 50): Promise<TracesResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/traces?page=${page}&limit=${limit}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch traces: ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching traces:', error);
    throw error;
  }
}

/**
 * Get a specific trace by ID
 * @param id The trace ID
 * @returns Promise with the trace data
 */
export async function getTraceById(id: string): Promise<TraceData> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/traces/${id}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch trace: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error fetching trace ${id}:`, error);
    throw error;
  }
}

/**
 * Clear all traces
 * @returns Promise with the success status
 */
export async function clearTraces(): Promise<{ success: boolean }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/traces/clear`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error(`Failed to clear traces: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error clearing traces:', error);
    throw error;
  }
}

/**
 * Get trace statistics
 * @returns Promise with the trace statistics
 */
export async function getTraceStats(): Promise<TraceStats> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/traces/stats`);
    if (!response.ok) {
      throw new Error(`Failed to fetch trace stats: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching trace stats:', error);
    throw error;
  }
}
