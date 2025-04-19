import React from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { useTraces } from '@/contexts/TracesContext';
import { wsClient } from '@/lib/api/websocket';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

const MetricsSidebarView: React.FC = () => {
  // Use the shared traces context
  const { stats, loading, error, connectionStatus, lastUpdated, loadStats } = useTraces();

  // Convert stats to chart data
  const methodChartData = stats
    ? Object.entries(stats.methodCounts).map(([method, count]) => ({
        name: method,
        value: count,
      }))
    : [];

  const statusChartData = stats
    ? Object.entries(stats.statusCounts).map(([status, count]) => ({
        name: `${status}s`,
        value: count,
      }))
    : [];

  // Format duration in ms to a readable format
  const formatDuration = (ms: number) => {
    if (ms < 1) return '< 1ms';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  // Handle manual WebSocket reconnection
  const handleReconnect = () => {
    wsClient.reconnect();
    // After reconnecting, try to load stats
    setTimeout(() => {
      loadStats();
    }, 500); // Small delay to allow connection to establish
  };

  return (
    <div className="flex flex-col h-full overflow-auto p-2">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium">Performance Metrics</h2>
          <div
            className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' : connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'}`}
          ></div>
          <span className="text-xs text-gray-500">{connectionStatus}</span>
        </div>
        <button
          onClick={loadStats}
          className="p-1.5 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center"
          title="Refresh Metrics"
        >
          {loading && !stats ? (
            <Spinner size="sm" />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
        </button>
      </div>

      {/* WebSocket connection status and reconnect button */}
      {connectionStatus !== 'connected' && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-2 mb-3 flex items-center justify-between">
          <div className="flex items-center">
            <svg
              className="h-4 w-4 text-blue-500 mr-2"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            <span className="text-xs text-blue-700 dark:text-blue-300">
              {connectionStatus === 'connecting'
                ? 'Connecting to server...'
                : 'WebSocket disconnected. Data may be stale.'}
            </span>
          </div>
          <button
            onClick={handleReconnect}
            className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center"
            disabled={connectionStatus === 'connecting'}
          >
            {connectionStatus === 'connecting' && <Spinner size="sm" className="mr-1" />}
            {connectionStatus === 'connecting' ? 'Connecting...' : 'Reconnect'}
          </button>
        </div>
      )}

      {loading && !stats && (
        <div className="py-8 text-center text-gray-500 dark:text-gray-400">
          <Spinner size="md" className="mx-auto mb-2" />
          <p className="text-sm">Loading metrics...</p>
        </div>
      )}

      {error && !stats && (
        <div className="py-4 text-center text-red-500">
          <p className="text-sm">{error}</p>
          <button
            onClick={loadStats}
            className="mt-2 px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Try Again
          </button>
        </div>
      )}

      {stats && (
        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-md">
            <h3 className="text-xs font-medium mb-2">Summary</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Requests</p>
                <p className="text-lg font-semibold">{stats.total}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Success Rate</p>
                <p className="text-lg font-semibold">{stats.successRate.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Avg Response Time</p>
                <p className="text-lg font-semibold">{formatDuration(stats.avgResponseTime)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Last Updated</p>
                <p className="text-sm">
                  {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Never'}
                </p>
              </div>
            </div>
          </div>

          {/* Method Distribution */}
          <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-md">
            <h3 className="text-xs font-medium mb-2">Requests by Method</h3>
            {methodChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={150}>
                <BarChart
                  data={methodChartData}
                  margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                  <XAxis dataKey="name" tick={{ fill: '#888', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#888', fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(50, 50, 50, 0.9)',
                      border: 'none',
                      borderRadius: '4px',
                      color: '#fff',
                      fontSize: '10px',
                    }}
                  />
                  <Bar dataKey="value" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[150px] flex items-center justify-center text-gray-500 text-xs">
                No data available
              </div>
            )}
          </div>

          {/* Status Code Distribution */}
          <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-md">
            <h3 className="text-xs font-medium mb-2">Status Code Distribution</h3>
            {statusChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={150}>
                <BarChart
                  data={statusChartData}
                  margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                  <XAxis dataKey="name" tick={{ fill: '#888', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#888', fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(50, 50, 50, 0.9)',
                      border: 'none',
                      borderRadius: '4px',
                      color: '#fff',
                      fontSize: '10px',
                    }}
                  />
                  <Bar dataKey="value">
                    {statusChartData.map((entry, index) => {
                      // Color based on status code
                      let color = '#8884d8'; // Default purple
                      if (entry.name.startsWith('2')) color = '#00C49F'; // Green for 2xx
                      if (entry.name.startsWith('4')) color = '#FFBB28'; // Yellow for 4xx
                      if (entry.name.startsWith('5')) color = '#FF8042'; // Orange for 5xx

                      return <Cell key={`cell-${index}`} fill={color} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[150px] flex items-center justify-center text-gray-500 text-xs">
                No data available
              </div>
            )}
          </div>

          {/* Truncation Stats */}
          <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-md">
            <h3 className="text-xs font-medium mb-2">Truncation Statistics</h3>
            {stats.truncated ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col items-center justify-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Truncated Request Bodies
                  </p>
                  <p className="text-lg font-semibold">{stats.truncated.bodies}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    (
                    {stats.total > 0
                      ? ((stats.truncated.bodies / stats.total) * 100).toFixed(1)
                      : 0}
                    %)
                  </p>
                </div>
                <div className="flex flex-col items-center justify-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Truncated Response Bodies
                  </p>
                  <p className="text-lg font-semibold">{stats.truncated.responses}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    (
                    {stats.total > 0
                      ? ((stats.truncated.responses / stats.total) * 100).toFixed(1)
                      : 0}
                    %)
                  </p>
                </div>
              </div>
            ) : (
              <div className="h-[80px] flex items-center justify-center text-gray-500 text-xs">
                No truncation data available
              </div>
            )}
          </div>

          {/* Additional information */}
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            <p>
              Metrics are updated automatically every 10 seconds when the WebSocket connection is
              active.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MetricsSidebarView;
