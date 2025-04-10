import { Context, MiddlewareHandler, Next } from 'hono';
import { logger } from '../../utils/logger';

// Constants for limiting captured data size
const MAX_CAPTURE_SIZE = 100 * 1024; // 100KB

/**
 * A middleware that captures response bodies for both streaming and non-streaming responses
 * without interfering with the original response.
 */
export const responseTransformerMiddleware: MiddlewareHandler = async (c: Context, next: Next) => {
  // Process the request first
  await next();

  // After the response is generated, try to capture its body
  try {
    logger.debug(`Response transformer processing response for ${c.req.path}`);

    // Get headers as an object for logging
    const headerObj: Record<string, string> = {};
    c.res.headers.forEach((value, key) => {
      headerObj[key] = value;
    });

    logger.debug(`Response status: ${c.res.status}, headers: ${JSON.stringify(headerObj)}`);

    // Check if this is a streaming response
    const contentType = c.res.headers.get('content-type') || '';
    const acceptHeader = c.req.header('accept') || '';
    const isStreamingResponse =
      contentType.includes('text/event-stream') ||
      acceptHeader.includes('text/event-stream') ||
      c.req.path.includes('gemini');

    if (isStreamingResponse) {
      logger.debug('Streaming response detected in transformer');

      // For streaming responses, we'll just store metadata and a placeholder
      // We can't easily transform the stream in a type-safe way without additional dependencies
      logger.debug('Storing metadata for streaming response');

      // Store streaming response metadata in the context
      c.set('capturedResponseBody', {
        isStreaming: true,
        content: '[Streaming response - body not captured]',
        partialContent: '',
        isTruncated: false
      });

      // Log that we're skipping body capture for streaming responses
      logger.debug('Skipping body capture for streaming response to avoid interfering with the stream');

      // We don't modify the response for streaming responses to avoid breaking the stream
    } else {
      // For non-streaming responses, we can clone and read the body
      try {
        // Clone the response to read its body without consuming it
        const resClone = c.res.clone();
        const bodyText = await resClone.text();

        let responseBody = bodyText;
        let isTruncated = false;

        // Check if the body is too large
        if (bodyText.length > MAX_CAPTURE_SIZE) {
          responseBody = bodyText.substring(0, MAX_CAPTURE_SIZE);
          isTruncated = true;
        }

        // Store the captured data in the context for the tracing middleware
        c.set('capturedResponseBody', {
          isStreaming: false,
          content: responseBody,
          isTruncated
        });

        logger.debug(`Response body captured (${responseBody.length} bytes)`);
        logger.debug(`Response body preview: ${responseBody.substring(0, 100)}...`);
      } catch (error) {
        logger.error('Failed to capture non-streaming response body:', error);

        // Store at least the metadata
        c.set('capturedResponseBody', {
          isStreaming: false,
          content: '[Failed to capture response body]',
          error: (error as Error).message
        });
      }
    }
  } catch (error) {
    logger.error('Error in response transformer middleware:', error);
  }
};
