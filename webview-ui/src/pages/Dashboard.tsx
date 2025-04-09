import React, { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import ServerStatus from '@/components/servers/ServerStatus';
import PerformanceMetrics from '@/components/metrics/PerformanceMetrics';
import TracesList from '@/components/traces/TracesList';
import ProxyRoutes from './ProxyRoutes';
import { postMessage } from '@/utils/vscode';

const Dashboard: React.FC = () => {
  // Server states
  const [proxyServerRunning, setProxyServerRunning] = useState(false);
  const [mcpServerRunning, setMcpServerRunning] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Check if we're running in browser or VS Code
  const [isVSCodeEnv, setIsVSCodeEnv] = useState(false);

  // Listen for messages from the extension
  useEffect(() => {
    // Determine if we're in VS Code or browser
    setIsVSCodeEnv(typeof window.acquireVsCodeApi === 'function');

    // If we're in browser mode, we can assume the proxy server is running
    // since we're being served by it
    if (!isVSCodeEnv) {
      setProxyServerRunning(true);
    }

    const messageHandler = (event: MessageEvent) => {
      const message = event.data;

      // Handle server status updates
      if (message.command === 'serverStatus') {
        if (message.server === 'proxy') {
          setProxyServerRunning(message.status === 'running');
        } else if (message.server === 'mcp') {
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

    return () => {
      window.removeEventListener('message', messageHandler);
      window.removeEventListener('switchTab', tabSwitchHandler as EventListener);
    };
  }, [isVSCodeEnv]);

  // No longer needed as we have a tab for routes

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
          <button
            className={`px-3 py-1 text-sm rounded ${activeTab === 'overview' ? 'bg-white dark:bg-gray-700 shadow' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            className={`px-3 py-1 text-sm rounded ${activeTab === 'routes' ? 'bg-white dark:bg-gray-700 shadow' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
            onClick={() => setActiveTab('routes')}
          >
            Proxy Routes
          </button>
          <button
            className={`px-3 py-1 text-sm rounded ${activeTab === 'metrics' ? 'bg-white dark:bg-gray-700 shadow' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
            onClick={() => setActiveTab('metrics')}
          >
            Metrics
          </button>
          <button
            className={`px-3 py-1 text-sm rounded ${activeTab === 'traces' ? 'bg-white dark:bg-gray-700 shadow' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
            onClick={() => setActiveTab('traces')}
          >
            Traces
          </button>
        </div>
      </div>

      {activeTab === 'overview' && (
        <>
          <Card title="Servers">
            <div className="space-y-4">
              <ServerStatus
                name="Proxy Server"
                description="Handles proxying requests to external services"
                isRunning={proxyServerRunning}
                port={3000}
                startCommand="startProxyServer"
                stopCommand="stopProxyServer"
                disableControls={!isVSCodeEnv}
              />

              <ServerStatus
                name="MCP Server"
                description="Model Context Protocol server for AI/LLM tools"
                isRunning={mcpServerRunning}
                port={3001}
                startCommand="startMCPServer"
                stopCommand="stopMCPServer"
                disableControls={!isVSCodeEnv}
              />
            </div>
          </Card>

          <Card title="Proxy Routes">
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
              <Button onClick={() => setActiveTab('routes')}>
                Go to Routes Manager
              </Button>
            </div>
          </Card>
        </>
      )}

      {activeTab === 'routes' && <ProxyRoutes />}

      {activeTab === 'metrics' && <PerformanceMetrics />}

      {activeTab === 'traces' && <TracesList />}
    </div>
  );
};

export default Dashboard;
