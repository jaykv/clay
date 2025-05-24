import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import { Readable, Transform } from 'stream';
import {
  initTracing,
  getTraces,
  getTraceById,
  clearTraces,
  getTraceStats,
  generateTraceId,
  addTrace,
  TraceData,
  extractLLMMetrics,
} from '../../utils/tracing';
import { logger } from '../../utils/logger';
import { broadcastNewTrace } from '../websocket';
import { tracingConfig } from '../../utils/tracing-config';

// Extend FastifyRequest to include trace property
declare module 'fastify' {
  interface FastifyRequest {
    trace?: TraceData;
  }
}

/**
 * Check if a path should be excluded from tracing
 */
function shouldExcludePath(path: string): boolean {
  return tracingConfig.shouldExcludePath(path);
}

/**
 * Check if a request looks like an LLM API call
 */
function isLLMRequest(path: string, body: any): boolean {
  // Check common LLM API endpoints
  const llmPaths = [
    '/v1/chat/completions',
    '/v1/completions',
    '/chat/completions',
    '/completions',
    '/v1/messages',
    '/messages',
    // Gemini API endpoints
    '/v1beta/models/',
    '/v1/models/',
    'generateContent',
    'streamGenerateContent',
    // Claude API endpoints
    '/v1/messages',
    // Other common patterns
    '/proxy/gemini',
    '/proxy/openai',
    '/proxy/anthropic',
    '/proxy/ai',
  ];

  if (llmPaths.some(p => path.includes(p))) {
    return true;
  }

  // Check if body contains LLM-specific fields
  if (body && typeof body === 'object') {
    const llmFields = [
      'model', 'messages', 'prompt', 'temperature', 'max_tokens', 'maxTokens',
      // Gemini-specific fields
      'contents', 'generationConfig', 'safetySettings',
      // Claude-specific fields
      'system', 'max_tokens_to_sample',
    ];
    return llmFields.some(field => field in body);
  }

  return false;
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
 * Process request body for tracing
 * Handles different types of body content efficiently
 */
function processRequestBody(body: any, request: FastifyRequest): { body: any; truncated: boolean } {
  try {
    if (!body) {
      return { body: undefined, truncated: false };
    }

    // Check if detailed body capture is enabled
    if (!tracingConfig.isDetailedBodyCaptureEnabled()) {
      return { body: '[Body capture disabled - enable in traces dashboard]', truncated: false };
    }

    const maxBodySize = tracingConfig.getMaxBodySize();

    // Handle different types of body content
    if (typeof body === 'string') {
      // For string bodies, try to parse as JSON if it looks like JSON
      if (body.trim().startsWith('{') || body.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(body);
          const bodyStr = JSON.stringify(parsed);
          const { value, truncated } = truncateIfNeeded(bodyStr, maxBodySize);
          return { body: JSON.parse(value), truncated };
        } catch {
          // If parsing fails, treat as plain string
          const { value, truncated } = truncateIfNeeded(body, maxBodySize);
          return { body: value, truncated };
        }
      } else {
        // Plain string that's not JSON
        const { value, truncated } = truncateIfNeeded(body, maxBodySize);
        return { body: value, truncated };
      }
    } else if (Buffer.isBuffer(body)) {
      // For Buffer bodies, convert to string and try to parse as JSON
      const bodyStr = body.toString('utf-8');
      const { value, truncated } = truncateIfNeeded(bodyStr, maxBodySize);
      try {
        return { body: JSON.parse(value), truncated };
      } catch {
        return { body: value, truncated };
      }
    } else if (typeof body === 'object') {
      // For object bodies, stringify and then truncate if needed
      const bodyStr = JSON.stringify(body);
      const { value, truncated } = truncateIfNeeded(bodyStr, maxBodySize);
      return { body: JSON.parse(value), truncated };
    } else {
      // For other types, convert to string
      const bodyStr = String(body);
      const { value, truncated } = truncateIfNeeded(bodyStr, maxBodySize);
      return { body: value, truncated };
    }
  } catch (error) {
    logger.debug(
      `Error processing request body: ${error instanceof Error ? error.message : String(error)}`
    );
    return {
      body: typeof body === 'object' ? body : String(body),
      truncated: false,
    };
  }
}

/**
 * Create a stream cloner that captures the data passing through it
 * @param maxSize Maximum size to capture (in bytes)
 * @returns An object with the cloned stream and a promise that resolves to the captured data
 */
