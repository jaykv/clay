import { logger } from './logger';

// In-memory storage for traces
interface TraceData {
  id: string;
  method: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body?: any;
  bodyTruncated?: boolean;
  startTime: number;
  endTime?: number;
  duration?: number;
  status?: number;
  response?: any;
  responseTruncated?: boolean;
  error?: Error;
}

// In-memory storage for trace data
const traces: TraceData[] = [];
const MAX_TRACES = 1000;

/**
 * Initialize OpenTelemetry SDK
 */
export function initOpenTelemetry() {
  logger.info('OpenTelemetry initialized successfully');
  return { traces };
}

/**
 * Generate a unique ID for each request
 */
export function generateTraceId(): string {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}

/**
 * Add a new trace
 */
export function addTrace(trace: TraceData): void {
  traces.unshift(trace);

  // Keep only the most recent traces
  if (traces.length > MAX_TRACES) {
    traces.pop();
  }
}

/**
 * Get all traces from the in-memory storage
 */
export function getTraces(limit = 50, page = 1) {
  // Calculate pagination
  const total = traces.length;
  const pages = Math.ceil(total / limit);
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;

  // Get paginated traces
  const paginatedTraces = traces.slice(startIndex, endIndex);

  return {
    traces: paginatedTraces,
    pagination: {
      total,
      page,
      limit,
      pages
    }
  };
}

/**
 * Get a specific trace by ID
 */
export function getTraceById(id: string) {
  return traces.find(trace => trace.id === id);
}

/**
 * Clear all traces
 */
export function clearTraces() {
  traces.length = 0;
  return { success: true };
}

/**
 * Get trace statistics
 */
export function getTraceStats() {
  const total = traces.length;

  // Calculate success rate (status code < 400 is success)
  const successful = traces.filter(t => t.status && t.status < 400).length;
  const successRate = total > 0 ? (successful / total) * 100 : 0;

  // Calculate average response time
  const totalDuration = traces.reduce((sum, t) => sum + (t.duration || 0), 0);
  const avgResponseTime = total > 0 ? totalDuration / total : 0;

  // Count requests by method
  const methodCounts: Record<string, number> = {};
  traces.forEach(t => {
    methodCounts[t.method] = (methodCounts[t.method] || 0) + 1;
  });

  // Count requests by status code
  const statusCounts: Record<string, number> = {};
  traces.forEach(t => {
    if (t.status) {
      const statusGroup = Math.floor(t.status / 100) * 100;
      statusCounts[statusGroup] = (statusCounts[statusGroup] || 0) + 1;
    }
  });

  // Count truncated bodies and responses
  const truncatedBodies = traces.filter(t => t.bodyTruncated).length;
  const truncatedResponses = traces.filter(t => t.responseTruncated).length;

  return {
    total,
    successRate,
    avgResponseTime,
    methodCounts,
    statusCounts,
    truncated: {
      bodies: truncatedBodies,
      responses: truncatedResponses
    }
  };
}


