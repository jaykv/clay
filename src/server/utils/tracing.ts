import { logger } from './logger';

/**
 * LLM-specific metrics interface
 */
export interface LLMMetrics {
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cost?: number;
  promptLength?: number;
  responseLength?: number;
  temperature?: number;
  maxTokens?: number;
}

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
  llmMetrics?: LLMMetrics;
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
  llmStats: {
    totalTokens: number;
    totalCost: number;
    avgTokensPerRequest: number;
    avgCostPerRequest: number;
    modelCounts: Record<string, number>;
    avgInputTokens: number;
    avgOutputTokens: number;
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

    // Calculate LLM statistics
    const tracesWithLLM = this.traces.filter(t => t.llmMetrics);
    const totalTokens = tracesWithLLM.reduce((sum, t) => sum + (t.llmMetrics?.totalTokens || 0), 0);
    const totalCost = tracesWithLLM.reduce((sum, t) => sum + (t.llmMetrics?.cost || 0), 0);
    const totalInputTokens = tracesWithLLM.reduce((sum, t) => sum + (t.llmMetrics?.inputTokens || 0), 0);
    const totalOutputTokens = tracesWithLLM.reduce((sum, t) => sum + (t.llmMetrics?.outputTokens || 0), 0);

    const avgTokensPerRequest = tracesWithLLM.length > 0 ? totalTokens / tracesWithLLM.length : 0;
    const avgCostPerRequest = tracesWithLLM.length > 0 ? totalCost / tracesWithLLM.length : 0;
    const avgInputTokens = tracesWithLLM.length > 0 ? totalInputTokens / tracesWithLLM.length : 0;
    const avgOutputTokens = tracesWithLLM.length > 0 ? totalOutputTokens / tracesWithLLM.length : 0;

    // Count requests by model
    const modelCounts: Record<string, number> = {};
    tracesWithLLM.forEach(t => {
      if (t.llmMetrics?.model) {
        modelCounts[t.llmMetrics.model] = (modelCounts[t.llmMetrics.model] || 0) + 1;
      }
    });

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
      llmStats: {
        totalTokens,
        totalCost,
        avgTokensPerRequest,
        avgCostPerRequest,
        modelCounts,
        avgInputTokens,
        avgOutputTokens,
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

/**
 * Extract LLM metrics from request/response data
 */
export function extractLLMMetrics(body: any, response: any): LLMMetrics | undefined {
  try {
    const metrics: LLMMetrics = {};

    // Extract from request body
    if (body) {
      if (typeof body === 'object') {
        // OpenAI/Claude style
        metrics.model = body.model;
        metrics.temperature = body.temperature;
        metrics.maxTokens = body.max_tokens || body.maxTokens;

        // Gemini style
        if (body.generationConfig) {
          metrics.temperature = body.generationConfig.temperature;
          metrics.maxTokens = body.generationConfig.maxOutputTokens;
        }

        // Calculate prompt length
        if (body.messages && Array.isArray(body.messages)) {
          // OpenAI/Claude style
          metrics.promptLength = body.messages.reduce((total: number, msg: any) => {
            return total + (msg.content ? msg.content.length : 0);
          }, 0);
        } else if (body.prompt) {
          // Simple prompt style
          metrics.promptLength = body.prompt.length;
        } else if (body.contents && Array.isArray(body.contents)) {
          // Gemini style
          metrics.promptLength = body.contents.reduce((total: number, content: any) => {
            if (content.parts && Array.isArray(content.parts)) {
              return total + content.parts.reduce((partTotal: number, part: any) => {
                return partTotal + (part.text ? part.text.length : 0);
              }, 0);
            }
            return total;
          }, 0);
        }
      }
    }

    // Extract from response
    if (response) {
      let responseObj = response;

      // Handle streaming responses (array of chunks)
      if (Array.isArray(response)) {
        // For streaming responses, find the chunk with the most complete usage metadata
        // Support both Gemini (usageMetadata) and OpenAI (usage) formats
        responseObj = response.reduce((best: any, chunk: any) => {
          if (!chunk) return best;

          // Check for usage metadata in either format
          const hasGeminiUsage = chunk.usageMetadata;
          const hasOpenAIUsage = chunk.usage;

          if (!hasGeminiUsage && !hasOpenAIUsage) return best;

          // For Gemini: prefer chunk with candidatesTokenCount (final chunk)
          if (hasGeminiUsage) {
            const chunkMeta = chunk.usageMetadata;
            const bestMeta = best?.usageMetadata;

            if (chunkMeta.candidatesTokenCount && !bestMeta?.candidatesTokenCount) {
              return chunk;
            }

            if (chunkMeta.candidatesTokenCount && bestMeta?.candidatesTokenCount) {
              return (chunkMeta.totalTokenCount || 0) > (bestMeta.totalTokenCount || 0) ? chunk : best;
            }

            return (chunkMeta.totalTokenCount || 0) > (bestMeta?.totalTokenCount || 0) ? chunk : best;
          }

          // For OpenAI: prefer chunk with usage (usually the final chunk)
          if (hasOpenAIUsage) {
            const chunkUsage = chunk.usage;
            const bestUsage = best?.usage;

            // Prefer chunk with completion_tokens (indicates final chunk with complete usage)
            if (chunkUsage.completion_tokens && !bestUsage?.completion_tokens) {
              return chunk;
            }

            if (chunkUsage.completion_tokens && bestUsage?.completion_tokens) {
              return (chunkUsage.total_tokens || 0) > (bestUsage.total_tokens || 0) ? chunk : best;
            }

            return (chunkUsage.total_tokens || 0) > (bestUsage?.total_tokens || 0) ? chunk : best;
          }

          return best;
        }, response[response.length - 1] || {});
      }

      if (responseObj && typeof responseObj === 'object') {
        // OpenAI/Claude style usage
        if (responseObj.usage) {
          metrics.inputTokens = responseObj.usage.prompt_tokens;
          metrics.outputTokens = responseObj.usage.completion_tokens;
          metrics.totalTokens = responseObj.usage.total_tokens;
        }

        // Gemini style usage
        if (responseObj.usageMetadata) {
          metrics.inputTokens = responseObj.usageMetadata.promptTokenCount;
          metrics.outputTokens = responseObj.usageMetadata.candidatesTokenCount;
          metrics.totalTokens = responseObj.usageMetadata.totalTokenCount;
        }

        // Extract model from response if not in request
        if (!metrics.model) {
          if (responseObj.modelVersion) {
            // Gemini style
            metrics.model = responseObj.modelVersion;
          } else if (responseObj.model) {
            // OpenAI style
            metrics.model = responseObj.model;
          }
        }
      }

      // Calculate response length
      if (Array.isArray(response)) {
        // For streaming responses, aggregate text from all chunks
        metrics.responseLength = response.reduce((total: number, chunk: any) => {
          if (!chunk) return total;

          // Handle Gemini streaming format
          if (chunk.candidates && Array.isArray(chunk.candidates)) {
            return total + chunk.candidates.reduce((chunkTotal: number, candidate: any) => {
              if (candidate.content && candidate.content.parts && Array.isArray(candidate.content.parts)) {
                return chunkTotal + candidate.content.parts.reduce((partTotal: number, part: any) => {
                  return partTotal + (part.text ? part.text.length : 0);
                }, 0);
              }
              return chunkTotal;
            }, 0);
          }

          // Handle OpenAI streaming format
          if (chunk.choices && Array.isArray(chunk.choices)) {
            return total + chunk.choices.reduce((chunkTotal: number, choice: any) => {
              // For streaming, content is in delta.content
              if (choice.delta && choice.delta.content) {
                return chunkTotal + choice.delta.content.length;
              }
              // For non-streaming or final chunk, content might be in message.content
              if (choice.message && choice.message.content) {
                return chunkTotal + choice.message.content.length;
              }
              return chunkTotal;
            }, 0);
          }

          return total;
        }, 0);
      } else if (response.choices && Array.isArray(response.choices) && response.choices[0]) {
        // OpenAI/Claude style
        const choice = response.choices[0];
        if (choice.message && choice.message.content) {
          metrics.responseLength = choice.message.content.length;
        } else if (choice.text) {
          metrics.responseLength = choice.text.length;
        }
      } else if (response.candidates && Array.isArray(response.candidates) && response.candidates[0]) {
        // Gemini style (single response)
        const candidate = response.candidates[0];
        if (candidate.content && candidate.content.parts && Array.isArray(candidate.content.parts)) {
          metrics.responseLength = candidate.content.parts.reduce((total: number, part: any) => {
            return total + (part.text ? part.text.length : 0);
          }, 0);
        }
      }

      // Estimate cost (rough approximation - would need actual pricing data)
      if (metrics.totalTokens && metrics.model) {
        metrics.cost = estimateTokenCost(metrics.model, metrics.totalTokens);
      }
    }

    // Return metrics only if we have some useful data
    return Object.keys(metrics).length > 0 ? metrics : undefined;
  } catch (error) {
    logger.debug(`Error extracting LLM metrics: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

/**
 * Estimate token cost based on model and token count
 * This is a rough approximation - real implementation would use actual pricing
 */
function estimateTokenCost(model: string, tokens: number): number {
  // Rough pricing estimates (per 1K tokens)
  const pricing: Record<string, number> = {
    'gpt-4': 0.03,
    'gpt-4-turbo': 0.01,
    'gpt-3.5-turbo': 0.002,
    'claude-3-opus': 0.015,
    'claude-3-sonnet': 0.003,
    'claude-3-haiku': 0.00025,
    // Gemini pricing (approximate)
    'gemini-2.0-flash': 0.00075,
    'gemini-1.5-pro': 0.0035,
    'gemini-1.5-flash': 0.00075,
    'gemini-pro': 0.0005,
  };

  const modelKey = Object.keys(pricing).find(key => model.toLowerCase().includes(key.toLowerCase()));
  const pricePerK = modelKey ? pricing[modelKey] : 0.01; // Default fallback

  return (tokens / 1000) * pricePerK;
}

// For backward compatibility with the old telemetry module
export const initOpenTelemetry = initTracing;