function createStreamCloner(maxSize?: number) {
  const streamSize = maxSize || tracingConfig.getMaxStreamSize();
  let capturedData: Buffer[] = [];
  let capturedSize = 0;
  let truncated = false;

  // Create a transform stream that captures data as it passes through
  const transform = new Transform({
    transform(chunk, encoding, callback) {
      // Only capture if we haven't exceeded the max size
      if (!truncated && capturedSize < streamSize) {
        const buffer = Buffer.isBuffer(chunk)
          ? chunk
          : Buffer.from(chunk, encoding as BufferEncoding);

        // Check if adding this chunk would exceed the max size
        if (capturedSize + buffer.length <= streamSize) {
          capturedData.push(buffer);
          capturedSize += buffer.length;
        } else {
          // Capture as much as we can up to the max size
          const remainingSpace = streamSize - capturedSize;
          if (remainingSpace > 0) {
            capturedData.push(buffer.slice(0, remainingSpace));
            capturedSize += remainingSpace;
          }
          truncated = true;
        }
      }

      // Always pass the chunk through unchanged
      this.push(chunk);
      callback();
    },
  });

  // Create a promise that resolves to the captured data
  const dataPromise = new Promise<{ data: Buffer; truncated: boolean }>(resolve => {
    transform.on('end', () => {
      resolve({
        data: Buffer.concat(capturedData),
        truncated,
      });
    });
  });

  return { stream: transform, dataPromise };
}

/**
 * Process captured stream data for tracing
 * @param data The buffer containing the stream data
 * @param contentType The content type of the stream
 */
async function processStreamData(
  data: Buffer,
  contentType: string
): Promise<{ body: any; truncated: boolean }> {
  try {
    // Convert buffer to string
    const bodyStr = data.toString('utf-8');
    const { value, truncated } = truncateIfNeeded(bodyStr, tracingConfig.getMaxResponseSize());

    // Try to parse as JSON if it's a JSON content type or looks like JSON
    if (
      contentType.includes('application/json') ||
      value.trim().startsWith('{') ||
      value.trim().startsWith('[')
    ) {
      try {
        return { body: JSON.parse(value), truncated };
      } catch {
        return { body: value, truncated };
      }
    }

    return { body: value, truncated };
  } catch (error) {
    logger.debug(
      `Error processing stream data: ${error instanceof Error ? error.message : String(error)}`
    );
    return { body: '[Error processing stream data]', truncated: false };
  }
}

/**
 * Process response payload for tracing
 * Handles different types of response content efficiently
 */
function processResponsePayload(payload: any, reply: FastifyReply, request?: FastifyRequest): {
  body: any;
  truncated: boolean;
  streamCloner?: { stream: Transform; dataPromise: Promise<{ data: Buffer; truncated: boolean }> };
} {
  try {
    if (payload === undefined || payload === null) {
      return { body: null, truncated: false };
    }

    // Handle Node.js streams (like those from http-proxy)
    if (payload && typeof payload === 'object' && (payload as any)._readableState) {
      // Check if detailed SSE capture is enabled
      const responseInfo = {
        headers: reply.getHeaders(),
        url: request?.url || ''
      };
      if (!tracingConfig.shouldCaptureDetailedSSE(responseInfo)) {
        return {
          body: '[Stream capture disabled - enable in traces dashboard]',
          truncated: false,
        };
      }

      // This is a stream, create a cloner to capture the data
      const streamCloner = createStreamCloner();
      return {
        body: '[Stream - capturing content]',
        truncated: false,
        streamCloner,
      };
    }

    // Handle Buffer objects
    if (Buffer.isBuffer(payload)) {
      const bodyStr = payload.toString('utf-8');
      const { value, truncated } = truncateIfNeeded(bodyStr, tracingConfig.getMaxResponseSize());

      // Try to parse as JSON if it looks like JSON
      if (value.trim().startsWith('{') || value.trim().startsWith('[')) {
        try {
          return { body: JSON.parse(value), truncated };
        } catch {
          return { body: value, truncated };
        }
      }

      return { body: value, truncated };
    }

    // Handle string payloads
    if (typeof payload === 'string') {
      const { value, truncated } = truncateIfNeeded(payload, tracingConfig.getMaxResponseSize());

      // Try to parse as JSON if it looks like JSON
      if (value.trim().startsWith('{') || value.trim().startsWith('[')) {
        try {
          return { body: JSON.parse(value), truncated };
        } catch {
          return { body: value, truncated };
        }
      }

      return { body: value, truncated };
    }

    // Handle object payloads
    if (typeof payload === 'object') {
      const bodyStr = JSON.stringify(payload);
      const { value, truncated } = truncateIfNeeded(bodyStr, tracingConfig.getMaxResponseSize());
      return { body: JSON.parse(value), truncated };
    }

    // Default case: convert to string
    const bodyStr = String(payload);
    const { value, truncated } = truncateIfNeeded(bodyStr, tracingConfig.getMaxResponseSize());
    return { body: value, truncated };
  } catch (error) {
    logger.debug(
      `Error processing response payload: ${error instanceof Error ? error.message : String(error)}`
    );
    return { body: '[Error processing response]', truncated: false };
  }
}

