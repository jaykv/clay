import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import {
  initTracing,
  getTraces,
  getTraceById,
  clearTraces,
  getTraceStats,
  generateTraceId,
  addTrace,
  TraceData,
} from '../../utils/tracing';
import { logger } from '../../utils/logger';
import { broadcastNewTrace } from '../websocket';

// Constants for limiting trace data size
const MAX_BODY_SIZE = 100 * 1024; // 100KB
const MAX_RESPONSE_SIZE = 100 * 1024; // 100KB

// Paths to exclude from tracing
const EXCLUDED_PATHS = [
  /^\/api\//,
  /^\/ws\//,
  /^\/assets\//,
  /^\/health$/,
  /^\/sse$/,
  /^\/$/, // Root path
];

// Extend FastifyRequest to include trace property
declare module 'fastify' {
  interface FastifyRequest {
    trace?: TraceData;
  }
}

/**
 * Checks if a path should be excluded from tracing
 */
function shouldExcludePath(path: string): boolean {
  return EXCLUDED_PATHS.some(pattern => {
    if (pattern instanceof RegExp) {
      return pattern.test(path);
    }
    return path.startsWith(pattern);
  });
}

// We don't need any JSON stringifiers here as we're using standard JSON.stringify

/**
 * Truncate a string if it exceeds the maximum size
 */
function truncateIfNeeded(str: string, maxSize: number): { value: string; truncated: boolean } {
  if (str.length <= maxSize) {
    return { value: str, truncated: false };
  }
  return { value: str.substring(0, maxSize) + '... [truncated]', truncated: true };
}

/**
 * Capture request body without consuming the stream
 */
async function captureRequestBody(
  request: FastifyRequest
): Promise<{ body: any; truncated: boolean }> {
  try {
    // If request has no body, return empty
    if (!request.headers['content-length'] && !request.headers['transfer-encoding']) {
      return { body: undefined, truncated: false };
    }

    // If body is already parsed by Fastify, use it directly
    if (request.body) {
      try {
        // Handle different types of body content
        if (typeof request.body === 'string') {
          // For string bodies, try to parse as JSON if it looks like JSON
          if (request.body.trim().startsWith('{') || request.body.trim().startsWith('[')) {
            try {
              const parsed = JSON.parse(request.body);
              const bodyStr = JSON.stringify(parsed);
              const { value, truncated } = truncateIfNeeded(bodyStr, MAX_BODY_SIZE);
              return { body: JSON.parse(value), truncated };
            } catch {
              // If parsing fails, treat as plain string
              const { value, truncated } = truncateIfNeeded(request.body, MAX_BODY_SIZE);
              return { body: value, truncated };
            }
          } else {
            // Plain string that's not JSON
            const { value, truncated } = truncateIfNeeded(request.body, MAX_BODY_SIZE);
            return { body: value, truncated };
          }
        } else if (Buffer.isBuffer(request.body)) {
          // For Buffer bodies, convert to string and try to parse as JSON
          const bodyStr = request.body.toString('utf-8');
          const { value, truncated } = truncateIfNeeded(bodyStr, MAX_BODY_SIZE);
          try {
            return { body: JSON.parse(value), truncated };
          } catch {
            return { body: value, truncated };
          }
        } else if (typeof request.body === 'object') {
          // For object bodies, stringify and then truncate if needed
          const bodyStr = JSON.stringify(request.body);
          const { value, truncated } = truncateIfNeeded(bodyStr, MAX_BODY_SIZE);
          return { body: JSON.parse(value), truncated };
        } else {
          // For other types, convert to string
          const bodyStr = String(request.body);
          const { value, truncated } = truncateIfNeeded(bodyStr, MAX_BODY_SIZE);
          return { body: value, truncated };
        }
      } catch (e) {
        // If any error occurs during processing, return the body as is
        logger.debug(
          `Error processing request body: ${e instanceof Error ? e.message : String(e)}`
        );
        return {
          body: typeof request.body === 'object' ? request.body : String(request.body),
          truncated: false,
        };
      }
    }

    // For Fastify 5.x with raw body access
    // This is a non-destructive way to peek at the body without consuming it
    const rawReq = request.raw;

    // Check if the raw request has already been consumed
    if (rawReq.complete) {
      // If the request is already complete, we can't capture the body
      // This happens when the body has already been consumed by another handler
      return { body: '[Body already consumed]', truncated: false };
    }

    // We'll capture the body in the onResponse hook to avoid interfering with the request stream

    // For JSON content, let Fastify handle it
    if (request.headers['content-type']?.includes('application/json')) {
      // We'll rely on Fastify's body parsing which happens after this hook
      // and will be available in the onResponse hook
      return { body: '[JSON body will be captured later]', truncated: false };
    } else {
      // For non-JSON content, we'll try to capture it as a string
      // but in a way that doesn't interfere with downstream handlers
      try {
        // Use a more reliable approach that doesn't consume the stream
        // This is a simplified version that works for most cases
        // The actual body will be captured in the onResponse hook
        return { body: '[Body will be captured later]', truncated: false };
      } catch (error) {
        logger.debug(
          `Error peeking at request body: ${error instanceof Error ? error.message : String(error)}`
        );
        return { body: '[Error peeking at body]', truncated: false };
      }
    }
  } catch (error) {
    logger.debug(
      `Failed to capture request body: ${error instanceof Error ? error.message : String(error)}`
    );
    return { body: '[Error capturing body]', truncated: false };
  }
}

