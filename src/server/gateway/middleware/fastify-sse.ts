import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../../utils/logger';

// Interface for SSE clients
interface SSEClient {
  id: string;
  reply: FastifyReply;
  lastEventId?: string;
}

// Store active SSE connections
const sseClients: Map<string, SSEClient> = new Map();

// Generate a unique client ID
function generateClientId(): string {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}

// Send an event to a specific client
export function sendEventToClient(clientId: string, event: string, data: any): boolean {
  const client = sseClients.get(clientId);
  if (!client) {
    return false;
  }

  try {
    const eventId = Date.now().toString();
    const message = `id: ${eventId}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    client.reply.raw.write(message);
    client.lastEventId = eventId;
    return true;
  } catch (error) {
    logger.error(`Failed to send event to client ${clientId}`, error);
    return false;
  }
}

// Send an event to all clients
export function broadcastEvent(event: string, data: any): void {
  for (const clientId of sseClients.keys()) {
    sendEventToClient(clientId, event, data);
  }
}

// Get the number of active SSE connections
export function getActiveConnectionsCount(): number {
  return sseClients.size;
}

/**
 * Fastify plugin for SSE (Server-Sent Events)
 */
export function ssePlugin(fastify: FastifyInstance, options: any, done: () => void) {
  // Handle SSE connections
  fastify.get('/api/sse/connect', async (request: FastifyRequest, reply: FastifyReply) => {
    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    // Create a new client ID
    const clientId = generateClientId();

    // Store the client
    sseClients.set(clientId, { id: clientId, reply });

    // Send initial connection event
    const connectEvent = `id: 0\nevent: connect\ndata: {"clientId":"${clientId}"}\n\n`;
    reply.raw.write(connectEvent);

    logger.info(`SSE client connected: ${clientId}`);

    // Handle connection close
    request.raw.on('close', () => {
      sseClients.delete(clientId);
      logger.info(`SSE client disconnected: ${clientId}`);
    });

    // Keep the connection open
    return reply;
  });

  // Get active SSE connections
  fastify.get('/api/sse/connections', async (request, reply) => {
    const connections = Array.from(sseClients.keys()).map(id => ({
      id,
      connectedAt: parseInt(sseClients.get(id)?.lastEventId || '0') || Date.now()
    }));

    return {
      count: connections.length,
      connections
    };
  });

  // Send an event to a specific client
  fastify.post<{
    Params: { clientId: string };
    Body: { event: string; data: any };
  }>('/api/sse/send/:clientId', async (request, reply) => {
    const { clientId } = request.params;
    const { event, data } = request.body;

    if (!event || !data) {
      return reply.status(400).send({ error: 'Missing event or data' });
    }

    const success = sendEventToClient(clientId, event, data);

    if (!success) {
      return reply.status(404).send({ error: 'Client not found' });
    }

    return { success: true };
  });

  // Broadcast an event to all clients
  fastify.post<{
    Body: { event: string; data: any };
  }>('/api/sse/broadcast', async (request, reply) => {
    const { event, data } = request.body;

    if (!event || !data) {
      return reply.status(400).send({ error: 'Missing event or data' });
    }

    broadcastEvent(event, data);

    return {
      success: true,
      clientCount: sseClients.size
    };
  });

  done();
}
