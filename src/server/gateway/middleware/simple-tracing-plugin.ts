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
 * Process request body for tracing - simplified to just capture as string
 */
function processRequestBody(body: any): { body: string | undefined; truncated: boolean } {
  try {
    if (body === undefined || body === null) {
      return { body: undefined, truncated: false };
    }

    // Truncate if needed
    return { body: body, truncated: false };
  } catch (error) {
    logger.debug(
      `Error processing body: ${error instanceof Error ? error.message : String(error)}`
    );
    return { body: '[Error processing body]', truncated: false };
  }
}

/**
 * Process response payload for tracing - simplified to just capture as string
 */
function processResponsePayload(payload: any): { body: string | null; truncated: boolean } {
  try {
    if (payload === undefined || payload === null) {
      return { body: null, truncated: false };
    }

    // Handle Node.js streams (like those from http-proxy)
    if (payload && typeof payload === 'object' && payload._readableState) {
      // This is a stream, we can't capture it directly in onSend
      // We'll mark it for capture in onResponse
      return { body: '[Stream - will capture in onResponse]', truncated: false };
    }
    // Truncate if needed
    // const { value, truncated } = truncateIfNeeded(payload, MAX_RESPONSE_SIZE);
    return { body: payload, truncated: false };
  } catch (error) {
    logger.debug(
      `Error processing response: ${error instanceof Error ? error.message : String(error)}`
    );
    return { body: '[Error processing response]', truncated: false };
  }
}

/**
 * Simple tracing plugin for Fastify
 */
const simpleTracingPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  try {
    // Initialize tracing
    initTracing();

    // Add a hook for each request
    fastify.addHook('onRequest', async (request: FastifyRequest, _reply: FastifyReply) => {
      const path = request.url;

      // Skip tracing for excluded paths
      if (shouldExcludePath(path)) {
        return;
      }

      const traceId = generateTraceId();
      const startTime = Date.now();

      // Extract request data
      const { method } = request;
      const url = new URL(
        request.url,
        `http://${request.hostname || 'localhost'}:${request.port || '3000'}`
      );
      const query = Object.fromEntries(url.searchParams.entries());

      // Extract headers (excluding potentially sensitive ones)
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(request.headers)) {
        if (value && !key.toLowerCase().includes('authorization')) {
          headers[key] = Array.isArray(value) ? value.join(', ') : String(value);
        }
      }

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

      // Store trace in request for later use
      request.trace = trace;
    });

    // Capture the request body after it's been parsed
    fastify.addHook('preHandler', async (request: FastifyRequest, _reply: FastifyReply) => {
      if (!request.trace) {
        return;
      }

      // Now that Fastify has parsed the body, we can capture it
      if (request.body) {
        const { body, truncated } = processRequestBody(request.body);
        request.trace.body = body;
        request.trace.bodyTruncated = truncated;
      }
    });

    // Capture the response payload before it's sent
    fastify.addHook(
      'onSend',
      async (request: FastifyRequest, _reply: FastifyReply, payload: any) => {
        if (!request.trace) {
          return payload;
        }

        // Process the payload to capture the response
        const { body, truncated } = processResponsePayload(payload);
        request.trace.response = body;
        request.trace.responseTruncated = truncated;

        // Return the payload unchanged
        return payload;
      }
    );

    // Finalize the trace after the response is sent
    fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.trace) {
        return;
      }

      try {
        // Capture end time and duration
        request.trace.endTime = Date.now();
        request.trace.duration = request.trace.endTime - request.trace.startTime;
        request.trace.status = reply.statusCode;

        // If the response was a stream, try to extract the response from headers
        if (
          request.trace.response === '[Stream - will capture in onResponse]' ||
          (request.trace.response &&
            typeof request.trace.response === 'object' &&
            (request.trace.response as any)._readableState)
        ) {
          // Just include headers information for streams
          const headers = reply.getHeaders();
          const contentType = (reply.getHeader('content-type') as string) || '';

          request.trace.response = `[Stream response with content-type: ${contentType}]`;
          // Include headers in the response string
          request.trace.response += `\nHeaders: ${JSON.stringify(headers)}`;
          // Don't store headers separately as it's not in the TraceData type
          request.trace.responseTruncated = false;
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

    // Handle errors
    fastify.addHook(
      'onError',
      async (request: FastifyRequest, _reply: FastifyReply, error: Error) => {
        if (!request.trace) {
          return;
        }

        // Update trace with error information
        request.trace.error = error;
      }
    );

    logger.info('Simple tracing plugin registered successfully');

    // Register API endpoints for the dashboard to access trace data
    registerTracingRoutes(fastify);
  } catch (error) {
    logger.error(
      `Failed to register simple tracing plugin: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
};

/**
 * Register tracing routes for the dashboard
 */
function registerTracingRoutes(fastify: FastifyInstance) {
  // Get all traces
  fastify.get('/api/traces', async (request, _reply) => {
    const { page = 1, limit = 50 } = request.query as { page?: number; limit?: number };
    return getTraces(page, limit);
  });

  // Get a specific trace by ID
  fastify.get('/api/traces/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const trace = getTraceById(id);
    if (!trace) {
      reply.code(404);
      return { error: 'Trace not found' };
    }
    return trace;
  });

  // Get trace statistics
  fastify.get('/api/traces/stats', async (_request, _reply) => {
    return getTraceStats();
  });

  // Clear all traces
  fastify.delete('/api/traces', async (_request, _reply) => {
    clearTraces();
    return { success: true };
  });
}

export default fastifyPlugin(simpleTracingPlugin, {
  name: 'simple-tracing-plugin',
  fastify: '>=4.0.0',
});
