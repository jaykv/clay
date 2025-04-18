import { logger } from './logger';

/**
 * Trace data interface
 */
export interface TraceData {
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
  responseHeaders?: Record<string, string>;
  responseTruncated?: boolean;
  error?: Error;
}

/**
 * Trace statistics interface
 */
export interface TraceStats {
  total: number;
  successRate: number;
  avgResponseTime: number;
  methodCounts: Record<string, number>;
  statusCounts: Record<string, number>;
  truncated: {
    bodies: number;
    responses: number;
  };
}

/**
 * Paginated traces response
 */
export interface PaginatedTraces {
  traces: TraceData[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

// In-memory storage for trace data with a fixed capacity
class TraceStorage {
  private traces: TraceData[] = [];
  private readonly maxTraces: number;

  constructor(maxTraces = 1000) {
    this.maxTraces = maxTraces;
  }

  /**
   * Add a new trace to storage
   */
  add(trace: TraceData): void {
    // Add to the beginning for most recent first
    this.traces.unshift(trace);

    // Remove oldest traces if we exceed capacity
    if (this.traces.length > this.maxTraces) {
      this.traces = this.traces.slice(0, this.maxTraces);
    }
  }

  /**
   * Get all traces with pagination
   */
  getAll(limit = 50, page = 1): PaginatedTraces {
    const total = this.traces.length;
    const pages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = Math.min(startIndex + limit, total);

    // Get paginated traces
    const paginatedTraces = this.traces.slice(startIndex, endIndex);

    return {
      traces: paginatedTraces,
      pagination: {
        total,
        page,
        limit,
        pages,
      },
    };
  }

  /**
   * Get a trace by ID
   */
  getById(id: string): TraceData | undefined {
    return this.traces.find(trace => trace.id === id);
  }

  /**
   * Clear all traces
   */
  clear(): void {
    this.traces = [];
  }

  /**
   * Get trace statistics
   */
  getStats(): TraceStats {
    const total = this.traces.length;

    // Calculate success rate (status code < 400 is success)
    const successful = this.traces.filter(t => t.status && t.status < 400).length;
    const successRate = total > 0 ? (successful / total) * 100 : 0;

    // Calculate average response time
    const totalDuration = this.traces.reduce((sum, t) => sum + (t.duration || 0), 0);
    const avgResponseTime = total > 0 ? totalDuration / total : 0;

    // Count requests by method
    const methodCounts: Record<string, number> = {};
    this.traces.forEach(t => {
      methodCounts[t.method] = (methodCounts[t.method] || 0) + 1;
    });

    // Count requests by status code
    const statusCounts: Record<string, number> = {};
    this.traces.forEach(t => {
      if (t.status) {
        const statusGroup = Math.floor(t.status / 100) * 100;
        statusCounts[statusGroup] = (statusCounts[statusGroup] || 0) + 1;
      }
    });

    // Count truncated bodies and responses
    const truncatedBodies = this.traces.filter(t => t.bodyTruncated).length;
    const truncatedResponses = this.traces.filter(t => t.responseTruncated).length;

    return {
      total,
      successRate,
      avgResponseTime,
      methodCounts,
      statusCounts,
      truncated: {
        bodies: truncatedBodies,
        responses: truncatedResponses,
      },
    };
  }
}

// Create a singleton instance of TraceStorage
const traceStorage = new TraceStorage();

/**
 * Initialize tracing
 */
export function initTracing(): void {
  logger.info('Tracing initialized successfully');
}

/**
 * Generate a unique ID for each request
 */
export function generateTraceId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Add a new trace
 */
export function addTrace(trace: TraceData): void {
  traceStorage.add(trace);
}

/**
 * Get all traces from the in-memory storage with pagination
 */
export function getTraces(limit = 50, page = 1): PaginatedTraces {
  return traceStorage.getAll(limit, page);
}

/**
 * Get a specific trace by ID
 */
export function getTraceById(id: string): TraceData | undefined {
  return traceStorage.getById(id);
}

/**
 * Clear all traces
 */
export function clearTraces(): { success: boolean } {
  traceStorage.clear();
  return { success: true };
}

/**
 * Get trace statistics
 */
export function getTraceStats(): TraceStats {
  return traceStorage.getStats();
}

// For backward compatibility with the old telemetry module
export const initOpenTelemetry = initTracing;
