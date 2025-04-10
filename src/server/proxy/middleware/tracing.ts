import { Context, MiddlewareHandler, Next } from 'hono';
import { logger } from '../../utils/logger';

// Constants for limiting trace data size
const MAX_BODY_SIZE = 100 * 1024; // 100KB
const MAX_RESPONSE_SIZE = 100 * 1024; // 100KB

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

// In-memory storage for trace data
// In a production app, this would be replaced with a proper database
const traces: TraceData[] = [];
const MAX_TRACES = 1000;

// Generate a unique ID for each request
function generateTraceId(): string {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}

// Add a new trace
export function addTrace(trace: TraceData): void {
  traces.unshift(trace);

  // Keep only the most recent traces
  if (traces.length > MAX_TRACES) {
    traces.pop();
  }
}

// Get all traces
export function getTraces(): TraceData[] {
  return traces;
}

// Get a specific trace by ID
export function getTraceById(id: string): TraceData | undefined {
  return traces.find(trace => trace.id === id);
}

// Clear all traces
export function clearTraces(): void {
  traces.length = 0;
}

// Middleware for tracing requests and responses
export const tracingMiddleware: MiddlewareHandler = async (c: Context, next: Next) => {
  const path = c.req.path;

  // Skip tracing for trace API endpoints to prevent recursion
  if (path.startsWith('/api/traces')) {
    return await next();
  }

  const traceId = generateTraceId();
  const startTime = Date.now();

  // Extract request data
  const method = c.req.method;
  const query = Object.fromEntries(new URL(c.req.url).searchParams.entries());

  // Extract headers
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(c.req.header())) {
    if (value) headers[key] = value;
  }

  // Create initial trace
  const trace: TraceData = {
    id: traceId,
    method,
    path,
    query,
    headers,
    startTime
  };

  // Try to parse body if it's a POST/PUT request
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    try {
      const contentType = headers['content-type'] || '';
      if (contentType.includes('application/json')) {
        // Try to parse the body as JSON
        const bodyText = await c.req.text();

        // Check if body is too large
        if (bodyText.length > MAX_BODY_SIZE) {
          trace.body = bodyText.substring(0, MAX_BODY_SIZE) + '... [truncated]';
          trace.bodyTruncated = true;
          logger.debug(`Request body truncated for ${traceId}, original size: ${bodyText.length} bytes`);
        } else {
          try {
            trace.body = JSON.parse(bodyText);
          } catch (e) {
            trace.body = bodyText;
          }
        }
      }
    } catch (error) {
      logger.debug('Failed to parse request body', error);
    }
  }

  // Add trace ID to response headers
  c.header('X-Trace-ID', traceId);

  try {
    // Process the request
    await next();

    // Update trace with response data
    trace.endTime = Date.now();
    trace.duration = trace.endTime - startTime;
    trace.status = c.res.status;

    // Try to capture response body, but skip for streaming responses
    try {
      // Check if this is a streaming response
      const contentType = c.res.headers.get('content-type') || '';
      const acceptHeader = c.req.header('accept') || '';

      // Detect streaming responses based on various indicators
      const isStreamingContentType = contentType.includes('text/event-stream');
      const isSSERequest = acceptHeader.includes('text/event-stream');

      const isStreaming = isStreamingContentType || isSSERequest;

      // Log streaming detection details for debugging
      if (isStreaming) {
        logger.debug(`Streaming response detected for ${traceId} (ContentType: ${isStreamingContentType}, SSE: ${isSSERequest})`);
      }

      if (isStreaming) {
        // For streaming responses, don't try to read the body
        trace.response = '[Streaming response - body not captured]';
        logger.debug(`Streaming response detected for ${traceId}, skipping body capture`);
      } else {
        // For non-streaming responses, try to clone and read the body
        try {
          const resClone = c.res.clone();
          const contentType = resClone.headers.get('content-type') || '';

          if (contentType.includes('application/json')) {
            try {
              // Get response as text first to check size
              const responseText = await resClone.text();

              // Check if response is too large
              if (responseText.length > MAX_RESPONSE_SIZE) {
                trace.response = responseText.substring(0, MAX_RESPONSE_SIZE) + '... [truncated]';
                trace.responseTruncated = true;
                logger.debug(`Response body truncated for ${traceId}, original size: ${responseText.length} bytes`);
              } else {
                // Parse as JSON if not too large
                try {
                  trace.response = JSON.parse(responseText);
                } catch (e) {
                  trace.response = responseText;
                }
              }
            } catch (e) {
              logger.debug('Failed to process JSON response', e);
            }
          } else if (contentType.includes('text/')) {
            const responseText = await resClone.text();
            if (responseText.length > MAX_RESPONSE_SIZE) {
              trace.response = responseText.substring(0, MAX_RESPONSE_SIZE) + '... [truncated]';
              trace.responseTruncated = true;
              logger.debug(`Response body truncated for ${traceId}, original size: ${responseText.length} bytes`);
            } else {
              trace.response = responseText;
            }
          }
        } catch (error) {
          logger.debug('Failed to capture response body', error);
        }
      }
    } catch (error) {
      logger.debug('Failed to capture response body', error);
    }
  } catch (error) {
    // Handle errors
    trace.endTime = Date.now();
    trace.duration = trace.endTime - startTime;
    trace.error = error as Error;

    // Re-throw the error to be handled by error middleware
    throw error;
  } finally {
    // Add the trace to storage
    addTrace(trace);

    // Log the trace
    logger.info(
      `${method} ${path} ${trace.status || 'ERR'} ${trace.duration}ms [${traceId}]`
    );
  }
};

