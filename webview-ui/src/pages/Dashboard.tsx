import React, { useState, useEffect } from 'react';
import { useTab } from '@/contexts/TabContext';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import ServerStatus from '@/components/servers/ServerStatus';
import { PerformanceMetrics, MetricsSidebarView } from '@/components/metrics';
import { TracesList, TracesSidebarView } from '@/components/traces';
import ProxyRoutes from './ProxyRoutes';
import { AugmentContextEngine, AugmentSidebarView } from '@/components/augment';
import { MCPServerDetails, MCPSidebarView } from '@/components/mcp';
import { OverviewSidebarView } from '@/components/overview';
import { ProxyRoutesSidebarView } from '@/components/routes';
import { postMessage } from '@/utils/vscode';
import { checkServerHealth } from '@/lib/api/servers';

interface DashboardProps {
  initialTab?: string;
  isSidebar?: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ isSidebar = false }) => {
  // Get tab state from context
  const { activeTab, setActiveTab } = useTab();

  // Server states
  const [gatewayServerRunning, setGatewayServerRunning] = useState(false);
  const [mcpServerRunning, setMcpServerRunning] = useState(false);

  // Function to check gateway server health immediately
  const checkGatewayServerHealth = async () => {
    try {
      const isRunning = await checkServerHealth('http://localhost:3000/health');
      setGatewayServerRunning(isRunning);
    } catch (error) {
      console.error('Error checking Gateway server health:', error);
    }
  };

  // Function to check MCP server health immediately
  const checkMcpServerHealth = async () => {
    try {
      const isRunning = await checkServerHealth('http://localhost:3001/health');
      setMcpServerRunning(isRunning);
    } catch (error) {
      console.error('Error checking MCP server health:', error);
    }
  };

  // Check if we're running in browser or VS Code
  const [isVSCodeEnv, setIsVSCodeEnv] = useState(false);

  // Listen for messages from the extension
  useEffect(() => {
    // Determine if we're in VS Code or browser
    setIsVSCodeEnv(typeof window.acquireVsCodeApi === 'function');

    // If we're in browser mode, we can assume the gateway server is running
    // since we're being served by it
    if (!isVSCodeEnv) {
      setGatewayServerRunning(true);
    } else {
      // Initial health checks
      checkGatewayServerHealth();
      checkMcpServerHealth();

      // Set up regular health checks every 5 seconds
      const healthCheckInterval = setInterval(() => {
        checkGatewayServerHealth();
        checkMcpServerHealth();
      }, 20000);

      // Clean up interval on unmount
      return () => clearInterval(healthCheckInterval);
    }

    const messageHandler = (event: MessageEvent) => {
      const message = event.data;

      // Handle server status updates (these take priority over health checks)
      if (message.command === 'serverStatus') {
        console.log(`Received server status update: ${message.server} is ${message.status}`);
        if (message.server === 'gateway') {
          // Immediately update UI without waiting for next health check
          setGatewayServerRunning(message.status === 'running');
        } else if (message.server === 'mcp') {
          // Immediately update UI without waiting for next health check
          setMcpServerRunning(message.status === 'running');
        }
      }
    };

    // Listen for tab switch events
    const tabSwitchHandler = (event: CustomEvent) => {
      if (event.detail && event.detail.tab) {
        setActiveTab(event.detail.tab);
      }
    };

    window.addEventListener('message', messageHandler);
    window.addEventListener('switchTab', tabSwitchHandler as EventListener);

    // Request initial server status if in VS Code
    if (isVSCodeEnv) {
      postMessage({ command: 'getServerStatus' });
    }

    // Clean up event listeners and intervals
    return () => {
      window.removeEventListener('message', messageHandler);
      window.removeEventListener('switchTab', tabSwitchHandler as EventListener);
    };
  }, [isVSCodeEnv]);

  // No longer needed as we have a tab for routes

  // Adjust the layout based on whether we're in the sidebar or not
  const containerClass = isSidebar
    ? 'space-y-4 overflow-auto p-2 sidebar-dashboard'
    : 'space-y-6 overflow-auto';

  return (
    <div className={containerClass}>
      <div className="tab-container mb-4">
        <button
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab ${activeTab === 'routes' ? 'active' : ''}`}
          onClick={() => setActiveTab('routes')}
        >
          Proxy Routes
        </button>
        <button
          className={`tab ${activeTab === 'metrics' ? 'active' : ''}`}
          onClick={() => setActiveTab('metrics')}
        >
          Metrics
        </button>
        <button
          className={`tab ${activeTab === 'traces' ? 'active' : ''}`}
          onClick={() => setActiveTab('traces')}
        >
          Traces
        </button>
        <button
          className={`tab ${activeTab === 'augment' ? 'active' : ''}`}
          onClick={() => setActiveTab('augment')}
        >
          Augment
        </button>
        <button
          className={`tab ${activeTab === 'mcp' ? 'active' : ''}`}
          onClick={() => setActiveTab('mcp')}
        >
          MCP
        </button>
      </div>

      {activeTab === 'overview' &&
        (isSidebar ? (
          <OverviewSidebarView />
        ) : (
          <>
            <Card title="Servers">
              <div className="space-y-4">
                <ServerStatus
                  name="Gateway Server"
                  description="Main server that handles gateway, proxy, and MCP functionality"
                  isRunning={gatewayServerRunning}
                  port={3000}
                  startCommand="startGatewayServer"
                  stopCommand="stopGatewayServer"
                  disableControls={!isVSCodeEnv}
                  adminStopUrl="http://localhost:3000/admin/stopServer"
                  onStopComplete={checkGatewayServerHealth}
                  onStartInitiated={() => {
                    // Only update if not already running
                    if (!gatewayServerRunning) {
                      console.log('Setting Gateway server to running (optimistic update)');
                      setGatewayServerRunning(true);
                    }
                  }}
                />

                <ServerStatus
                  name="MCP Server"
                  description="Model Context Protocol server for AI/LLM tools"
                  isRunning={mcpServerRunning}
                  port={3001}
                  startCommand="startMCPServer"
                  stopCommand="stopMCPServer"
                  disableControls={!isVSCodeEnv}
                  adminStopUrl="http://localhost:3001/admin/stopServer"
                  onStopComplete={checkMcpServerHealth}
                  onStartInitiated={() => {
                    // Only update if not already running
                    if (!mcpServerRunning) {
                      console.log('Setting MCP server to running (optimistic update)');
                      setMcpServerRunning(true);
                    }
                  }}
                >
                  {mcpServerRunning && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setActiveTab('mcp')}
                      className="mt-2"
                    >
                      View MCP Details
                    </Button>
                  )}
                </ServerStatus>
              </div>
            </Card>

            <Card title="Routes">
              <p className="mb-4">
                Configure custom proxy routes to forward requests to external services.
              </p>

              <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
                <div>
                  <h3 className="font-medium">Proxy Routes Manager</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Add, edit, and delete proxy routes to forward requests to external services.
                  </p>
                </div>
                <Button onClick={() => setActiveTab('routes')}>Go to Routes Manager</Button>
              </div>
            </Card>

            <Card title="Augment Context Engine">
              <p className="mb-4">
                Access powerful code intelligence features to help you navigate and understand your
                codebase.
              </p>

              <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
                <div>
                  <h3 className="font-medium">Augment Context Engine</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Search your codebase, navigate to symbol definitions, find references, and more.
                  </p>
                </div>
                <Button onClick={() => setActiveTab('augment')}>Open Augment</Button>
              </div>
            </Card>
          </>
        ))}

      {activeTab === 'routes' && (isSidebar ? <ProxyRoutesSidebarView /> : <ProxyRoutes />)}

      {activeTab === 'metrics' && (isSidebar ? <MetricsSidebarView /> : <PerformanceMetrics />)}

      {activeTab === 'traces' && (isSidebar ? <TracesSidebarView /> : <TracesList />)}

      {activeTab === 'augment' && (isSidebar ? <AugmentSidebarView /> : <AugmentContextEngine />)}

      {activeTab === 'mcp' && (isSidebar ? <MCPSidebarView /> : <MCPServerDetails />)}
    </div>
  );
};

export default Dashboard;
