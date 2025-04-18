# Enhanced Tracing Plugin for Fastify

This plugin provides comprehensive request and response tracing for Fastify applications, with a focus on performance and efficiency. It captures detailed information about HTTP requests and responses, including:

- Request metadata (method, URL, path, query parameters)
- Request headers
- Request body
- Response headers
- Response body (including stream content)
- Timing information (start time, end time, duration)
- Error information

All captured data is stored in memory and can be displayed in a trace dashboard.

## Features

- **Efficient Stream Handling**: Captures request and response data without blocking or consuming streams
- **Stream Content Capture**: Uses a transform stream to capture stream content without disrupting the normal flow
- **Smart Body Processing**: Intelligently processes different types of request and response bodies
- **Size Limits**: Enforces size limits to prevent memory issues
- **Content Type Detection**: Attempts to parse JSON content when appropriate
- **Error Handling**: Gracefully handles errors during processing
- **Real-time Updates**: Broadcasts new traces via WebSocket for real-time dashboard updates
- **API Endpoints**: Provides API endpoints to access trace data

## Implementation Details

The plugin uses Fastify's lifecycle hooks to capture data at the optimal points:

1. **onRequest**: Captures initial request metadata and headers
2. **preHandler**: Captures the request body after it's been parsed by Fastify
3. **onSend**: Captures the response headers and body before it's sent
4. **onResponse**: Finalizes the trace with timing information
5. **onError**: Captures any errors that occur during processing

For streams (like those from proxy routes), the plugin uses a special stream cloning mechanism that:

1. Creates a transform stream that captures data as it passes through
2. Pipes the original stream through the transform stream
3. Collects the data in memory (up to a configurable limit)
4. Processes the captured data after the stream is complete

## API Endpoints

The plugin automatically registers the following API endpoints:

- `GET /api/traces`: Get all traces with pagination
- `GET /api/traces/:id`: Get a specific trace by ID
- `GET /api/traces/stats`: Get trace statistics
- `DELETE /api/traces`: Clear all traces

## Configuration

The plugin has some constants that can be configured:

- `MAX_BODY_SIZE`: Maximum size of request body to capture (default: 100KB)
- `MAX_RESPONSE_SIZE`: Maximum size of response body to capture (default: 100KB)
- `EXCLUDED_PATHS`: Array of regular expressions for paths to exclude from tracing

## Usage

The plugin is designed to be registered with Fastify:

```typescript
import fastify from 'fastify';
import enhancedTracingPlugin from './middleware/enhanced-tracing-plugin';

const server = fastify();

// Register the enhanced tracing plugin
server.register(enhancedTracingPlugin);

// Add your routes
server.get('/hello', (request, reply) => {
  reply.send({ message: 'Hello, world!' });
});

server.listen({ port: 3000 });
```

## Trace Dashboard

The trace data can be viewed in the trace dashboard, which is part of the gateway UI. The plugin broadcasts new traces via WebSocket for real-time updates.

## Performance Considerations

- The plugin is designed to be as efficient as possible, avoiding re-reading streams
- For large request/response bodies, only a portion is captured to prevent memory issues
- Paths that don't need tracing can be excluded using the `EXCLUDED_PATHS` configuration

## Limitations

- The plugin stores traces in memory, so it's not suitable for long-term storage in production environments with high traffic
- Stream content is limited to a configurable size (default: 500KB) to prevent memory issues
- Very large streams may cause increased memory usage during capture
