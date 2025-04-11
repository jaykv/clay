import { FastifyInstance, FastifyRequest } from 'fastify';
import FastifyWebSocket from '@fastify/websocket';
import { logger } from '../utils/logger';
import { getTraces, getTraceById, clearTraces, getTraceStats } from '../utils/telemetry';
import WebSocket from 'ws';

// Store active WebSocket connections for broadcasting
const activeConnections = new Set<WebSocket>();

/**
 * Register WebSocket routes for the gateway
 */
export function registerWebSocketRoutes(fastify: FastifyInstance) {
  // Register WebSocket plugin
  fastify.register(FastifyWebSocket, {
    options: { maxPayload: 1048576 }
  })

  // Log WebSocket registration
  logger.info('Registering WebSocket routes for gateway');

  // WebSocket connection endpoint
  fastify.register(async function(fastify) {

    fastify.get('/ws', { websocket: true }, (socket: WebSocket, _req: FastifyRequest) => {
      logger.info('WebSocket client connected');

      // Add socket to active connections
      activeConnections.add(socket);

      // Send initial connection message
      socket.send(JSON.stringify({
        type: 'connection',
        message: 'Connected to Clay Gateway'
      }));

      // Send initial data immediately with a small delay to ensure client is ready
      setTimeout(() => {
        try {
          // Send trace stats
          const stats = getTraceStats();
          socket.send(JSON.stringify({
            type: 'stats',
            data: stats
          }));

          // Send recent traces
          const traces = getTraces(50, 1);
          socket.send(JSON.stringify({
            type: 'traces',
            data: traces
          }));

          logger.info('Sent initial data to WebSocket client');
        } catch (error) {
          logger.error('Error sending initial data to WebSocket client:', error);
        }
      }, 100); // Small delay to ensure client is ready
      // Handle messages from client
      socket.on('message', (message: any) => {
        logger.error(message);

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
              socket.send(JSON.stringify({
                type: 'pong',
                timestamp: Date.now()
              }));
              break;
            default:
              socket.send(JSON.stringify({
                type: 'error',
                message: `Unknown message type: ${data.type}`
              }));
          }
        } catch (error) {
          logger.error('Error handling WebSocket message:', error);
          socket.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format'
          }));
        }
      });


      // Handle disconnection
      socket.on('close', () => {
        // Remove socket from active connections
        activeConnections.delete(socket);
        logger.info('WebSocket client disconnected');
      });
    })
  })
}

/**
 * Handle getTraces request
 */
function handleGetTraces(socket: WebSocket, data: any) {
  try {
    const page = data.page || 1;
    const limit = data.limit || 50;
    const tracesData = getTraces(limit, page);

    socket.send(JSON.stringify({
      type: 'traces',
      data: tracesData
    }));
  } catch (error) {
    logger.error('Error fetching traces:', error);
    socket.send(JSON.stringify({
      type: 'error',
      message: 'Failed to fetch traces'
    }));
  }
}

/**
 * Handle getTrace request
 */
function handleGetTrace(socket: WebSocket, data: any) {
  try {
    if (!data.id) {
      socket.send(JSON.stringify({
        type: 'error',
        message: 'Trace ID is required'
      }));
      return;
    }

    const trace = getTraceById(data.id);

    if (!trace) {
      socket.send(JSON.stringify({
        type: 'error',
        message: 'Trace not found'
      }));
      return;
    }

    socket.send(JSON.stringify({
      type: 'trace',
      data: trace
    }));
  } catch (error) {
    logger.error(`Error fetching trace ${data.id}:`, error);
    socket.send(JSON.stringify({
      type: 'error',
      message: 'Failed to fetch trace'
    }));
  }
}

/**
 * Handle clearTraces request
 */
function handleClearTraces(socket: WebSocket) {
  try {
    clearTraces();
    socket.send(JSON.stringify({
      type: 'tracesCleared',
      success: true
    }));
  } catch (error) {
    logger.error('Error clearing traces:', error);
    socket.send(JSON.stringify({
      type: 'error',
      message: 'Failed to clear traces'
    }));
  }
}

/**
 * Handle getStats request
 */
function handleGetStats(socket: WebSocket) {
  try {
    const stats = getTraceStats();
    socket.send(JSON.stringify({
      type: 'stats',
      data: stats
    }));
  } catch (error) {
    logger.error('Error fetching stats:', error);
    socket.send(JSON.stringify({
      type: 'error',
      message: 'Failed to fetch stats'
    }));
  }
}



/**
 * Broadcast a new trace to all connected clients
 */
export function broadcastNewTrace(trace: any) {
  logger.info(`Broadcasting new trace: ${trace.id}`);

  const message = JSON.stringify({
    type: 'newTrace',
    data: trace
  });

  for (const socket of activeConnections) {
    if (socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(message);
      } catch (error) {
        logger.error('Error broadcasting trace:', error);
      }
    }
  }
}
