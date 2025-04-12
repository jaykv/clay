import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import { initOpenTelemetry, getTraces, getTraceById, clearTraces, getTraceStats, generateTraceId, addTrace } from '../../utils/telemetry';
import { logger } from '../../utils/logger';
import { broadcastNewTrace } from '../../gateway/websocket';

// Extend FastifyRequest to include trace property
declare module 'fastify' {
  interface FastifyRequest {
    trace?: any;
  }
}

// Constants for limiting trace data size
const MAX_BODY_SIZE = 100 * 1024; // 100KB
const MAX_RESPONSE_SIZE = 100 * 1024; // 100KB

/**
 * Fastify plugin for tracing requests and responses
 */
const otelPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  try {
    // Initialize telemetry
    initOpenTelemetry();

    // Add a hook for each request
    fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
      const path = request.url;

      // Skip tracing for all API endpoints to prevent recursion and unnecessary trace data
      if (path.startsWith('/api/') || 
        path.startsWith('/ws/')
        || path.startsWith('/assets/') ||
        path.startsWith('/health') || 
        path.startsWith('/sse') ||
        path == "/"
      ) {
        return;
      }

      const traceId = generateTraceId();
      const startTime = Date.now();

      // Extract request data
      const method = request.method;
      const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
      const query = Object.fromEntries(url.searchParams.entries());

      // Extract headers
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(request.headers)) {
        if (value) headers[key] = Array.isArray(value) ? value.join(', ') : String(value);
      }

      // Try to capture request body if available
      let body: any;
      let bodyTruncated = false;

      if (request.body) {
        try {
          const rawBody = JSON.stringify(request.body);
          if (rawBody.length > MAX_BODY_SIZE) {
            body = rawBody.substring(0, MAX_BODY_SIZE) + '... [truncated]';
            bodyTruncated = true;
          } else {
            body = request.body;
          }
        } catch (error) {
          logger.debug(`Failed to process request body for ${traceId}:`, error);
          body = '[Error processing body]';
        }
      }

      // Create initial trace
      const trace = {
        id: traceId,
        method,
        path,
        query,
        headers,
        body,
        bodyTruncated,
        startTime
      };

      // Store trace in request for later use
      request.trace = trace;
    });

    // Add response hook to capture response data
    fastify.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply, payload: any) => {
      if (!request.trace) return payload;

      try {
        // Capture response data
        const trace = request.trace;
        trace.endTime = Date.now();
        trace.duration = trace.endTime - trace.startTime;
        trace.status = reply.statusCode;

        // Try to capture response body
        let responseTruncated = false;
        let responseBody: any;

        if (payload) {
          try {
            const rawPayload = typeof payload === 'string' ? payload : JSON.stringify(payload);
            if (rawPayload.length > MAX_RESPONSE_SIZE) {
              responseBody = rawPayload.substring(0, MAX_RESPONSE_SIZE) + '... [truncated]';
              responseTruncated = true;
            } else {
              responseBody = typeof payload === 'string' ? payload : JSON.parse(rawPayload);
            }
          } catch (error) {
            logger.debug(`Failed to process response for ${trace.id}:`, error);
            responseBody = '[Error processing response]';
          }
        }

        trace.response = responseBody;
        trace.responseTruncated = responseTruncated;

        // Add the trace to storage
        addTrace(trace);

        // Broadcast the trace to all connected WebSocket clients
        broadcastNewTrace(trace);

        // Log the trace
        logger.info(
          `${request.method} ${request.url} ${trace.status || 'ERR'} ${trace.duration}ms [${trace.id}]`
        );
      } catch (error) {
        logger.error(`Error processing trace:`, error);
      }

      return payload;
    });

    // Add error hook to capture errors
    fastify.addHook('onError', async (request: FastifyRequest, reply: FastifyReply, error: Error) => {
      if (!request.trace) return;

      try {
        const trace = request.trace;
        trace.endTime = Date.now();
        trace.duration = trace.endTime - trace.startTime;
        trace.status = reply.statusCode;
        trace.error = error;

        // Add the trace to storage
        addTrace(trace);

        // Broadcast the trace to all connected WebSocket clients
        broadcastNewTrace(trace);

        // Log the error
        logger.error(
          `${request.method} ${request.url} ${reply.statusCode} ${trace.duration}ms [${trace.id}] Error: ${error.message}`
        );
      } catch (err) {
        logger.error('Failed to process error trace:', err);
      }
    });

    logger.info('Fastify tracing plugin registered successfully');

    // Register API endpoints for the dashboard to access trace data
    registerTracingRoutes(fastify);
  } catch (error) {
    logger.error('Failed to register Fastify tracing plugin:', error);
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
      // Parse pagination parameters
      const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
      const limit = parseInt(url.searchParams.get('limit') || '50', 10);
      const page = parseInt(url.searchParams.get('page') || '1', 10);

      // Get paginated traces
      const tracesData = getTraces(limit, page);

      return tracesData;
    } catch (error) {
      logger.error('Error fetching traces:', error);
      return reply.status(500).send({ error: 'Failed to fetch traces' });
    }
  });

  // Get trace statistics
  fastify.get('/api/traces/stats', async (request, reply) => {
    try {
      const stats = getTraceStats();
      return stats;
    } catch (error) {
      logger.error('Error generating trace stats:', error);
      return reply.status(500).send({ error: 'Failed to generate trace statistics' });
    }
  });

  // Clear all traces
  fastify.post('/api/traces/clear', async (request, reply) => {
    try {
      const result = clearTraces();
      return result;
    } catch (error) {
      logger.error('Error clearing traces:', error);
      return reply.status(500).send({ error: 'Failed to clear traces' });
    }
  });

  // Get a specific trace
  fastify.get<{
    Params: { id: string }
  }>('/api/traces/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const trace = getTraceById(id);

      if (!trace) {
        return reply.status(404).send({ error: 'Trace not found' });
      }

      return trace;
    } catch (error) {
      logger.error(`Error fetching trace ${request.params.id}:`, error);
      return reply.status(500).send({ error: 'Failed to fetch trace' });
    }
  });
}

export default fastifyPlugin(otelPlugin, {
  name: 'fastify-otel-plugin',
  fastify: '5.x'
});
