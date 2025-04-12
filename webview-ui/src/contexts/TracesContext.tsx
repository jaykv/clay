import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
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
  const [pagination, setPagination] = useState<PaginationData>({ total: 0, page: 1, limit: 50, pages: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedTrace, setSelectedTrace] = useState<string | null>(null);

  // Load traces from the server
  const loadTraces = useCallback(async (page = pagination.page, limit = pagination.limit) => {
    try {
      setLoading(true);
      setError(null);

      const data = await getTraces(page, limit);

      if (data.traces.length > 0) {
        setTraces(data.traces);
        setPagination(data.pagination);
      }

      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error loading traces:', err);
      setError('Failed to load traces');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit]);

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
  const handleNewTrace = useCallback((message: any) => {
    if (message.data) {
      // Add the new trace to the beginning of the array
      setTraces(prevTraces => [message.data, ...prevTraces.slice(0, 49)]);

      // Update pagination total
      setPagination(prev => ({
        ...prev,
        total: prev.total + 1
      }));

      // Update last updated time
      setLastUpdated(new Date());
    }
  }, []);

  // Handle traces update from WebSocket
  const handleTracesUpdate = useCallback((message: any) => {
    if (message.data && message.data.traces) {
      setTraces(message.data.traces);
      setPagination(message.data.pagination);
      setLastUpdated(new Date());
    }
  }, []);

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

    // Set up polling for data if WebSocket is not connected
    const interval = setInterval(() => {
      if (wsClient.getStatus() === 'connected') {
        // Use rate limiting for stats
        wsClient.getStats(false);

        // Only reload traces if we're on the first page to avoid
        // disrupting pagination navigation
        if (pagination.page === 1) {
          loadTraces(1, pagination.limit);
        }
      }
    }, 10000); // Poll every 10 seconds

    return () => {
      clearInterval(interval);
      wsClient.off('newTrace', handleNewTrace);
      wsClient.off('traces', handleTracesUpdate);
      wsClient.off('stats', handleStatsUpdate);
    };
  }, [handleNewTrace, handleTracesUpdate, handleStatsUpdate, loadTraces, loadStats, pagination.page, pagination.limit]);

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

  return (
    <TracesContext.Provider value={contextValue}>
      {children}
    </TracesContext.Provider>
  );
};

// Custom hook to use the traces context
export const useTraces = () => useContext(TracesContext);