/**
 * Enhanced tracing plugin for Fastify
 * Efficiently captures request and response data without re-reading streams
 */
const enhancedTracingPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  try {
    // Initialize tracing
    initTracing();

    // Register API endpoints for the dashboard to access trace data
    registerTracingRoutes(fastify);

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

      // Extract query parameters
      const query: Record<string, string> = {};
      for (const [key, value] of url.searchParams.entries()) {
        query[key] = value;
      }

      // Extract headers (make a copy to avoid reference issues)
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(request.headers)) {
        headers[key] = Array.isArray(value) ? value.join(', ') : String(value || '');
      }

      // Create trace object
      const trace: TraceData = {
        id: traceId,
        method,
        path: url.pathname,
        query,
        headers,
        startTime,
      };

      // Store trace in request for later use
      request.trace = trace;
    });

    // Capture the raw request body before it's consumed by the proxy
    fastify.addHook('preParsing', async (request: FastifyRequest, _reply: FastifyReply, payload: any) => {
      if (!request.trace) {
        return payload;
      }

      // Only capture body for detailed tracing
      if (!tracingConfig.isDetailedBodyCaptureEnabled()) {
        return payload;
      }

      try {
        // For proxy requests, we need to capture the raw body before it's consumed
        if (payload && typeof payload.pipe === 'function') {
          // It's a stream, we need to read it
          const chunks: Buffer[] = [];
          let totalSize = 0;
          const maxSize = tracingConfig.getMaxBodySize();

          // Create a new readable stream that we'll return
          const { Readable } = await import('stream');
          const clonedStream = new Readable({ read() {} });

          payload.on('data', (chunk: Buffer) => {
            // Store the chunk for our tracing
            if (totalSize < maxSize) {
              chunks.push(chunk);
              totalSize += chunk.length;
            }

            // Pass the chunk to the cloned stream
            clonedStream.push(chunk);
          });

          payload.on('end', () => {
            // Parse the captured body
            try {
              const bodyBuffer = Buffer.concat(chunks);
              const bodyStr = bodyBuffer.toString('utf-8');

              // Try to parse as JSON
              let parsedBody;
              try {
                parsedBody = JSON.parse(bodyStr);
              } catch {
                parsedBody = bodyStr;
              }

              // Store in trace (with null check)
              if (request.trace) {
                request.trace.body = parsedBody;
                request.trace.bodyTruncated = totalSize >= maxSize;
              }

              logger.debug(`Captured body from stream: ${bodyStr.substring(0, 100)}...`);
            } catch (error) {
              logger.debug(`Error parsing captured body: ${error}`);
              if (request.trace) {
                request.trace.body = '[Error parsing body]';
              }
            }

            clonedStream.push(null); // End the cloned stream
          });

          payload.on('error', (error: Error) => {
            clonedStream.destroy(error);
          });

          return clonedStream;
        }
      } catch (error) {
        logger.debug(`Error in preParsing hook: ${error}`);
      }

      return payload;
    });

    // Capture the response payload before it's sent
    fastify.addHook(
      'onSend',
      async (request: FastifyRequest, reply: FastifyReply, payload: any) => {
        if (!request.trace) {
          return payload;
        }

        // Capture response headers
        const responseHeaders: Record<string, string> = {};
        const headerNames = reply.getHeaders();
        for (const [name, value] of Object.entries(headerNames)) {
          responseHeaders[name] = Array.isArray(value) ? value.join(', ') : String(value || '');
        }
        request.trace.responseHeaders = responseHeaders;

        // Process the payload to capture the response
        const { body, truncated, streamCloner } = processResponsePayload(payload, reply, request);
        request.trace.response = body;
        request.trace.responseTruncated = truncated;

        // Store the stream cloner in the request for later use
        if (streamCloner) {
          (request as any)._streamCloner = streamCloner;
          // Pipe the original stream through our cloner
          return payload.pipe(streamCloner.stream);
        }

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

        // Check if we have a stream cloner
        const streamCloner = (request as any)._streamCloner;
        if (streamCloner) {
          try {
            // Wait for the stream to be fully processed
            const { data, truncated } = await streamCloner.dataPromise;

            // Get the content type from headers
            const contentType = (reply.getHeader('content-type') as string) || '';

            // Process the captured stream data
            const { body, truncated: bodyTruncated } = await processStreamData(data, contentType);

            // Update the trace with the captured stream data
            request.trace.response = body;
            request.trace.responseTruncated = truncated || bodyTruncated;
          } catch (streamError) {
            logger.debug(
              `Error capturing stream: ${streamError instanceof Error ? streamError.message : String(streamError)}`
            );

            // If we failed to capture the stream, include information about it
            const contentType = (reply.getHeader('content-type') as string) || '';
            const contentLength = (reply.getHeader('content-length') as string) || 'unknown';

            request.trace.response = {
              type: 'stream',
              contentType,
              contentLength,
              note: 'Error capturing stream content',
              error: streamError instanceof Error ? streamError.message : String(streamError),
            };
            request.trace.responseTruncated = true;
          }
        } else if (
          request.trace.response === '[Stream - capturing content]' ||
          (request.trace.response &&
            typeof request.trace.response === 'object' &&
            (request.trace.response as any)._readableState)
        ) {
          // For streams that weren't captured, include information about them
          const contentType = (reply.getHeader('content-type') as string) || '';
          const contentLength = (reply.getHeader('content-length') as string) || 'unknown';

          request.trace.response = {
            type: 'stream',
            contentType,
            contentLength,
            note: 'Stream content not captured',
          };
          request.trace.responseTruncated = true;
        }

        // Extract LLM metrics if this looks like an LLM API call
        if (isLLMRequest(request.trace.path, request.trace.body)) {
          request.trace.llmMetrics = extractLLMMetrics(request.trace.body, request.trace.response);
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

    logger.info('Enhanced tracing plugin registered successfully');
  } catch (error) {
    logger.error(
      `Failed to register enhanced tracing plugin: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
};

/**
 * Register API endpoints for the dashboard to access trace data
 */
function registerTracingRoutes(fastify: FastifyInstance) {
  // Get all traces with pagination
  fastify.get<{
    Querystring: {
      limit?: string;
      page?: string;
    };
  }>('/api/traces', async (request, reply) => {
    try {
      const limit = parseInt(request.query.limit || '50');
      const page = parseInt(request.query.page || '1');

      const traces = getTraces(limit, page);
      return traces;
    } catch (error) {
      logger.error('Error fetching traces:', error);
      return reply.status(500).send({ error: 'Failed to fetch traces' });
    }
  });

  // Get a specific trace by ID
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
      logger.error(`Error fetching trace ${request.params.id}:`, error);
      return reply.status(500).send({ error: 'Failed to fetch trace' });
    }
  });

  // Get trace statistics
  fastify.get('/api/traces/stats', async (_request, reply) => {
    try {
      const stats = getTraceStats();
      return stats;
    } catch (error) {
      logger.error('Error fetching trace stats:', error);
      return reply.status(500).send({ error: 'Failed to fetch trace stats' });
    }
  });

  // Clear all traces
  fastify.delete('/api/traces', async (_request, reply) => {
    try {
      clearTraces();
      return { success: true };
    } catch (error) {
      logger.error('Error clearing traces:', error);
      return reply.status(500).send({ error: 'Failed to clear traces' });
    }
  });

  // Get tracing configuration
  fastify.get('/api/traces/config', async (_request, reply) => {
    try {
      return tracingConfig.getConfig();
    } catch (error) {
      logger.error('Error fetching tracing config:', error);
      return reply.status(500).send({ error: 'Failed to fetch tracing config' });
    }
  });

  // Update tracing configuration
  fastify.patch('/api/traces/config', async (request, reply) => {
    try {
      const updates = request.body as any;
      tracingConfig.updateConfig(updates);
      return { success: true, config: tracingConfig.getConfig() };
    } catch (error) {
      logger.error('Error updating tracing config:', error);
      return reply.status(500).send({ error: 'Failed to update tracing config' });
    }
  });

  // Toggle detailed body capture
  fastify.post('/api/traces/config/toggle-body-capture', async (_request, reply) => {
    try {
      const enabled = tracingConfig.toggleDetailedBodyCapture();
      return { success: true, detailedBodyCapture: enabled };
    } catch (error) {
      logger.error('Error toggling body capture:', error);
      return reply.status(500).send({ error: 'Failed to toggle body capture' });
    }
  });

  // Toggle detailed SSE capture
  fastify.post('/api/traces/config/toggle-sse-capture', async (_request, reply) => {
    try {
      const enabled = tracingConfig.toggleDetailedSSECapture();
      return { success: true, detailedSSECapture: enabled };
    } catch (error) {
      logger.error('Error toggling SSE capture:', error);
      return reply.status(500).send({ error: 'Failed to toggle SSE capture' });
    }
  });
}

export default fastifyPlugin(enhancedTracingPlugin, {
  name: 'enhanced-tracing-plugin',
  fastify: '5.x',
});
