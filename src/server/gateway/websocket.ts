import { FastifyInstance, FastifyRequest } from 'fastify';
import FastifyWebSocket from '@fastify/websocket';
import { logger } from '../utils/logger';
import { getTraces, getTraceById, clearTraces, getTraceStats, TraceData } from '../utils/tracing';
import WebSocket from 'ws';

/**
 * Safely stringify a value, handling circular references
 */
function safeStringify(obj: any): string {
  try {
    // Use standard JSON.stringify with circular reference handling
    const cache: any[] = [];
    return JSON.stringify(obj, (_key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (cache.includes(value)) {
          return '[Circular]';
        }
        cache.push(value);
      }
      return value;
    });
  } catch (error) {
    return '[Error: Could not stringify]';
  }
}

// Store active WebSocket connections for broadcasting
const activeConnections = new Set<WebSocket>();

/**
 * Register WebSocket routes for the gateway
 */
export function registerWebSocketRoutes(fastify: FastifyInstance) {
  // Register WebSocket plugin
  fastify.register(FastifyWebSocket, {
    options: { maxPayload: 1048576 },
  });

  // Log WebSocket registration
  logger.info('Registering WebSocket routes for gateway');

  // WebSocket connection endpoint
  fastify.register(async function (fastify) {
    fastify.get('/ws', { websocket: true }, (socket: WebSocket, _req: FastifyRequest) => {
      logger.info('WebSocket client connected');

      // Add socket to active connections
      activeConnections.add(socket);

      // Send initial connection message
      socket.send(
        safeStringify({
          type: 'connection',
          message: 'Connected to Clay Gateway',
        })
      );

      // Send initial data immediately with a small delay to ensure client is ready
      setTimeout(() => {
        try {
          // Send trace stats
          const stats = getTraceStats();
          socket.send(
            safeStringify({
              type: 'stats',
              data: stats,
            })
          );

          // Send recent traces
          const traces = getTraces(50, 1);
          socket.send(
            safeStringify({
              type: 'traces',
              data: traces,
            })
          );

          logger.info('Sent initial data to WebSocket client');
        } catch (error) {
          logger.error('Error sending initial data to WebSocket client:', error);
        }
      }, 100); // Small delay to ensure client is ready
      // Handle messages from client
      socket.on('message', (message: any) => {
        try {
          const data = JSON.parse(message.toString());
          logger.info(`Received message: ${JSON.stringify(data)}`);

          // Handle different message types
          switch (data.type) {
            case 'getTraces':
              handleGetTraces(socket, data);
              break;
            case 'getTrace':
              handleGetTrace(socket, data);
              break;
            case 'clearTraces':
              handleClearTraces(socket);
              break;
            case 'getStats':
              handleGetStats(socket);
              break;
            case 'ping':
              socket.send(
                safeStringify({
                  type: 'pong',
                  timestamp: Date.now(),
                })
              );
              break;
            default:
              socket.send(
                safeStringify({
                  type: 'error',
                  message: `Unknown message type: ${data.type}`,
                })
              );
          }
        } catch (error) {
          logger.error('Error handling WebSocket message:', error);
          socket.send(
            safeStringify({
              type: 'error',
              message: 'Invalid message format',
            })
          );
        }
      });

      // Handle disconnection
      socket.on('close', () => {
        // Remove socket from active connections
        activeConnections.delete(socket);
        logger.info('WebSocket client disconnected');
      });
    });
  });
}

/**
 * Handle getTraces request
 */
function handleGetTraces(socket: WebSocket, data: any) {
  try {
    const page = data.page || 1;
    const limit = data.limit || 50;
    const tracesData = getTraces(limit, page);

    socket.send(
      safeStringify({
        type: 'traces',
        data: tracesData,
      })
    );
  } catch (error) {
    logger.error('Error fetching traces:', error);
    socket.send(
      safeStringify({
        type: 'error',
        message: 'Failed to fetch traces',
      })
    );
  }
}

/**
 * Handle getTrace request
 */
function handleGetTrace(socket: WebSocket, data: any) {
  try {
    if (!data.id) {
      socket.send(
        safeStringify({
          type: 'error',
          message: 'Trace ID is required',
        })
      );
      return;
    }

    const trace = getTraceById(data.id);

    if (!trace) {
      socket.send(
        safeStringify({
          type: 'error',
          message: 'Trace not found',
        })
      );
      return;
    }

    socket.send(
      safeStringify({
        type: 'trace',
        data: trace,
      })
    );
  } catch (error) {
    logger.error(`Error fetching trace ${data.id}:`, error);
    socket.send(
      safeStringify({
        type: 'error',
        message: 'Failed to fetch trace',
      })
    );
  }
}

/**
 * Handle clearTraces request
 */
function handleClearTraces(socket: WebSocket) {
  try {
    clearTraces();
    socket.send(
      safeStringify({
        type: 'tracesCleared',
        success: true,
      })
    );
  } catch (error) {
    logger.error('Error clearing traces:', error);
    socket.send(
      safeStringify({
        type: 'error',
        message: 'Failed to clear traces',
      })
    );
  }
}

// Track last stats time to prevent spamming
let lastStatsTime = 0;
const STATS_THROTTLE_MS = 5000; // 5 seconds minimum between stats requests

/**
 * Handle getStats request
 */
function handleGetStats(socket: WebSocket) {
  // Rate limit stats requests to prevent spamming
  const now = Date.now();
  if (now - lastStatsTime < STATS_THROTTLE_MS) {
    // Silently ignore too-frequent requests
    return;
  }

  lastStatsTime = now;

  try {
    const stats = getTraceStats();
    socket.send(
      safeStringify({
        type: 'stats',
        data: stats,
      })
    );
  } catch (error) {
    // Don't log errors for stats to reduce spam
    socket.send(
      safeStringify({
        type: 'error',
        message: 'Failed to fetch stats',
      })
    );
  }
}

/**
 * Broadcast a new trace to all connected clients
 */
export function broadcastNewTrace(trace: TraceData) {
  // Only log at debug level to reduce log spam
  logger.debug(`Broadcasting new trace: ${trace.id}`);

  const message = safeStringify({
    type: 'newTrace',
    data: trace,
  });

  // Use more efficient broadcasting with error handling
  activeConnections.forEach(socket => {
    if (socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(message);
      } catch (error) {
        logger.error(
          `Error broadcasting trace to client: ${error instanceof Error ? error.message : String(error)}`
        );

        // Remove problematic connections
        try {
          socket.close();
        } catch (closeError) {
          // Ignore close errors
        } finally {
          activeConnections.delete(socket);
        }
      }
    }
  });
}