// API endpoints for the dashboard to access trace data
export function registerTracingRoutes(app: any) {
  // Get traces with pagination
  app.get('/api/traces', (c: Context) => {
    try {
      // Parse pagination parameters
      const url = new URL(c.req.url);
      const limit = parseInt(url.searchParams.get('limit') || '50', 10);
      const page = parseInt(url.searchParams.get('page') || '1', 10);

      // Validate and cap the limit
      const validLimit = Math.min(Math.max(1, limit), 100);
      const validPage = Math.max(1, page);

      // Calculate start and end indices
      const startIndex = (validPage - 1) * validLimit;
      const endIndex = startIndex + validLimit;

      // Get paginated traces
      const allTraces = getTraces();
      const paginatedTraces = allTraces.slice(startIndex, endIndex);

      // Return with pagination metadata
      return c.json({
        traces: paginatedTraces,
        pagination: {
          total: allTraces.length,
          page: validPage,
          limit: validLimit,
          pages: Math.ceil(allTraces.length / validLimit)
        }
      });
    } catch (error) {
      logger.error('Error retrieving traces:', error);
      return c.json({ error: 'Failed to retrieve traces' }, 500);
    }
  });

  // Get trace statistics
  app.get('/api/traces/stats', (c: Context) => {
    try {
      const total = traces.length;

      // Calculate success rate
      const successful = traces.filter(t => t.status && t.status < 400).length;
      const successRate = total > 0 ? (successful / total) * 100 : 0;

      // Calculate average response time
      const totalDuration = traces.reduce((sum, t) => sum + (t.duration || 0), 0);
      const avgResponseTime = total > 0 ? totalDuration / total : 0;

      // Count requests by method
      const methodCounts: Record<string, number> = {};
      traces.forEach(t => {
        methodCounts[t.method] = (methodCounts[t.method] || 0) + 1;
      });

      // Count requests by status code
      const statusCounts: Record<string, number> = {};
      traces.forEach(t => {
        if (t.status) {
          const statusGroup = Math.floor(t.status / 100) * 100;
          statusCounts[statusGroup] = (statusCounts[statusGroup] || 0) + 1;
        }
      });

      // Count truncated bodies and responses
      const truncatedBodies = traces.filter(t => t.bodyTruncated).length;
      const truncatedResponses = traces.filter(t => t.responseTruncated).length;

      return c.json({
        total,
        successRate,
        avgResponseTime,
        methodCounts,
        statusCounts,
        truncated: {
          bodies: truncatedBodies,
          responses: truncatedResponses
        }
      });
    } catch (error) {
      logger.error('Error generating trace stats:', error);
      return c.json({ error: 'Failed to generate trace statistics' }, 500);
    }
  });

  // Clear all traces
  app.post('/api/traces/clear', (c: Context) => {
    clearTraces();
    return c.json({ success: true });
  });

  // Get a specific trace - this must be last to avoid conflicts with other /api/traces/* routes
  app.get('/api/traces/:id', (c: Context) => {
    const id = c.req.param('id');
    const trace = getTraceById(id);

    if (!trace) {
      return c.json({ error: 'Trace not found' }, 404);
    }

    return c.json(trace);
  });
}
