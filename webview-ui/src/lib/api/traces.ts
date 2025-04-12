// API client for the traces
import { wsClient } from './websocket';

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


/**
 * Get traces with pagination
 * @param page Page number (starting from 1)
 * @param limit Number of traces per page
 * @returns Promise with the traces and pagination data
 */
export async function getTraces(page = 1, limit = 50): Promise<TracesResponse> {
  try {
    // Check if WebSocket is connected
    if (!wsClient.isConnected()) {
      // Fall back to HTTP if WebSocket is not connected
      console.log('WebSocket not connected, falling back to HTTP');
      const response = await fetch(`/api/traces?page=${page}&limit=${limit}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch traces: ${response.statusText}`);
      }
      return await response.json();
    }

    // Use WebSocket
    return new Promise((resolve, reject) => {
      // Set up a one-time listener for the traces response
      const handleTracesResponse = (message: any) => {
        wsClient.off('traces', handleTracesResponse);
        resolve(message.data);
      };

      // Set up error handling
      const handleError = (message: any) => {
        if (message.message && message.message.includes('traces')) {
          wsClient.off('error', handleError);
          reject(new Error(message.message));
        }
      };

      // Register listeners
      wsClient.on('traces', handleTracesResponse);
      wsClient.on('error', handleError);

      // Request traces
      wsClient.getTraces(page, limit);

      // Set a timeout to prevent hanging
      setTimeout(() => {
        wsClient.off('traces', handleTracesResponse);
        wsClient.off('error', handleError);
        console.warn(`Timeout waiting for traces response, but data might arrive later ${page}`);
        // Don't reject, just resolve with empty data - the real data might arrive later
        // and the component will update when it does
        resolve({
          traces: [],
          pagination: {
            total: 0,
            page,
            limit,
            pages: 0
          }
        });
      }, 5000); // Increased timeout to 5 seconds
    });
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
  return new Promise((resolve, reject) => {
    // Set up a one-time listener for the trace response
    const handleTraceResponse = (message: any) => {
      wsClient.off('trace', handleTraceResponse);
      resolve(message.data);
    };

    // Set up error handling
    const handleError = (message: any) => {
      if (message.message && message.message.includes('trace')) {
        wsClient.off('error', handleError);
        reject(new Error(message.message));
      }
    };

    // Register listeners
    wsClient.on('trace', handleTraceResponse);
    wsClient.on('error', handleError);

    // Request trace
    wsClient.getTrace(id);

    // Set a timeout to prevent hanging
    setTimeout(() => {
      wsClient.off('trace', handleTraceResponse);
      wsClient.off('error', handleError);
      reject(new Error(`Timeout waiting for trace ${id}`));
    }, 5000);
  });
}

/**
 * Clear all traces
 * @returns Promise with the success status
 */
export async function clearTraces(): Promise<{ success: boolean }> {
  return new Promise((resolve, reject) => {
    // Set up a one-time listener for the clear response
    const handleClearResponse = (_message: any) => {
      wsClient.off('tracesCleared', handleClearResponse);
      resolve({ success: true });
    };

    // Set up error handling
    const handleError = (message: any) => {
      if (message.message && message.message.includes('clear')) {
        wsClient.off('error', handleError);
        reject(new Error(message.message));
      }
    };

    // Register listeners
    wsClient.on('tracesCleared', handleClearResponse);
    wsClient.on('error', handleError);

    // Request to clear traces
    wsClient.clearTraces();

    // Set a timeout to prevent hanging
    setTimeout(() => {
      wsClient.off('tracesCleared', handleClearResponse);
      wsClient.off('error', handleError);
      reject(new Error('Timeout waiting for traces to clear'));
    }, 5000);
  });
}

/**
 * Get trace statistics
 * @returns Promise with the trace statistics
 */
export async function getTraceStats(): Promise<TraceStats> {
  try {
    // Check if WebSocket is connected
    if (!wsClient.isConnected()) {
      // Fall back to HTTP if WebSocket is not connected
      console.log('WebSocket not connected, falling back to HTTP');
      const response = await fetch(`/api/traces/stats`);
      if (!response.ok) {
        throw new Error(`Failed to fetch trace stats: ${response.statusText}`);
      }
      return await response.json();
    }

    // Use WebSocket
    return new Promise((resolve, reject) => {
      // Set up a one-time listener for the stats response
      const handleStatsResponse = (message: any) => {
        wsClient.off('stats', handleStatsResponse);
        resolve(message.data);
      };

      // Set up error handling
      const handleError = (message: any) => {
        if (message.message && message.message.includes('stats')) {
          wsClient.off('error', handleError);
          reject(new Error(message.message));
        }
      };

      // Register listeners
      wsClient.on('stats', handleStatsResponse);
      wsClient.on('error', handleError);

      // Request stats
      wsClient.getStats();

      // Set a timeout to prevent hanging
      setTimeout(() => {
        wsClient.off('stats', handleStatsResponse);
        wsClient.off('error', handleError);
        console.warn('Timeout waiting for stats response, but data might arrive later');
        // Don't reject, just resolve with default data - the real data might arrive later
        // and the component will update when it does
        resolve({
          total: 0,
          successRate: 0,
          avgResponseTime: 0,
          methodCounts: {},
          statusCounts: {},
          truncated: {
            bodies: 0,
            responses: 0
          }
        });
      }, 5000); // 5 second timeout
    });
  } catch (error) {
    console.error('Error fetching trace stats:', error);
    throw error;
  }
}
