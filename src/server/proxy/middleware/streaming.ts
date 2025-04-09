import { Context, MiddlewareHandler, Next } from 'hono';
import { logger } from '../../utils/logger';

// Interface for SSE clients
interface SSEClient {
  id: string;
  controller: ReadableStreamDefaultController;
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
    client.controller.enqueue(new TextEncoder().encode(message));
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

// Middleware for handling SSE connections
export const sseMiddleware: MiddlewareHandler = async (c: Context, next: Next) => {
  // Check if this is an SSE request
  const acceptHeader = c.req.header('Accept');
  if (acceptHeader !== 'text/event-stream') {
    return next();
  }
  
  // Set SSE headers
  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');
  
  // Create a new client ID
  const clientId = generateClientId();
  
  // Create a readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      // Store the client
      sseClients.set(clientId, { id: clientId, controller });
      
      // Send initial connection event
      const connectEvent = `id: 0\nevent: connect\ndata: {"clientId":"${clientId}"}\n\n`;
      controller.enqueue(new TextEncoder().encode(connectEvent));
      
      logger.info(`SSE client connected: ${clientId}`);
    },
    cancel() {
      // Remove the client when the connection is closed
      sseClients.delete(clientId);
      logger.info(`SSE client disconnected: ${clientId}`);
    }
  });
  
  // Return the stream as the response
  return new Response(stream, {
    headers: c.res.headers
  });
};

// API endpoints for SSE management
export function registerSSERoutes(app: any) {
  // Get active SSE connections
  app.get('/api/sse/connections', (c: Context) => {
    const connections = Array.from(sseClients.keys()).map(id => ({
      id,
      connectedAt: parseInt(sseClients.get(id)?.lastEventId || '0') || Date.now()
    }));
    
    return c.json({
      count: connections.length,
      connections
    });
  });
  
  // Send an event to a specific client
  app.post('/api/sse/send/:clientId', async (c: Context) => {
    const clientId = c.req.param('clientId');
    const body = await c.req.json();
    
    if (!body.event || !body.data) {
      return c.json({ error: 'Missing event or data' }, 400);
    }
    
    const success = sendEventToClient(clientId, body.event, body.data);
    
    if (!success) {
      return c.json({ error: 'Client not found' }, 404);
    }
    
    return c.json({ success: true });
  });
  
  // Broadcast an event to all clients
  app.post('/api/sse/broadcast', async (c: Context) => {
    const body = await c.req.json();
    
    if (!body.event || !body.data) {
      return c.json({ error: 'Missing event or data' }, 400);
    }
    
    broadcastEvent(body.event, body.data);
    
    return c.json({
      success: true,
      clientCount: sseClients.size
    });
  });
}
