import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { getTraces, clearTraces, OtelSpan, TraceStats, PaginationData } from '@/lib/api/traces';
import { wsClient, ConnectionStatus } from '@/lib/api/websocket';

// Define the context state interface
interface TracesContextState {
  traces: OtelSpan[];
  stats: TraceStats | null;
  pagination: PaginationData;
  loading: boolean;
  error: string | null;
  connectionStatus: ConnectionStatus;
  lastUpdated: Date | null;
  selectedTrace: string | null;
  setSelectedTrace: (id: string | null) => void;
  loadTraces: (page?: number, limit?: number) => Promise<void>;
  loadStats: () => void;
  handleClearTraces: () => Promise<void>;
}

// Create the context with default values
const TracesContext = createContext<TracesContextState>({
  traces: [],
  stats: null,
  pagination: { total: 0, page: 1, limit: 50, pages: 0 },
  loading: false,
  error: null,
  connectionStatus: 'disconnected',
  lastUpdated: null,
  selectedTrace: null,
  setSelectedTrace: () => {},
  loadTraces: async () => {},
  loadStats: () => {},
  handleClearTraces: async () => {},
});

// Provider component
export const TracesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [traces, setTraces] = useState<OtelSpan[]>([]);
  const [stats, setStats] = useState<TraceStats | null>(null);
  const [pagination, setPagination] = useState<PaginationData>({
    total: 0,
    page: 1,
    limit: 50,
    pages: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedTrace, setSelectedTrace] = useState<string | null>(null);

  // Load traces from the server
  const loadTraces = useCallback(
    async (page = pagination.page, limit = pagination.limit) => {
      try {
        setLoading(true);
        setError(null);

        const data = await getTraces(page, limit);

        if (data.traces.length > 0) {
          // Update traces while preserving the selected trace
          setTraces(prevTraces => {
            const newTraces = data.traces;

            // If we have a selected trace, make sure it's still in the new traces
            if (selectedTrace) {
              const selectedTraceStillExists = newTraces.some(
                (trace: OtelSpan) =>
                  trace.id === selectedTrace ||
                  (trace.spanContext && trace.spanContext().traceId === selectedTrace)
              );

              // If the selected trace is no longer in the new traces, keep it in the list
              if (!selectedTraceStillExists) {
                const selectedTraceData = prevTraces.find(
                  trace =>
                    trace.id === selectedTrace ||
                    (trace.spanContext && trace.spanContext().traceId === selectedTrace)
                );

                if (selectedTraceData) {
                  // Add the selected trace to the new traces to prevent it from disappearing
                  return [...newTraces, selectedTraceData];
                }
              }
            }

            return newTraces;
          });

          setPagination(data.pagination);
        }

        setLastUpdated(new Date());
      } catch (err) {
        console.error('Error loading traces:', err);
        setError('Failed to load traces');
      } finally {
        setLoading(false);
      }
    },
    [pagination.page, pagination.limit, selectedTrace]
  );

  // Load stats from the server
  const loadStats = useCallback(() => {
    // Only show loading indicator if we don't have any stats yet
    if (!stats) {
      setLoading(true);
    }
    setError(null);

    // Request stats via WebSocket
    wsClient.getStats(true);
  }, [stats]);

  // Clear all traces
  const handleClearTraces = useCallback(async () => {
    try {
      setLoading(true);
      await clearTraces();
      setTraces([]);
      setSelectedTrace(null);

      // Also update stats after clearing
      loadStats();

      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error clearing traces:', err);
      setError('Failed to clear traces');
    } finally {
      setLoading(false);
    }
  }, [loadStats]);

  // Handle new trace from WebSocket
  const handleNewTrace = useCallback(
    (message: any) => {
      if (message.data) {
        // Add the new trace to the beginning of the array
        setTraces(prevTraces => {
          // Don't refresh the list if we're viewing a trace detail
          // This prevents the UI from refreshing while viewing a trace
          if (selectedTrace) {
            // Just add the new trace without refreshing the entire list
            const existingTraceIndex = prevTraces.findIndex(
              trace =>
                trace.id === selectedTrace ||
                (trace.spanContext && trace.spanContext().traceId === selectedTrace)
            );

            if (existingTraceIndex >= 0) {
              // Keep the selected trace in its current position
              const newTraces = [...prevTraces];
              newTraces.splice(0, 0, message.data);
              return newTraces.slice(0, 50); // Keep max 50 traces
            }
          }

          // Normal case - add to beginning and limit to 50 traces
          return [message.data, ...prevTraces.slice(0, 49)];
        });

        // Update pagination total
        setPagination(prev => ({
          ...prev,
          total: prev.total + 1,
        }));

        // Update last updated time
        setLastUpdated(new Date());
      }
    },
    [selectedTrace]
  );

  // Handle traces update from WebSocket
  const handleTracesUpdate = useCallback(
    (message: any) => {
      if (message.data && message.data.traces) {
        // Update traces while preserving the selected trace
        setTraces(prevTraces => {
          const newTraces = message.data.traces;

          // If we have a selected trace, make sure it's still in the new traces
          if (selectedTrace) {
            const selectedTraceStillExists = newTraces.some(
              (trace: OtelSpan) =>
                trace.id === selectedTrace ||
                (trace.spanContext && trace.spanContext().traceId === selectedTrace)
            );

            // If the selected trace is no longer in the new traces, keep it in the list
            if (!selectedTraceStillExists) {
              const selectedTraceData = prevTraces.find(
                trace =>
                  trace.id === selectedTrace ||
                  (trace.spanContext && trace.spanContext().traceId === selectedTrace)
              );

              if (selectedTraceData) {
                // Add the selected trace to the new traces to prevent it from disappearing
                return [...newTraces, selectedTraceData];
              }
            }
          }

          return newTraces;
        });

        setPagination(message.data.pagination);
        setLastUpdated(new Date());
      }
    },
    [selectedTrace]
  );

  // Handle stats update from WebSocket
  const handleStatsUpdate = useCallback((message: any) => {
    if (message.data) {
      setStats(message.data);
      setLastUpdated(new Date());
    }
  }, []);

  // Initialize WebSocket connection and listeners
  useEffect(() => {
    // Set up status listener
    wsClient.onStatusChange(setConnectionStatus);

    // Set up WebSocket listeners
    wsClient.on('newTrace', handleNewTrace);
    wsClient.on('traces', handleTracesUpdate);
    wsClient.on('stats', handleStatsUpdate);

    // Initial load of data
    loadTraces();
    loadStats();

    // No polling - rely on WebSocket updates only

    return () => {
      wsClient.off('newTrace', handleNewTrace);
      wsClient.off('traces', handleTracesUpdate);
      wsClient.off('stats', handleStatsUpdate);
    };
  }, [
    handleNewTrace,
    handleTracesUpdate,
    handleStatsUpdate,
    loadTraces,
    loadStats,
    pagination.page,
    pagination.limit,
    selectedTrace, // Add selectedTrace as a dependency
  ]);

  // Provide the context value
  const contextValue: TracesContextState = {
    traces,
    stats,
    pagination,
    loading,
    error,
    connectionStatus,
    lastUpdated,
    selectedTrace,
    setSelectedTrace,
    loadTraces,
    loadStats,
    handleClearTraces,
  };

  return <TracesContext.Provider value={contextValue}>{children}</TracesContext.Provider>;
};

// Custom hook to use the traces context
export const useTraces = () => useContext(TracesContext);
