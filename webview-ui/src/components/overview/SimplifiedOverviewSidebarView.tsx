import React, { useState, useEffect } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { postMessage } from '@/utils/vscode';
import { checkServerHealth } from '@/lib/api/servers';

interface ServerInfo {
  name: string;
  description: string;
  isRunning: boolean;
  port: number;
  startCommand: string;
  stopCommand: string;
  adminStopUrl: string;
}

const SimplifiedOverviewSidebarView: React.FC = () => {
  // Server states
  const [gatewayServerRunning, setGatewayServerRunning] = useState(false);
  const [mcpServerRunning, setMcpServerRunning] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  
  // Define server configurations
  const servers: ServerInfo[] = [
    {
      name: 'Gateway Server',
      description: 'Main server that handles gateway, proxy, and MCP functionality',
      isRunning: gatewayServerRunning,
      port: 3000,
      startCommand: 'startGatewayServer',
      stopCommand: 'stopGatewayServer',
      adminStopUrl: 'http://localhost:3000/admin/stopServer',
    },
    {
      name: 'MCP Server',
      description: 'Model Context Protocol server for AI/LLM tools',
      isRunning: mcpServerRunning,
      port: 3001,
      startCommand: 'startMCPServer',
      stopCommand: 'stopMCPServer',
      adminStopUrl: 'http://localhost:3001/admin/stopServer',
    }
  ];

  // Function to check gateway server health
  const checkGatewayServerHealth = async () => {
    try {
      const isRunning = await checkServerHealth('http://localhost:3000/health');
      setGatewayServerRunning(isRunning);
    } catch (error) {
      console.error('Error checking Gateway server health:', error);
      setGatewayServerRunning(false);
    }
  };

  // Function to check MCP server health
  const checkMcpServerHealth = async () => {
    try {
      const isRunning = await checkServerHealth('http://localhost:3001/health');
      setMcpServerRunning(isRunning);
    } catch (error) {
      console.error('Error checking MCP server health:', error);
      setMcpServerRunning(false);
    }
  };

  // Check server status on mount and set up interval
  useEffect(() => {
    const checkAllServers = async () => {
      setCheckingStatus(true);
      await Promise.all([checkGatewayServerHealth(), checkMcpServerHealth()]);
      setCheckingStatus(false);
    };

    // Initial check
    checkAllServers();

    // Set up interval for regular checks
    const interval = setInterval(checkAllServers, 10000);

    // Listen for server status updates from extension
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === 'serverStatus') {
        if (message.server === 'gateway') {
          setGatewayServerRunning(message.status === 'running');
        } else if (message.server === 'mcp') {
          setMcpServerRunning(message.status === 'running');
        }
      }
    };

    window.addEventListener('message', messageHandler);

    // Request initial server status
    postMessage({ command: 'getServerStatus' });

    // Clean up
    return () => {
      clearInterval(interval);
      window.removeEventListener('message', messageHandler);
    };
  }, []);

  // Handle server start
  const handleStartServer = (server: ServerInfo) => {
    postMessage({ command: server.startCommand });
    
    // Optimistic update
    if (server.name === 'Gateway Server') {
      setGatewayServerRunning(true);
    } else if (server.name === 'MCP Server') {
      setMcpServerRunning(true);
    }
  };

  // Handle server stop
  const handleStopServer = async (server: ServerInfo) => {
    try {
      // Import the stopServer function dynamically
      const { stopServer } = await import('@/lib/api/servers');
      const success = await stopServer(server.adminStopUrl);

      if (success) {
        console.log(`Server ${server.name} is stopping via admin endpoint`);
        
        // Wait a short time before checking health
        setTimeout(() => {
          if (server.name === 'Gateway Server') {
            checkGatewayServerHealth();
          } else if (server.name === 'MCP Server') {
            checkMcpServerHealth();
          }
        }, 300);
        
        return;
      }
    } catch (error) {
      console.error(`Error stopping server ${server.name} via admin endpoint:`, error);
    }
    
    // Fall back to VS Code command
    postMessage({ command: server.stopCommand });
  };

  // Navigate to a specific tab
  const navigateToTab = (tab: string) => {
    postMessage({ command: 'switchTab', tab });
  };

  // Render server status badge
  const renderStatusBadge = (isRunning: boolean) => (
    <Badge 
      variant={isRunning ? 'success' : 'secondary'} 
      className="ml-2 text-xs"
    >
      {isRunning ? 'Running' : 'Stopped'}
    </Badge>
  );

  // Render server controls
  const renderServerControls = (server: ServerInfo) => (
    <div className="flex items-center mt-2">
      {server.isRunning ? (
        <button
          onClick={() => handleStopServer(server)}
          className="px-2 py-1 text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
        >
          Stop Server
        </button>
      ) : (
        <button
          onClick={() => handleStartServer(server)}
          className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
        >
          Start Server
        </button>
      )}
      
      {server.name === 'MCP Server' && server.isRunning && (
        <button
          onClick={() => navigateToTab('mcp')}
          className="ml-2 px-2 py-1 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-800 transition-colors"
        >
          View MCP Details
        </button>
      )}
    </div>
  );

  // Main render
  return (
    <div className="flex flex-col h-full overflow-auto p-2">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-sm font-medium">Clay Dashboard</h2>
        <button
          onClick={() => {
            checkGatewayServerHealth();
            checkMcpServerHealth();
          }}
          className="p-1.5 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center"
          title="Refresh Status"
        >
          {checkingStatus ? (
            <Spinner size="sm" />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
        </button>
      </div>
      
      {/* Server Status Section */}
      <div className="mb-4">
        <div className="flex items-center mb-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
          </svg>
          <h3 className="text-sm font-medium">Servers</h3>
        </div>
        
        <div className="space-y-3">
          {servers.map((server) => (
            <div key={server.name} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-md">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">{server.name}</h4>
                {renderStatusBadge(server.isRunning)}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {server.description}
              </p>
              {server.isRunning && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Port: <span className="font-mono">{server.port}</span>
                </p>
              )}
              {renderServerControls(server)}
            </div>
          ))}
          
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center">
            <span className="mr-1">Last checked:</span>
            <span>{checkingStatus ? 'Checking...' : 'Just now'}</span>
          </div>
        </div>
      </div>
      
      {/* Quick Actions Section */}
      <div className="mb-4">
        <div className="flex items-center mb-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <h3 className="text-sm font-medium">Quick Actions</h3>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => navigateToTab('routes')}
            className="p-2 text-xs bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex flex-col items-center quick-action"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            Proxy Routes
          </button>
          
          <button
            onClick={() => navigateToTab('augment')}
            className="p-2 text-xs bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex flex-col items-center quick-action"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            Augment Engine
          </button>
          
          <button
            onClick={() => navigateToTab('traces')}
            className="p-2 text-xs bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex flex-col items-center quick-action"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17l4-4m0 0l4-4m-4 4H3m14 4h2a2 2 0 002-2V5a2 2 0 00-2-2h-2" />
            </svg>
            Traces
          </button>
          
          <button
            onClick={() => navigateToTab('metrics')}
            className="p-2 text-xs bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex flex-col items-center quick-action"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Metrics
          </button>
        </div>
      </div>
      
      {/* Features Section */}
      <div className="mb-4">
        <div className="flex items-center mb-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-sm font-medium">Features</h3>
        </div>
        
        <div className="space-y-2">
          <div 
            className="p-2 bg-gray-100 dark:bg-gray-800 rounded-md cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700"
            onClick={() => navigateToTab('routes')}
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Proxy Routes</h4>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Configure custom proxy routes to forward requests
            </p>
          </div>
          
          <div 
            className="p-2 bg-gray-100 dark:bg-gray-800 rounded-md cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700"
            onClick={() => navigateToTab('augment')}
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Augment Engine</h4>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Search and navigate your codebase with AI assistance
            </p>
          </div>
          
          <div 
            className="p-2 bg-gray-100 dark:bg-gray-800 rounded-md cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700"
            onClick={() => navigateToTab('traces')}
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Traces</h4>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Monitor and debug API requests and responses
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimplifiedOverviewSidebarView;
