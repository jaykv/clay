import React, { useState, useEffect, useRef } from 'react';
import { otelSpanToTraceData } from '@/lib/api/traces';
import { useTraces } from '@/contexts/TracesContext';
import { wsClient } from '@/lib/api/websocket';
import { Spinner } from '@/components/ui/Spinner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Input } from '@/components/ui/Input';

const TracesSidebarView: React.FC = () => {
  // Use the shared traces context
  const {
    traces,
    pagination,
    loading,
    connectionStatus,
    selectedTrace,
    setSelectedTrace,
    loadTraces,
    handleClearTraces,
  } = useTraces();

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'list' | 'details'>('list');
  const listRef = useRef<HTMLDivElement>(null);

  // Convert OtelSpan to TraceData for display
  const convertedTraces = traces.map(otelSpanToTraceData);

  // Get the selected trace data
  const selectedTraceData = selectedTrace
    ? convertedTraces.find(t => t.id === selectedTrace)
    : null;

  // Format date for display
  const formatDate = (date: Date | number) => {
    if (date instanceof Date) {
      return date.toLocaleTimeString();
    }
    return new Date(date).toLocaleTimeString();
  };

  // Format duration for display
  const formatDuration = (duration: number) => {
    if (duration < 1) {
      return '<1ms';
    }
    if (duration < 1000) {
      return `${Math.round(duration)}ms`;
    }
    return `${(duration / 1000).toFixed(2)}s`;
  };

  // Get color based on HTTP status code
  const getStatusColor = (status?: number) => {
    if (!status) return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    if (status < 300) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    if (status < 400) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    if (status < 500)
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
  };

  // Get method color
  const getMethodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET':
        return 'text-green-600 dark:text-green-400';
      case 'POST':
        return 'text-blue-600 dark:text-blue-400';
      case 'PUT':
        return 'text-amber-600 dark:text-amber-400';
      case 'DELETE':
        return 'text-red-600 dark:text-red-400';
      case 'PATCH':
        return 'text-purple-600 dark:text-purple-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  // Filter traces based on search query
  const getFilteredTraces = () => {
    if (!searchQuery) {
      return convertedTraces;
    }

    const lowerQuery = searchQuery.toLowerCase();
    return convertedTraces.filter(
      trace =>
        trace.path.toLowerCase().includes(lowerQuery) ||
        trace.method.toLowerCase().includes(lowerQuery) ||
        (trace.status?.toString() || '').includes(lowerQuery)
    );
  };

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
  };

  // Effect to handle trace selection
  useEffect(() => {
    if (selectedTrace) {
      setActiveTab('details');
    }
  }, [selectedTrace]);

  // Effect to scroll selected trace into view
  useEffect(() => {
    if (selectedTrace && listRef.current && activeTab === 'list') {
      const selectedElement = listRef.current.querySelector(`[data-trace-id="${selectedTrace}"]`);
      if (selectedElement) {
        selectedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedTrace, activeTab]);

  // Render loading state
  if (loading && traces.length === 0) {
    return (
      <div className="flex flex-col h-full overflow-auto p-2">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-medium">Traces</h2>
        </div>
        <div className="py-4 text-center text-vscode-descriptionForeground">
          <Spinner size="md" className="mx-auto mb-2" />
          <p className="text-sm">Loading traces...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-auto p-2">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium">Traces</h2>
          <div
            className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected'
                ? 'bg-green-500'
                : connectionStatus === 'connecting'
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
            }`}
          ></div>
          <span className="text-xs text-vscode-descriptionForeground">{connectionStatus}</span>
        </div>
        <div className="flex space-x-1">
          {selectedTrace && (
            <button
              onClick={() => {
                setSelectedTrace(null);
                setActiveTab('list');
              }}
              className="p-1.5 text-xs bg-vscode-input-bg text-vscode-input-fg rounded hover:bg-vscode-list-hover-bg flex items-center"
              title="Back to List"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
            </button>
          )}
          <button
            onClick={() => loadTraces()}
            className="p-1.5 text-xs bg-vscode-input-bg text-vscode-input-fg rounded hover:bg-vscode-list-hover-bg flex items-center"
            title="Refresh Traces"
          >
            {loading ? (
              <Spinner size="sm" />
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            )}
          </button>
          <button
            onClick={handleClearTraces}
            className="p-1.5 text-xs bg-vscode-input-bg text-vscode-input-fg rounded hover:bg-vscode-list-hover-bg flex items-center"
            title="Clear Traces"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
          {connectionStatus !== 'connected' && (
            <button
              onClick={() => wsClient.connect()}
              className="p-1.5 text-xs bg-vscode-button-bg text-vscode-button-fg rounded hover:bg-vscode-button-hover-bg flex items-center"
              title="Reconnect"
              disabled={connectionStatus === 'connecting'}
            >
              {connectionStatus === 'connecting' ? (
                <Spinner size="sm" />
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
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
              )}
            </button>
          )}
        </div>
      </div>

      {/* WebSocket connection status and reconnect button */}
      {connectionStatus !== 'connected' && (
        <div className="bg-vscode-button-bg bg-opacity-10 border border-vscode-button-bg rounded-md p-2 mb-3 flex items-center justify-between">
          <div className="flex items-center">
            <svg
              className="h-4 w-4 text-vscode-button-bg mr-2"
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
            <span className="text-xs text-vscode-button-bg">
              {connectionStatus === 'connecting'
                ? 'Connecting to server...'
                : 'WebSocket disconnected. Data may be stale.'}
            </span>
          </div>
          <button
            onClick={() => wsClient.connect()}
            className="px-2 py-1 text-xs bg-vscode-button-bg text-vscode-button-fg rounded hover:bg-vscode-button-hover-bg"
            disabled={connectionStatus === 'connecting'}
          >
            {connectionStatus === 'connecting' ? (
              <span className="flex items-center">
                <Spinner size="sm" className="mr-1" />
                Connecting...
              </span>
            ) : (
              'Reconnect'
            )}
          </button>
        </div>
      )}

      {pagination.total > 0 && (
        <div className="mb-2 text-xs text-vscode-descriptionForeground">
          Showing {traces.length} of {pagination.total} traces
        </div>
      )}

      {/* Main content area with tabs for list and details */}
      <div className="flex-1 flex flex-col">
        {!selectedTrace ? (
          <>
            {/* Search Bar */}
            <div className="relative mb-3">
              <Input
                type="text"
                placeholder="Search traces..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full text-sm"
                leftIcon={
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                }
                rightIcon={
                  searchQuery ? (
                    <button onClick={clearSearch} className="text-gray-400 hover:text-gray-600">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  ) : undefined
                }
              />
            </div>

            {/* Traces List */}
            <div ref={listRef} className="overflow-auto flex-1">
              {getFilteredTraces().length === 0 ? (
                <div className="py-4 text-center text-vscode-descriptionForeground">
                  {searchQuery
                    ? `No traces found matching "${searchQuery}"`
                    : 'No traces recorded yet.'}
                </div>
              ) : (
                <div className="space-y-2">
                  {getFilteredTraces().map(trace => (
                    <div
                      key={trace.id}
                      data-trace-id={trace.id}
                      className="p-2 bg-vscode-input-bg text-vscode-input-fg rounded-md cursor-pointer hover:bg-vscode-list-hover-bg border border-vscode-panel-border"
                      onClick={() => setSelectedTrace(trace.id)}
                    >
                      <div className="flex justify-between items-center">
                        <div
                          className={`font-mono text-xs font-medium ${getMethodColor(trace.method)}`}
                        >
                          {trace.method}
                        </div>
                        <div
                          className={`px-1 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(trace.status)}`}
                        >
                          {trace.status || 'Pending'}
                        </div>
                      </div>
                      <div className="font-mono text-xs truncate" title={trace.path}>
                        {trace.path}
                      </div>
                      <div className="flex justify-between text-xs text-vscode-descriptionForeground">
                        <span>{formatDate(trace.startTime)}</span>
                        <span>{formatDuration(trace.duration || 0)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          // Trace Details View
          <div className="flex-1 flex flex-col">
            <div className="bg-vscode-input-bg text-vscode-input-fg rounded-md p-2 mb-3 border border-vscode-panel-border">
              <div className="flex items-center justify-between">
                <div
                  className={`font-mono text-xs font-medium ${getMethodColor(selectedTraceData!.method)}`}
                >
                  {selectedTraceData!.method}
                </div>
                <div
                  className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(selectedTraceData!.status)}`}
                >
                  {selectedTraceData!.status || 'Pending'}
                </div>
              </div>
              <div className="font-mono text-xs truncate mt-1" title={selectedTraceData!.path}>
                {selectedTraceData!.path}
              </div>
              <div className="flex justify-between text-xs mt-1 text-vscode-descriptionForeground">
                <span>{formatDate(selectedTraceData!.startTime)}</span>
                <span>{formatDuration(selectedTraceData!.duration || 0)}</span>
              </div>
            </div>

            <Tabs defaultValue="request" className="flex-1 overflow-hidden flex flex-col">
              <TabsList className="w-full justify-start bg-transparent p-0 mb-2">
                <TabsTrigger
                  value="request"
                  className="text-xs py-1 px-2 data-[state=active]:bg-vscode-input-bg data-[state=active]:text-vscode-input-fg"
                >
                  Request
                </TabsTrigger>
                <TabsTrigger
                  value="response"
                  className="text-xs py-1 px-2 data-[state=active]:bg-vscode-input-bg data-[state=active]:text-vscode-input-fg"
                >
                  Response
                </TabsTrigger>
                <TabsTrigger
                  value="raw"
                  className="text-xs py-1 px-2 data-[state=active]:bg-vscode-input-bg data-[state=active]:text-vscode-input-fg"
                >
                  Raw
                </TabsTrigger>
              </TabsList>

              <TabsContent value="request" className="flex-1 overflow-auto m-0">
                <div className="mb-2">
                  <h5 className="text-xs font-medium mb-1">Headers</h5>
                  <div className="bg-vscode-input-bg p-2 rounded text-xs overflow-auto max-h-32 border border-vscode-panel-border">
                    {selectedTraceData!.headers &&
                    Object.keys(selectedTraceData!.headers).length > 0 ? (
                      <table className="w-full text-left">
                        <tbody>
                          {Object.entries(selectedTraceData!.headers).map(([key, value]) => (
                            <tr key={key} className="border-b border-gray-200 dark:border-gray-800">
                              <td className="py-1 pr-2 font-medium">{key}:</td>
                              <td className="py-1 font-mono">{value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="text-vscode-descriptionForeground">No headers</p>
                    )}
                  </div>
                </div>

                <div>
                  <h5 className="text-xs font-medium mb-1">Body</h5>
                  <pre className="bg-vscode-input-bg p-2 rounded text-xs overflow-auto max-h-64 whitespace-pre-wrap break-words border border-vscode-panel-border">
                    {selectedTraceData!.body
                      ? JSON.stringify(selectedTraceData!.body, null, 2)
                      : 'No body'}
                  </pre>
                  {selectedTraceData!.bodyTruncated && (
                    <div className="mt-1 text-xs text-vscode-editorWarning-foreground">
                      Note: Request body was truncated due to size limits.
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="response" className="flex-1 overflow-auto m-0">
                <div className="mb-2">
                  <h5 className="text-xs font-medium mb-1">Status</h5>
                  <div
                    className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(selectedTraceData!.status)}`}
                  >
                    {selectedTraceData!.status || 'Pending'}
                  </div>
                </div>

                <div>
                  <h5 className="text-xs font-medium mb-1">Body</h5>
                  <pre className="bg-vscode-input-bg p-2 rounded text-xs overflow-auto max-h-64 whitespace-pre-wrap break-words border border-vscode-panel-border">
                    {selectedTraceData!.response
                      ? JSON.stringify(selectedTraceData!.response, null, 2)
                      : 'No response'}
                  </pre>
                  {selectedTraceData!.responseTruncated && (
                    <div className="mt-1 text-xs text-vscode-editorWarning-foreground">
                      Note: Response body was truncated due to size limits.
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="raw" className="flex-1 overflow-auto m-0">
                <pre className="bg-vscode-input-bg p-2 rounded text-xs h-full overflow-auto whitespace-pre-wrap break-words border border-vscode-panel-border">
                  {JSON.stringify(selectedTraceData, null, 2)}
                </pre>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
};

export default TracesSidebarView;
