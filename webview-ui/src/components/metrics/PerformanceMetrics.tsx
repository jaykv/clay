import React from 'react';
import Card from '@/components/ui/Card';
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

const PerformanceMetrics: React.FC = () => {
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
    <Card title="Performance Metrics">
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-medium">Trace Metrics</h3>
            <div
              className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' : connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'}`}
            ></div>
            <span className="text-xs text-vscode-descriptionForeground">{connectionStatus}</span>
          </div>
          <div className="space-x-2">
            <button
              onClick={loadStats}
              className="px-3 py-1 text-sm bg-vscode-input-bg text-vscode-input-fg rounded hover:bg-vscode-list-hover-bg flex items-center"
              disabled={loading && !stats}
            >
              {loading && !stats && <Spinner size="sm" className="mr-2" />}
              {loading && !stats ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* WebSocket connection status and reconnect button */}
        {connectionStatus !== 'connected' && (
          <div className="bg-vscode-button-bg bg-opacity-10 border border-vscode-button-bg rounded-md p-3 mb-4 flex items-center justify-between">
            <div className="flex items-center">
              <svg
                className="h-5 w-5 text-vscode-button-bg mr-2"
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
              <span className="text-sm text-vscode-button-bg">
                {connectionStatus === 'connecting'
                  ? 'Connecting to server...'
                  : 'WebSocket disconnected. Data may be stale.'}
              </span>
            </div>
            <button
              onClick={handleReconnect}
              className="px-3 py-1 text-sm bg-vscode-button-bg text-vscode-button-fg rounded hover:bg-vscode-button-hover-bg flex items-center"
              disabled={connectionStatus === 'connecting'}
            >
              {connectionStatus === 'connecting' && <Spinner size="sm" className="mr-2" />}
              {connectionStatus === 'connecting' ? 'Connecting...' : 'Reconnect'}
            </button>
          </div>
        )}
      </div>

      {loading && !stats && (
        <div className="py-8 text-center text-vscode-descriptionForeground">
          <Spinner size="lg" className="mx-auto mb-4" />
          <p>Loading metrics...</p>
        </div>
      )}

      {loading && stats && (
        <div className="fixed top-2 right-2 bg-blue-100 dark:bg-blue-900 p-2 rounded-full shadow-md">
          <Spinner size="sm" />
        </div>
      )}

      {error && !stats && (
        <div className="py-8 text-center text-red-500">
          <p>{error}</p>
          <button
            onClick={loadStats}
            className="mt-4 px-3 py-1 text-sm bg-vscode-input-bg text-vscode-input-fg rounded hover:bg-vscode-list-hover-bg"
          >
            Try Again
          </button>
        </div>
      )}

      {stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Summary Stats */}
            <div className="bg-vscode-input-bg text-vscode-input-fg p-4 rounded-lg border border-vscode-panel-border">
              <h4 className="text-sm font-medium mb-3">Summary</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-vscode-descriptionForeground">Total Requests</p>
                  <p className="text-2xl font-semibold">{stats.total}</p>
                </div>
                <div>
                  <p className="text-xs text-vscode-descriptionForeground">Success Rate</p>
                  <p className="text-2xl font-semibold">{stats.successRate.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-xs text-vscode-descriptionForeground">Avg Response Time</p>
                  <p className="text-2xl font-semibold">{formatDuration(stats.avgResponseTime)}</p>
                </div>
                <div>
                  <p className="text-xs text-vscode-descriptionForeground">Last Updated</p>
                  <p className="text-sm">
                    {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Never'}
                  </p>
                </div>
              </div>
            </div>

            {/* Method Distribution */}
            <div className="bg-vscode-input-bg text-vscode-input-fg p-4 rounded-lg border border-vscode-panel-border">
              <h4 className="text-sm font-medium mb-3">Requests by Method</h4>
              {methodChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={methodChartData}
                    margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                    <XAxis dataKey="name" tick={{ fill: '#888' }} />
                    <YAxis tick={{ fill: '#888' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(50, 50, 50, 0.9)',
                        border: 'none',
                        borderRadius: '4px',
                        color: '#fff',
                      }}
                    />
                    <Bar dataKey="value" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-vscode-descriptionForeground">
                  No data available
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Status Code Distribution */}
            <div className="bg-vscode-input-bg text-vscode-input-fg p-4 rounded-lg border border-vscode-panel-border">
              <h4 className="text-sm font-medium mb-3">Status Code Distribution</h4>
              {statusChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={statusChartData}
                    margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                    <XAxis dataKey="name" tick={{ fill: '#888' }} />
                    <YAxis tick={{ fill: '#888' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(50, 50, 50, 0.9)',
                        border: 'none',
                        borderRadius: '4px',
                        color: '#fff',
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
                <div className="h-[200px] flex items-center justify-center text-vscode-descriptionForeground">
                  No data available
                </div>
              )}
            </div>

            {/* Truncation Stats */}
            <div className="bg-vscode-input-bg text-vscode-input-fg p-4 rounded-lg border border-vscode-panel-border">
              <h4 className="text-sm font-medium mb-3">Truncation Statistics</h4>
              {stats.truncated ? (
                <div className="grid grid-cols-2 gap-4 h-[200px]">
                  <div className="flex flex-col items-center justify-center">
                    <p className="text-xs text-vscode-descriptionForeground">
                      Truncated Request Bodies
                    </p>
                    <p className="text-2xl font-semibold">{stats.truncated.bodies}</p>
                    <p className="text-xs text-vscode-descriptionForeground">
                      (
                      {stats.total > 0
                        ? ((stats.truncated.bodies / stats.total) * 100).toFixed(1)
                        : 0}
                      %)
                    </p>
                  </div>
                  <div className="flex flex-col items-center justify-center">
                    <p className="text-xs text-vscode-descriptionForeground">
                      Truncated Response Bodies
                    </p>
                    <p className="text-2xl font-semibold">{stats.truncated.responses}</p>
                    <p className="text-xs text-vscode-descriptionForeground">
                      (
                      {stats.total > 0
                        ? ((stats.truncated.responses / stats.total) * 100).toFixed(1)
                        : 0}
                      %)
                    </p>
                  </div>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-vscode-descriptionForeground">
                  No truncation data available
                </div>
              )}
            </div>
          </div>

          {/* Additional information */}
          <div className="text-xs text-vscode-descriptionForeground mt-4">
            <p>
              Metrics are updated automatically every 10 seconds when the WebSocket connection is
              active.
            </p>
          </div>
        </div>
      )}
    </Card>
  );
};

export default PerformanceMetrics;
