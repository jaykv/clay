// API client for the traces

// OpenTelemetry span interface (simplified for our needs)
export interface OtelSpan {
  spanContext?: () => {
    traceId: string;
    spanId: string;
  };
  name?: string;
  kind?: number;
  startTime: Date | number;
  endTime: Date | number;
  status?: {
    code: number;
    message?: string;
  };
  attributes?: Record<string, any>;
  events?: Array<{
    name: string;
    time: Date;
    attributes: Record<string, any>;
  }>;
  links?: Array<{
    context: {
      traceId: string;
      spanId: string;
    };
    attributes: Record<string, any>;
  }>;
  // New trace format fields
  id?: string;
  method?: string;
  path?: string;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  body?: any;
  bodyTruncated?: boolean;
  duration?: number;
  response?: any;
  responseTruncated?: boolean;
  error?: Error;
}

// Legacy TraceData interface for backward compatibility
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

// Helper function to convert OpenTelemetry span to TraceData
export function otelSpanToTraceData(span: OtelSpan): TraceData {
  // If the span already has the TraceData format, return it directly
  if (span.id && span.method && span.path) {
    return {
      id: span.id,
      method: span.method,
      path: span.path,
      query: span.query || {},
      headers: span.headers || {},
      body: span.body,
      bodyTruncated: span.bodyTruncated,
      startTime: typeof span.startTime === 'number' ? span.startTime : new Date(span.startTime).getTime(),
      endTime: typeof span.endTime === 'number' ? span.endTime : new Date(span.endTime).getTime(),
      duration: span.duration,
      status: span.status?.code || span.status as any,
      response: span.response,
      responseTruncated: span.responseTruncated,
      error: span.error
    } as TraceData;
  }

  // Handle legacy OpenTelemetry format
  if (span.spanContext && typeof span.spanContext === 'function') {
    const context = span.spanContext();
    const httpMethod = span.attributes?.['http.method'] || 'UNKNOWN';
    const httpPath = span.attributes?.['http.target'] || span.name;
    const httpStatus = span.attributes?.['http.status_code'];

    // Extract query parameters
    const query: Record<string, string> = {};
    if (span.attributes?.['http.target']) {
      try {
        const url = new URL('http://localhost' + span.attributes['http.target']);
        url.searchParams.forEach((value, key) => {
          query[key] = value;
        });
      } catch (e) {
        // Ignore URL parsing errors
      }
    }

    // Extract headers
    const headers: Record<string, string> = {};
    if (span.attributes) {
      Object.keys(span.attributes).forEach(key => {
        if (key.startsWith('http.request.header.')) {
          const headerName = key.replace('http.request.header.', '');
          headers[headerName] = String(span.attributes?.[key]);
        }
      });
    }

    // Extract request body if available
    const body = span.attributes?.['http.request.body'];

    // Extract response body if available
    const response = span.attributes?.['http.response.body'];

    const startTimeMs = span.startTime instanceof Date ? span.startTime.getTime() : span.startTime;
    const endTimeMs = span.endTime instanceof Date ? span.endTime.getTime() : span.endTime;

    return {
      id: context.traceId,
      method: String(httpMethod),
      path: String(httpPath),
      query,
      headers,
      body,
      startTime: startTimeMs,
      endTime: endTimeMs,
      duration: endTimeMs - startTimeMs,
      status: httpStatus ? Number(httpStatus) : undefined,
      response,
      error: span.status?.code === 2 ? new Error(span.status.message || 'Error') : undefined
    };
  }

  // Fallback for unknown format
  return {
    id: 'unknown',
    method: 'UNKNOWN',
    path: 'unknown',
    query: {},
    headers: {},
    startTime: Date.now(),
    endTime: Date.now(),
    duration: 0
  };
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
  traces: OtelSpan[];
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
export async function getTraceById(id: string): Promise<OtelSpan> {
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
