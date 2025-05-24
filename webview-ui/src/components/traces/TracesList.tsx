import React, { useState, useEffect, useRef } from 'react';
import Card from '@/components/ui/Card';
import { TraceData, otelSpanToTraceData } from '@/lib/api/traces';
import { useTraces } from '@/contexts/TracesContext';
import { wsClient } from '@/lib/api/websocket';
import { Spinner } from '@/components/ui/Spinner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import TracingControls from './TracingControls';

const SidebarTracesList: React.FC = () => {
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

  // Local state for trace details view
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'split' | 'details'>('split');
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

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedTrace || !convertedTraces.length) return;

      const currentIndex = convertedTraces.findIndex(t => t.id === selectedTrace);
      if (currentIndex === -1) return;

      if (e.key === 'ArrowDown' || e.key === 'j') {
        // Move to next trace
        if (currentIndex < convertedTraces.length - 1) {
          setSelectedTrace(convertedTraces[currentIndex + 1].id);
        }
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        // Move to previous trace
        if (currentIndex > 0) {
          setSelectedTrace(convertedTraces[currentIndex - 1].id);
        }
      } else if (e.key === 'Escape') {
        // Close details view
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          setSelectedTrace(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTrace, convertedTraces, setSelectedTrace, isFullscreen]);

  // Scroll selected trace into view
  useEffect(() => {
    if (selectedTrace && listRef.current) {
      const selectedElement = listRef.current.querySelector(`[data-trace-id="${selectedTrace}"]`);
      if (selectedElement) {
        selectedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedTrace]);

  // Render loading state
  if (loading && traces.length === 0) {
    return (
      <Card title="Traces">
        <div className="py-4 text-center text-vscode-descriptionForeground">
          <Spinner size="md" className="mx-auto mb-2" />
          <p>Loading traces...</p>
        </div>
      </Card>
    );
  }

  // Render view mode controls component
  const ViewModeControls = () => (
    <div className="flex space-x-1">
      <button
        onClick={() => setViewMode('list')}
        className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${viewMode === 'list' ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
        title="List View"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="8" y1="6" x2="21" y2="6"></line>
          <line x1="8" y1="12" x2="21" y2="12"></line>
          <line x1="8" y1="18" x2="21" y2="18"></line>
          <line x1="3" y1="6" x2="3.01" y2="6"></line>
          <line x1="3" y1="12" x2="3.01" y2="12"></line>
          <line x1="3" y1="18" x2="3.01" y2="18"></line>
        </svg>
      </button>
      <button
        onClick={() => setViewMode('split')}
        className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${viewMode === 'split' ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
        title="Split View"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="12" y1="3" x2="12" y2="21"></line>
        </svg>
      </button>
      <button
        onClick={() => setViewMode('details')}
        className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${viewMode === 'details' ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
        title="Details View"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
      </button>
    </div>
  );

  // Render trace details component
  const TraceDetails = ({ trace }: { trace: TraceData }) => (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-sm font-medium">Trace Details</h4>
        <div className="flex space-x-1">
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path>
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path>
              </svg>
            )}
          </button>
          <button
            onClick={() => setSelectedTrace(null)}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            title="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      <div className="bg-gray-100 dark:bg-gray-800 rounded-md p-2 mb-2">
        <div className="flex items-center justify-between">
          <div className={`font-mono text-xs font-medium ${getMethodColor(trace.method)}`}>
            {trace.method}
          </div>
          <div
            className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(trace.status)}`}
          >
            {trace.status || 'Pending'}
          </div>
        </div>
        <div className="font-mono text-xs truncate mt-1" title={trace.path}>
          {trace.path}
        </div>
        <div className="flex justify-between text-xs mt-1 text-gray-500 dark:text-gray-400">
          <span>{formatDate(trace.startTime)}</span>
          <span>{formatDuration(trace.duration || 0)}</span>
        </div>
      </div>

      <Tabs
        defaultValue="request"
        className="flex-1 overflow-hidden flex flex-col"
        onValueChange={() => {
          // Prevent any state changes when switching tabs
          // This helps prevent unwanted refreshes
        }}
      >
        <TabsList className="w-full justify-start bg-transparent p-0 mb-2">
          <TabsTrigger
            value="request"
            className="text-xs py-1 px-2 data-[state=active]:bg-gray-200 data-[state=active]:dark:bg-gray-700"
          >
            Request
          </TabsTrigger>
          <TabsTrigger
            value="response"
            className="text-xs py-1 px-2 data-[state=active]:bg-gray-200 data-[state=active]:dark:bg-gray-700"
          >
            Response
          </TabsTrigger>
          {trace.llmMetrics && (
            <TabsTrigger
              value="llm"
              className="text-xs py-1 px-2 data-[state=active]:bg-gray-200 data-[state=active]:dark:bg-gray-700"
            >
              LLM
            </TabsTrigger>
          )}
          <TabsTrigger
            value="raw"
            className="text-xs py-1 px-2 data-[state=active]:bg-gray-200 data-[state=active]:dark:bg-gray-700"
          >
            Raw
          </TabsTrigger>
        </TabsList>

        <TabsContent value="request" className="flex-1 overflow-auto m-0">
          <div className="mb-2">
            <h5 className="text-xs font-medium mb-1">Headers</h5>
            <div className="bg-gray-50 dark:bg-gray-900 p-2 rounded text-xs overflow-auto max-h-32">
              {trace.headers && Object.keys(trace.headers).length > 0 ? (
                <table className="w-full text-left">
                  <tbody>
                    {Object.entries(trace.headers).map(([key, value]) => (
                      <tr key={key} className="border-b border-gray-200 dark:border-gray-800">
                        <td className="py-1 pr-2 font-medium">{key}:</td>
                        <td className="py-1 font-mono">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">No headers</p>
              )}
            </div>
          </div>

          <div>
            <h5 className="text-xs font-medium mb-1">Body</h5>
            <pre className="bg-gray-50 dark:bg-gray-900 p-2 rounded text-xs overflow-auto max-h-64 whitespace-pre-wrap break-words">
              {trace.body ? JSON.stringify(trace.body, null, 2) : 'No body'}
            </pre>
            {trace.bodyTruncated && (
              <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                Note: Request body was truncated due to size limits.
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="response" className="flex-1 overflow-auto m-0">
          <div className="mb-2">
            <h5 className="text-xs font-medium mb-1">Status</h5>
            <div
              className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(trace.status)}`}
            >
              {trace.status || 'Pending'}
            </div>
          </div>

          <div>
            <h5 className="text-xs font-medium mb-1">Body</h5>
            <pre className="bg-gray-50 dark:bg-gray-900 p-2 rounded text-xs overflow-auto max-h-64 whitespace-pre-wrap break-words">
              {trace.response ? JSON.stringify(trace.response, null, 2) : 'No response'}
            </pre>
            {trace.responseTruncated && (
              <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                Note: Response body was truncated due to size limits.
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="raw" className="flex-1 overflow-auto m-0">
          <pre className="bg-gray-50 dark:bg-gray-900 p-2 rounded text-xs h-full overflow-auto whitespace-pre-wrap break-words">
            {JSON.stringify(trace, null, 2)}
          </pre>
        </TabsContent>

        {/* LLM Metrics Tab */}
        {trace.llmMetrics && (
          <TabsContent value="llm" className="flex-1 overflow-auto m-0">
            <div className="space-y-3">
              <div>
                <h5 className="text-xs font-medium mb-2">Model Information</h5>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {trace.llmMetrics.model && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Model:</span>
                      <span className="ml-1 font-mono">{trace.llmMetrics.model}</span>
                    </div>
                  )}
                  {trace.llmMetrics.temperature !== undefined && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Temperature:</span>
                      <span className="ml-1 font-mono">{trace.llmMetrics.temperature}</span>
                    </div>
                  )}
                  {trace.llmMetrics.maxTokens && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Max Tokens:</span>
                      <span className="ml-1 font-mono">{trace.llmMetrics.maxTokens}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h5 className="text-xs font-medium mb-2">Token Usage</h5>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {trace.llmMetrics.inputTokens && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Input Tokens:</span>
                      <span className="ml-1 font-mono">{trace.llmMetrics.inputTokens}</span>
                    </div>
                  )}
                  {trace.llmMetrics.outputTokens && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Output Tokens:</span>
                      <span className="ml-1 font-mono">{trace.llmMetrics.outputTokens}</span>
                    </div>
                  )}
                  {trace.llmMetrics.totalTokens && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Total Tokens:</span>
                      <span className="ml-1 font-mono font-semibold">{trace.llmMetrics.totalTokens}</span>
                    </div>
                  )}
                  {trace.llmMetrics.cost && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Estimated Cost:</span>
                      <span className="ml-1 font-mono font-semibold text-green-600 dark:text-green-400">
                        ${trace.llmMetrics.cost.toFixed(4)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {(trace.llmMetrics.promptLength || trace.llmMetrics.responseLength) && (
                <div>
                  <h5 className="text-xs font-medium mb-2">Content Length</h5>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {trace.llmMetrics.promptLength && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Prompt Length:</span>
                        <span className="ml-1 font-mono">{trace.llmMetrics.promptLength} chars</span>
                      </div>
                    )}
                    {trace.llmMetrics.responseLength && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Response Length:</span>
                        <span className="ml-1 font-mono">{trace.llmMetrics.responseLength} chars</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );

  // Main component render
  return (
    <Card title="Traces" className="h-full flex flex-col">
      <Tabs defaultValue="traces" className="h-full flex flex-col">
        <TabsList className="w-full justify-start bg-transparent p-0 mb-2">
          <TabsTrigger
            value="traces"
            className="text-sm py-2 px-3 data-[state=active]:bg-gray-200 data-[state=active]:dark:bg-gray-700"
          >
            Traces
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="text-sm py-2 px-3 data-[state=active]:bg-gray-200 data-[state=active]:dark:bg-gray-700"
          >
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="traces" className="flex-1 flex flex-col m-0">
          <TracesContent />
        </TabsContent>

        <TabsContent value="settings" className="flex-1 overflow-auto m-0">
          <TracingControls />
        </TabsContent>
      </Tabs>
    </Card>
  );

  // Traces content component
  function TracesContent() {
    return (
      <>
        <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
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
        <div className="flex items-center space-x-1">
          {/* View mode controls */}
          <ViewModeControls />

          {/* Action buttons */}
          <div className="flex space-x-1 ml-2">
            <button
              onClick={() => {
                // If a trace is selected, only refresh if we're in list view
                if (selectedTrace && viewMode !== 'list') {
                  // Don't refresh when viewing a trace detail to avoid disruption
                  return;
                }
                loadTraces();
              }}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
              title="Refresh"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M23 4v6h-6"></path>
                <path d="M1 20v-6h6"></path>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"></path>
                <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"></path>
              </svg>
            </button>
            <button
              onClick={handleClearTraces}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
              title="Clear Traces"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 6h18"></path>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>
            {connectionStatus !== 'connected' && (
              <button
                onClick={() => wsClient.connect()}
                className="p-1 rounded hover:bg-vscode-list-hover-bg bg-vscode-button-bg text-vscode-button-fg"
                title="Reconnect"
                disabled={connectionStatus === 'connecting'}
              >
                {connectionStatus === 'connecting' ? (
                  <Spinner size="sm" />
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14"></path>
                    <path d="M12 5v14"></path>
                  </svg>
                )}
              </button>
            )}
          </div>
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

      {/* Main content area with responsive layout based on view mode */}
      <div
        className={`${isFullscreen && selectedTrace ? 'hidden' : 'flex-1 flex'} ${viewMode === 'list' ? 'flex-col' : viewMode === 'split' ? 'flex-row' : 'flex-col'}`}
      >
        {/* List view (always visible in list mode, left side in split mode, hidden in details mode) */}
        <div
          className={`
            ${viewMode === 'list' ? 'flex-1' : ''}
            ${viewMode === 'split' ? 'w-1/2 pr-2' : ''}
            ${viewMode === 'details' && selectedTrace ? 'hidden' : 'flex flex-col'}
          `}
        >
          <div ref={listRef} className="overflow-auto flex-1">
            {traces.length === 0 ? (
              <div className="py-4 text-center text-gray-500 dark:text-gray-400">
                No traces recorded yet.
              </div>
            ) : (
              <div className="space-y-1">
                {convertedTraces.map(trace => (
                  <div
                    key={trace.id}
                    data-trace-id={trace.id}
                    className={`p-1 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
                      selectedTrace === trace.id
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500'
                        : ''
                    }`}
                    onClick={() => setSelectedTrace(selectedTrace === trace.id ? null : trace.id)}
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
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>{formatDate(trace.startTime)}</span>
                      <span>{formatDuration(trace.duration || 0)}</span>
                    </div>
                    {/* LLM metrics display */}
                    {trace.llmMetrics && (
                      <div className="mt-1 flex flex-wrap gap-1 text-xs">
                        {trace.llmMetrics.model && (
                          <span className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                            {trace.llmMetrics.model}
                          </span>
                        )}
                        {trace.llmMetrics.totalTokens && (
                          <span className="px-1 py-0.5 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">
                            {trace.llmMetrics.totalTokens} tokens
                          </span>
                        )}
                        {trace.llmMetrics.cost && (
                          <span className="px-1 py-0.5 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded">
                            ${trace.llmMetrics.cost.toFixed(4)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Details view (right side in split mode, full in details mode, hidden in list mode) */}
        {selectedTrace && (
          <div
            className={`
              ${viewMode === 'list' ? 'hidden' : ''}
              ${viewMode === 'split' ? 'w-1/2 pl-2 border-l border-gray-200 dark:border-gray-700' : ''}
              ${viewMode === 'details' ? 'flex-1' : ''}
              ${isFullscreen ? 'fixed inset-0 z-50 bg-white dark:bg-gray-900 p-4' : ''}
            `}
          >
            <TraceDetails trace={selectedTraceData!} />
          </div>
        )}
      </div>
      </>
    );
  }
};

export default SidebarTracesList;