/**
 * Create a response interceptor to capture the response body
 */
function createResponseInterceptor(reply: FastifyReply): {
  getResponseBody: () => { body: any; truncated: boolean };
} {
  let responseBody = '';
  let responseTruncated = false;
  let responseContentType = '';
  let responseObject: any = null;

  // Store the original send method
  const originalSend = reply.send;

  // Override the send method to capture the response
  reply.send = function interceptSend(payload: any): FastifyReply {
    try {
      // Capture content type for later parsing
      responseContentType = (reply.getHeader('content-type') as string) || '';

      // Store the original payload object if it's an object
      if (payload !== null && typeof payload === 'object' && !Buffer.isBuffer(payload)) {
        try {
          // Make a deep copy to avoid reference issues
          responseObject = JSON.parse(JSON.stringify(payload));
        } catch (e) {
          // If we can't make a deep copy, at least keep a reference
          responseObject = payload;
        }
      }

      // Convert payload to string if it's not already
      if (payload === null || payload === undefined) {
        responseBody = '';
      } else if (typeof payload === 'string') {
        responseBody = payload;
      } else if (Buffer.isBuffer(payload)) {
        responseBody = payload.toString('utf-8');
      } else if (typeof payload === 'object') {
        // For objects, we want to preserve the actual object structure
        // We'll stringify it later when returning
        try {
          responseBody = JSON.stringify(payload);
        } catch (e) {
          responseBody = '[Complex object that could not be stringified]';
        }
      } else {
        responseBody = String(payload);
      }

      // Truncate if needed
      if (responseBody.length > MAX_RESPONSE_SIZE) {
        responseBody = responseBody.substring(0, MAX_RESPONSE_SIZE) + '... [truncated]';
        responseTruncated = true;
      }
    } catch (error) {
      logger.debug(
        `Failed to capture response body: ${error instanceof Error ? error.message : String(error)}`
      );
      responseBody = '[Error capturing response]';
    }

    // Call the original send method
    return originalSend.call(this, payload);
  };

  return {
    getResponseBody: () => {
      try {
        // If we have the original object, return it
        if (responseObject !== null) {
          return { body: responseObject, truncated: responseTruncated };
        }

        // Try to parse as JSON if content-type is application/json
        if (responseContentType.includes('application/json') && responseBody) {
          try {
            return { body: JSON.parse(responseBody), truncated: responseTruncated };
          } catch (e) {
            // If parsing fails, return as string
            return { body: responseBody, truncated: responseTruncated };
          }
        }

        // For other content types, return as string
        return { body: responseBody, truncated: responseTruncated };
      } catch (e) {
        logger.debug(
          `Error processing response body: ${e instanceof Error ? e.message : String(e)}`
        );
        return { body: responseBody, truncated: responseTruncated };
      }
    },
  };
}

