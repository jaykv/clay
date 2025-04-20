import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { postMessage } from '@/utils/vscode';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';

// Interfaces for MCP data
interface MCPResourceInfo {
  id: string;
  template: string;
}

interface MCPToolInfo {
  id: string;
  parameters: Record<string, any>;
  description?: string;
}

interface MCPPromptInfo {
  id: string;
  parameters: Record<string, any>;
}

interface MCPServerInfo {
  name: string;
  version: string;
  resources: MCPResourceInfo[];
  tools: MCPToolInfo[];
  prompts: MCPPromptInfo[];
}

// Main component
const MCPSidebarView: React.FC = () => {
  // State
  const [serverInfo, setServerInfo] = useState<MCPServerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'tools' | 'prompts' | 'resources'>('tools');
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Check if server is running and fetch data on mount
  useEffect(() => {
    checkServerStatus();
    const interval = setInterval(checkServerStatus, 10000); // Check every 10 seconds

    // Focus search input on mount
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }

    return () => clearInterval(interval);
  }, []);

  // Check if MCP server is running
  const checkServerStatus = async () => {
    try {
      const response = await fetch('http://localhost:3001/health', {
        signal: AbortSignal.timeout(2000), // 2 second timeout
      });

      const isRunning = response.ok;
      setIsRunning(isRunning);

      if (isRunning && (!serverInfo || !loading)) {
        fetchMCPServerInfo();
      }
    } catch (err) {
      setIsRunning(false);
      if (loading) {
        setLoading(false);
      }
    }
  };

  // Fetch MCP server info
  const fetchMCPServerInfo = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:3001/info');

      if (!response.ok) {
        throw new Error(`Failed to fetch MCP server info: ${response.statusText}`);
      }

      const data = await response.json();
      setServerInfo(data);
    } catch (err) {
      console.error('Error fetching MCP server info:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Start MCP server
  const startMCPServer = () => {
    postMessage({ command: 'startMCPServer' });
    setLoading(true);
  };

  // Filter items based on search query
  const getFilteredItems = () => {
    if (!serverInfo) {
      return [];
    }

    const items =
      activeTab === 'tools'
        ? serverInfo.tools
        : activeTab === 'prompts'
          ? serverInfo.prompts
          : serverInfo.resources;

    if (!searchQuery) {
      return items;
    }

    const lowerQuery = searchQuery.toLowerCase();
    return items.filter(
      item =>
        item.id.toLowerCase().includes(lowerQuery) ||
        ('description' in item &&
          typeof item.description === 'string' &&
          item.description.toLowerCase().includes(lowerQuery))
    );
  };

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setSelectedItem(null); // Clear selection when search changes
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  // Render parameter details
  const renderParameters = (params: Record<string, any>) => {
    return (
      <div className="mt-2 space-y-1 text-xs">
        {Object.entries(params).map(([name, type]) => (
          <div key={name} className="flex items-start">
            <span className="font-mono text-blue-600 dark:text-blue-400 mr-2">{name}:</span>
            <span className="text-gray-600 dark:text-gray-400 break-all">
              {typeof type === 'object' ? JSON.stringify(type) : type.toString()}
            </span>
          </div>
        ))}
      </div>
    );
  };

  // Render item details
  const renderItemDetails = () => {
    if (!selectedItem || !serverInfo) {
      return null;
    }

    let item: MCPToolInfo | MCPPromptInfo | MCPResourceInfo | undefined;

    if (activeTab === 'tools') {
      item = serverInfo.tools.find(t => t.id === selectedItem);
    } else if (activeTab === 'prompts') {
      item = serverInfo.prompts.find(p => p.id === selectedItem);
    } else {
      item = serverInfo.resources.find(r => r.id === selectedItem);
    }

    if (!item) {
      return null;
    }

    return (
      <div className="p-3 bg-vscode-input-bg text-vscode-input-fg rounded-md mt-2 border border-vscode-panel-border">
        <div className="flex justify-between items-start">
          <h3 className="font-medium text-sm">{item.id}</h3>
          <button
            className="text-xs text-vscode-link-fg hover:text-vscode-link-active-fg hover:underline"
            onClick={() => setSelectedItem(null)}
          >
            Close
          </button>
        </div>

        {'description' in item && item.description && (
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{item.description}</p>
        )}

        {'parameters' in item && (
          <div className="mt-3">
            <h4 className="text-xs font-medium mb-1">Parameters:</h4>
            {renderParameters(item.parameters)}
          </div>
        )}

        {'template' in item && (
          <div className="mt-3">
            <h4 className="text-xs font-medium mb-1">Template:</h4>
            <div className="text-xs font-mono bg-gray-100 dark:bg-gray-900 p-2 rounded overflow-x-auto">
              {item.template}
            </div>
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <button
            className="text-xs px-2 py-1 bg-vscode-button-bg bg-opacity-20 text-vscode-button-fg rounded hover:bg-opacity-30"
            onClick={() => {
              navigator.clipboard.writeText(item.id);
              // Show toast or feedback here
            }}
          >
            Copy ID
          </button>

          {activeTab !== 'resources' && (
            <button
              className="text-xs px-2 py-1 bg-vscode-button-bg bg-opacity-20 text-vscode-button-fg rounded hover:bg-opacity-30"
              onClick={() => {
                // Find definition in code
                // First show a message to the user
                alert(`Searching for "${item.id}" in codebase`);
                // Then execute the search command
                postMessage({ command: 'clay.searchCodebase' });
              }}
            >
              Find in Code
            </button>
          )}
        </div>
      </div>
    );
  };

  // Render server status
  const renderServerStatus = () => {
    if (loading && !serverInfo) {
      return (
        <div className="flex items-center justify-center py-4">
          <Spinner size="md" className="mr-2" />
          <span className="text-sm">Connecting to MCP server...</span>
        </div>
      );
    }

    if (!isRunning) {
      return (
        <div className="p-4 text-center">
          <div className="text-amber-600 dark:text-amber-400 mb-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8 mx-auto mb-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <p className="text-sm font-medium">MCP Server is not running</p>
          </div>
          <button
            onClick={startMCPServer}
            className="px-3 py-1.5 text-sm bg-vscode-button-bg text-vscode-button-fg rounded hover:bg-vscode-button-hover-bg transition-colors"
          >
            Start MCP Server
          </button>
        </div>
      );
    }

    if (error) {
      return (
        <div className="p-4 text-center text-red-500">
          <p className="text-sm mb-2">{error}</p>
          <button
            onClick={fetchMCPServerInfo}
            className="px-3 py-1 text-sm bg-vscode-input-bg text-vscode-input-fg rounded hover:bg-vscode-list-hover-bg"
          >
            Try Again
          </button>
        </div>
      );
    }

    return null;
  };

  // Main render
  return (
    <div className="flex flex-col h-full overflow-hidden p-2">
      {/* Header with server info */}
      {serverInfo && !loading && isRunning && (
        <div className="flex justify-between items-center mb-3">
          <div>
            <div className="flex items-center">
              <h3 className="text-sm font-medium">{serverInfo.name}</h3>
              <Badge variant="outline" className="ml-2 text-xs">
                v{serverInfo.version}
              </Badge>
            </div>
            <div className="flex text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              <span className="mr-2">{serverInfo.tools.length} tools</span>
              <span className="mr-2">{serverInfo.prompts.length} prompts</span>
              <span>{serverInfo.resources.length} resources</span>
            </div>
          </div>
          <button
            onClick={fetchMCPServerInfo}
            className="p-1.5 text-xs bg-vscode-input-bg text-vscode-input-fg rounded hover:bg-vscode-list-hover-bg flex items-center"
            title="Refresh"
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
        </div>
      )}

      {/* Server status message */}
      {renderServerStatus()}

      {/* Main content when server is running */}
      {serverInfo && !loading && isRunning && (
        <>
          {/* Search bar */}
          <div className="relative mb-3 mcp-search">
            <Input
              ref={searchInputRef}
              type="text"
              placeholder={`Search ${activeTab}...`}
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

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={value => setActiveTab(value as any)}
            className="flex-1 flex flex-col overflow-hidden mcp-tabs"
          >
            <TabsList className="w-full justify-start bg-transparent p-0 mb-2">
              <TabsTrigger
                value="tools"
                className="text-xs py-1 px-2 data-[state=active]:bg-vscode-input-bg data-[state=active]:text-vscode-input-fg"
                onClick={() => setSelectedItem(null)}
              >
                Tools
              </TabsTrigger>
              <TabsTrigger
                value="prompts"
                className="text-xs py-1 px-2 data-[state=active]:bg-vscode-input-bg data-[state=active]:text-vscode-input-fg"
                onClick={() => setSelectedItem(null)}
              >
                Prompts
              </TabsTrigger>
              <TabsTrigger
                value="resources"
                className="text-xs py-1 px-2 data-[state=active]:bg-vscode-input-bg data-[state=active]:text-vscode-input-fg"
                onClick={() => setSelectedItem(null)}
              >
                Resources
              </TabsTrigger>
            </TabsList>

            {/* Tab content */}
            <div className="flex-1 overflow-auto">
              {/* Selected item details */}
              {selectedItem && renderItemDetails()}

              {/* Items list */}
              {!selectedItem && (
                <div className="space-y-1">
                  {getFilteredItems().length === 0 ? (
                    <div className="text-center py-4 text-vscode-descriptionForeground text-sm">
                      {searchQuery
                        ? `No ${activeTab} found matching "${searchQuery}"`
                        : `No ${activeTab} available`}
                    </div>
                  ) : (
                    getFilteredItems().map(item => (
                      <div
                        key={item.id}
                        className="p-2 rounded cursor-pointer hover:bg-vscode-list-hover-bg text-sm mcp-item"
                        onClick={() => setSelectedItem(item.id)}
                      >
                        <div className="font-medium truncate">{item.id}</div>
                        {'description' in item && typeof item.description === 'string' && (
                          <div className="text-xs text-vscode-descriptionForeground truncate">
                            {String(item.description)}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </Tabs>
        </>
      )}
    </div>
  );
};

export default MCPSidebarView;
