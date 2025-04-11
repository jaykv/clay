import React, { useState, useEffect, useCallback } from 'react';
import Card from '@/components/ui/Card';
import { getTraceStats, TraceStats } from '@/lib/api/traces';
import { wsClient, ConnectionStatus } from '@/lib/api/websocket';

// Using TraceStats interface imported from api/traces

const PerformanceMetrics: React.FC = () => {
  const [stats, setStats] = useState<TraceStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Set a timeout to show loading state for at least 500ms
      // This prevents flickering if data loads very quickly
      const loadingTimer = setTimeout(() => {}, 500);

      const data = await getTraceStats();
      setStats(data);

      clearTimeout(loadingTimer);
    } catch (err) {
      // Only show error if we don't have any stats yet
      if (!stats) {
        setError('Failed to load performance metrics. Make sure the proxy server is running.');
      }
      console.error(err);
    } finally {
      // Add a small delay before hiding the loading indicator
      // to prevent UI flickering
      setTimeout(() => {
        setLoading(false);
      }, 300);
    }
  }, [stats]);

  // Handle stats updates via WebSocket
  const handleStatsUpdate = useCallback((message: any) => {
    if (message.data) {
      setStats(message.data);
      setLoading(false);
      setError(null); // Clear any errors when we get data
    }
  }, []);

  useEffect(() => {
    // Set up status listener
    wsClient.onStatusChange(setConnectionStatus);

    // Set up stats listener
    wsClient.on('stats', handleStatsUpdate);

    // Initial load of stats
    loadStats();

    // Request stats every 5 seconds if connected, or load via HTTP if not
    const interval = setInterval(() => {
      if (wsClient.isConnected()) {
        wsClient.getStats();
      } else {
        // Fall back to HTTP if WebSocket is not connected
        console.log('WebSocket not connected, loading stats via HTTP');
        loadStats();
      }
    }, 5000);

    return () => {
      // Clean up listeners when component unmounts
      wsClient.offStatusChange(setConnectionStatus);
      wsClient.off('stats', handleStatsUpdate);
      clearInterval(interval);
    };
  }, [loadStats, handleStatsUpdate]);

  if (loading && !stats) {
    return (
      <Card title="Performance Metrics">
        <div className="py-4 text-center text-gray-500 dark:text-gray-400">
          <svg className="animate-spin h-5 w-5 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading metrics...
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card title="Performance Metrics">
        <div className="py-4 text-center text-red-500 dark:text-red-400">
          <p>{error}</p>
          <button
            onClick={loadStats}
            className="mt-2 px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card title="Performance Metrics">
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' : connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
        <span className="text-xs text-gray-500">{connectionStatus}</span>
        {error && <span className="text-xs text-red-500 ml-2">{error}</span>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Requests</h3>
          <p className="mt-1 text-2xl font-semibold">{stats?.total || 0}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Success Rate</h3>
          <p className="mt-1 text-2xl font-semibold">{stats?.successRate.toFixed(1) || 0}%</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Avg Response Time</h3>
          <p className="mt-1 text-2xl font-semibold">{stats?.avgResponseTime.toFixed(2) || 0} ms</p>
        </div>
      </div>

      {stats?.truncated && (stats.truncated.bodies > 0 || stats.truncated.responses > 0) && (
        <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <h3 className="text-sm font-medium text-amber-800 dark:text-amber-400 mb-1">Data Truncation Notice</h3>
          <p className="text-xs text-amber-700 dark:text-amber-500">
            Some request/response data was too large and has been truncated:
          </p>
          <ul className="text-xs text-amber-700 dark:text-amber-500 mt-1 list-disc list-inside">
            {stats.truncated.bodies > 0 && (
              <li>{stats.truncated.bodies} request {stats.truncated.bodies === 1 ? 'body' : 'bodies'} truncated</li>
            )}
            {stats.truncated.responses > 0 && (
              <li>{stats.truncated.responses} response {stats.truncated.responses === 1 ? 'body' : 'bodies'} truncated</li>
            )}
          </ul>
        </div>
      )}

      {stats && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Requests by Method</h3>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border">
              {Object.entries(stats.methodCounts).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(stats.methodCounts).map(([method, count]) => (
                    <div key={method} className="flex justify-between">
                      <span className="font-mono">{method}</span>
                      <span className="font-semibold">{count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 dark:text-gray-400">No data available</p>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Requests by Status</h3>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border">
              {Object.entries(stats.statusCounts).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(stats.statusCounts).map(([status, count]) => (
                    <div key={status} className="flex justify-between">
                      <span className="font-mono">{status}</span>
                      <span className="font-semibold">{count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 dark:text-gray-400">No data available</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 text-right">
        <button
          onClick={loadStats}
          className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
        >
          Refresh
        </button>
      </div>
    </Card>
  );
};

export default PerformanceMetrics;