/**
 * Fastify plugin for tracing requests and responses
 */
const tracingPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  try {
    // Initialize tracing
    initTracing();

    // Add a hook for each request
    fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
      const path = request.url;

      // Skip tracing for excluded paths
      if (shouldExcludePath(path)) {
        return;
      }

      const traceId = generateTraceId();
      const startTime = Date.now();

      // Extract request data
      const { method } = request;
      // Use the new hostname and port properties in Fastify 5.x
      const url = new URL(
        request.url,
        `http://${request.hostname || 'localhost'}:${request.port || '3000'}`
      );
      const query = Object.fromEntries(url.searchParams.entries());

      // Extract headers (excluding potentially sensitive ones) using Object.hasOwn
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(request.headers)) {
        if (value && !key.toLowerCase().includes('authorization')) {
          headers[key] = Array.isArray(value) ? value.join(', ') : String(value);
        }
      }

      // Create response interceptor for this request
      const responseInterceptor = createResponseInterceptor(reply);

      // Store the responseInterceptor in the request for later use
      (request as any).responseInterceptor = responseInterceptor;

      // We'll capture the request body immediately

      // Create initial trace
      const trace: TraceData = {
        id: traceId,
        method,
        path,
        query,
        headers,
        startTime,
        // These will be filled in later
        body: undefined,
        bodyTruncated: false,
        endTime: undefined,
        duration: undefined,
        status: undefined,
        response: undefined,
        responseTruncated: false,
      };

      // We'll do a preliminary capture of the request body
      // but the full capture will happen in onResponse
      captureRequestBody(request)
        .then(({ body, truncated }) => {
          // Store preliminary body data
          trace.body = body;
          trace.bodyTruncated = truncated;
        })
        .catch(error => {
          logger.debug(
            `Error capturing request body: ${error instanceof Error ? error.message : String(error)}`
          );
        });

      // Store trace in request for later use
      request.trace = trace;
    });

    // Add a hook to capture the request body after it's been parsed by Fastify
    fastify.addHook('preHandler', async (request: FastifyRequest, _reply: FastifyReply) => {
      if (!request.trace) {
        return;
      }

      // Now that Fastify has parsed the body, we can capture it properly
      if (
        request.body &&
        request.trace.body &&
        (request.trace.body === '[JSON body will be captured later]' ||
          request.trace.body === '[Body will be captured later]')
      ) {
        try {
          // Handle different types of body content
          if (typeof request.body === 'string') {
            // For string bodies, try to parse as JSON if it looks like JSON
            if (request.body.trim().startsWith('{') || request.body.trim().startsWith('[')) {
              try {
                const parsed = JSON.parse(request.body);
                const bodyStr = JSON.stringify(parsed);
                const { value, truncated } = truncateIfNeeded(bodyStr, MAX_BODY_SIZE);
                request.trace.body = JSON.parse(value);
                request.trace.bodyTruncated = truncated;
              } catch {
                // If parsing fails, treat as plain string
                const { value, truncated } = truncateIfNeeded(request.body, MAX_BODY_SIZE);
                request.trace.body = value;
                request.trace.bodyTruncated = truncated;
              }
            } else {
              // Plain string that's not JSON
              const { value, truncated } = truncateIfNeeded(request.body, MAX_BODY_SIZE);
              request.trace.body = value;
              request.trace.bodyTruncated = truncated;
            }
          } else if (Buffer.isBuffer(request.body)) {
            // For Buffer bodies, convert to string and try to parse as JSON
            const bodyStr = request.body.toString('utf-8');
            const { value, truncated } = truncateIfNeeded(bodyStr, MAX_BODY_SIZE);
            try {
              request.trace.body = JSON.parse(value);
            } catch {
              request.trace.body = value;
            }
            request.trace.bodyTruncated = truncated;
          } else if (typeof request.body === 'object') {
            // For object bodies, stringify and then truncate if needed
            const bodyStr = JSON.stringify(request.body);
            const { value, truncated } = truncateIfNeeded(bodyStr, MAX_BODY_SIZE);
            request.trace.body = JSON.parse(value);
            request.trace.bodyTruncated = truncated;
          } else {
            // For other types, convert to string
            const bodyStr = String(request.body);
            const { value, truncated } = truncateIfNeeded(bodyStr, MAX_BODY_SIZE);
            request.trace.body = value;
            request.trace.bodyTruncated = truncated;
          }
        } catch (error) {
          logger.debug(
            `Error capturing parsed body: ${error instanceof Error ? error.message : String(error)}`
          );
          // Fallback to storing the body as is
          try {
            request.trace.body =
              typeof request.body === 'object'
                ? JSON.parse(JSON.stringify(request.body))
                : String(request.body);
          } catch (e) {
            request.trace.body = '[Error processing body]';
          }
        }
      }
    });

    // Capture the response payload in the onSend hook
    fastify.addHook(
      'onSend',
      async (request: FastifyRequest, _reply: FastifyReply, payload: any) => {
        if (!request.trace) {
          return payload;
        }

        try {
          // Process the payload to capture the response
          if (payload !== null && payload !== undefined) {
            if (typeof payload === 'string') {
              // For string payloads, try to parse as JSON if it looks like JSON
              if (payload.trim().startsWith('{') || payload.trim().startsWith('[')) {
                try {
                  const parsed = JSON.parse(payload);
                  const responseStr = JSON.stringify(parsed);
                  const { value, truncated } = truncateIfNeeded(responseStr, MAX_RESPONSE_SIZE);
                  request.trace.response = JSON.parse(value);
                  request.trace.responseTruncated = truncated;
                } catch {
                  // If parsing fails, treat as plain string
                  const { value, truncated } = truncateIfNeeded(payload, MAX_RESPONSE_SIZE);
                  request.trace.response = value;
                  request.trace.responseTruncated = truncated;
                }
              } else {
                // Plain string that's not JSON
                const { value, truncated } = truncateIfNeeded(payload, MAX_RESPONSE_SIZE);
                request.trace.response = value;
                request.trace.responseTruncated = truncated;
              }
            } else if (Buffer.isBuffer(payload)) {
              // For Buffer payloads, convert to string and try to parse as JSON
              const responseStr = payload.toString('utf-8');
              const { value, truncated } = truncateIfNeeded(responseStr, MAX_RESPONSE_SIZE);
              try {
                request.trace.response = JSON.parse(value);
              } catch {
                request.trace.response = value;
              }
              request.trace.responseTruncated = truncated;
            } else if (typeof payload === 'object') {
              // For object payloads, stringify and then truncate if needed
              try {
                const responseStr = JSON.stringify(payload);
                const { value, truncated } = truncateIfNeeded(responseStr, MAX_RESPONSE_SIZE);
                request.trace.response = JSON.parse(value);
                request.trace.responseTruncated = truncated;
              } catch (e) {
                // If we can't stringify, store a placeholder
                request.trace.response = {
                  message: '[Complex object that could not be stringified]',
                };
                request.trace.responseTruncated = false;
              }
            } else {
              // For other types, convert to string
              const responseStr = String(payload);
              const { value, truncated } = truncateIfNeeded(responseStr, MAX_RESPONSE_SIZE);
              request.trace.response = value;
              request.trace.responseTruncated = truncated;
            }
          } else {
            // No payload
            request.trace.response = null;
            request.trace.responseTruncated = false;
          }
        } catch (error) {
          logger.debug(
            `Error capturing response payload: ${error instanceof Error ? error.message : String(error)}`
          );
          request.trace.response = '[Error capturing response]';
          request.trace.responseTruncated = false;
        }

        // Return the payload unchanged
        return payload;
      }
    );

    // Add a hook to finalize the trace after the response is sent
    fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.trace) {
        return;
      }

      try {
        // Capture end time and duration
        request.trace.endTime = Date.now();
        request.trace.duration = request.trace.endTime - request.trace.startTime;
        request.trace.status = reply.statusCode;

        // Capture request body (if not already captured)
        if (request.trace.body === undefined) {
          const { body, truncated } = await captureRequestBody(request);
          request.trace.body = body;
          request.trace.bodyTruncated = truncated;
        }

        // If we don't have a response body yet, try to use the stored interceptor
        if (!request.trace.response && (request as any).responseInterceptor) {
          try {
            const { body, truncated } = (request as any).responseInterceptor.getResponseBody();
            request.trace.response = body;
            request.trace.responseTruncated = truncated;
          } catch (e) {
            logger.debug(
              `Error using response interceptor: ${e instanceof Error ? e.message : String(e)}`
            );
          }
        }

        // Add the trace to storage
        addTrace(request.trace);

        // Broadcast the trace to all connected WebSocket clients
        broadcastNewTrace(request.trace);

        // Log the trace
        logger.info(
          `${request.method} ${request.url} ${request.trace.status || 'ERR'} ${request.trace.duration}ms [${request.trace.id}]`
        );
      } catch (error) {
        logger.error(
          `Error processing trace: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });

    logger.info('Fastify tracing plugin registered successfully');

    // Register API endpoints for the dashboard to access trace data
    registerTracingRoutes(fastify);
  } catch (error) {
    logger.error(
      `Failed to register Fastify tracing plugin: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
};

/**
 * Register tracing routes for the dashboard
 */
function registerTracingRoutes(fastify: FastifyInstance) {
  // Get traces with pagination
  fastify.get('/api/traces', async (request, reply) => {
    try {
      // Parse pagination parameters using the new hostname and port properties
      const url = new URL(
        request.url,
        `http://${request.hostname || 'localhost'}:${request.port || '3000'}`
      );
      const limit = parseInt(url.searchParams.get('limit') || '50', 10);
      const page = parseInt(url.searchParams.get('page') || '1', 10);

      // Get paginated traces
      return getTraces(limit, page);
    } catch (error) {
      logger.error(
        `Error fetching traces: ${error instanceof Error ? error.message : String(error)}`
      );
      return reply.status(500).send({ error: 'Failed to fetch traces' });
    }
  });

  // Get trace statistics
  fastify.get('/api/traces/stats', async (_request, reply) => {
    try {
      return getTraceStats();
    } catch (error) {
      logger.error(
        `Error generating trace stats: ${error instanceof Error ? error.message : String(error)}`
      );
      return reply.status(500).send({ error: 'Failed to generate trace statistics' });
    }
  });

  // Clear all traces
  fastify.post('/api/traces/clear', async (_request, reply) => {
    try {
      return clearTraces();
    } catch (error) {
      logger.error(
        `Error clearing traces: ${error instanceof Error ? error.message : String(error)}`
      );
      return reply.status(500).send({ error: 'Failed to clear traces' });
    }
  });

  // Get a specific trace
  fastify.get<{
    Params: { id: string };
  }>('/api/traces/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const trace = getTraceById(id);

      if (!trace) {
        return reply.status(404).send({ error: 'Trace not found' });
      }

      return trace;
    } catch (error) {
      logger.error(
        `Error fetching trace ${request.params.id}: ${error instanceof Error ? error.message : String(error)}`
      );
      return reply.status(500).send({ error: 'Failed to fetch trace' });
    }
  });
}

export default fastifyPlugin(tracingPlugin, {
  name: 'fastify-tracing-plugin',
  fastify: '5.x',
});
