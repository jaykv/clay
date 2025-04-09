import * as vscode from 'vscode';
import * as path from 'path';

// Import server functions directly
import { startServer as startProxyServer, stopServer as stopProxyServer } from './server/proxy';
import { startServer as startMCPServer, stopServer as stopMCPServer } from './server/mcp';

// Server instances
let proxyServerInstance: any = null;
let mcpServerInstance: any = null;
let registryServerInstance: any = null;

// Event emitters for server status changes
export const serverStatusEmitter = new vscode.EventEmitter<{
  type: 'proxy' | 'mcp' | 'registry';
  status: 'started' | 'stopped';
}>();

// Check if servers are running
export function isProxyServerRunning(): boolean {
  return proxyServerInstance !== null;
}

export function isMCPServerRunning(): boolean {
  return mcpServerInstance !== null;
}

export function isRegistryServerRunning(): boolean {
  return registryServerInstance !== null;
}

export function registerCommands(context: vscode.ExtensionContext) {
  // Start Proxy Server command
  context.subscriptions.push(
    vscode.commands.registerCommand('clay.startProxyServer', async () => {
      if (proxyServerInstance) {
        vscode.window.showInformationMessage('Proxy server is already running');
        return;
      }

      try {
        // Start the proxy server directly
        proxyServerInstance = startProxyServer();

        vscode.window.showInformationMessage('Proxy server started successfully');
        serverStatusEmitter.fire({ type: 'proxy', status: 'started' });
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to start proxy server: ${error}`);
      }
    })
  );

  // Start MCP Server command
  context.subscriptions.push(
    vscode.commands.registerCommand('clay.startMCPServer', async () => {
      if (mcpServerInstance) {
        vscode.window.showInformationMessage('MCP server is already running');
        return;
      }

      try {
        // Start the MCP server directly
        mcpServerInstance = startMCPServer();

        vscode.window.showInformationMessage('MCP server started successfully');
        serverStatusEmitter.fire({ type: 'mcp', status: 'started' });
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to start MCP server: ${error}`);
      }
    })
  );

  // Stop Proxy Server command
  context.subscriptions.push(
    vscode.commands.registerCommand('clay.stopProxyServer', async () => {
      if (!proxyServerInstance) {
        vscode.window.showInformationMessage('Proxy server is not running');
        return;
      }

      try {
        // Stop the proxy server directly
        stopProxyServer();
        proxyServerInstance = null;

        vscode.window.showInformationMessage('Proxy server stopped successfully');
        serverStatusEmitter.fire({ type: 'proxy', status: 'stopped' });
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to stop proxy server: ${error}`);
      }
    })
  );

  // Stop MCP Server command
  context.subscriptions.push(
    vscode.commands.registerCommand('clay.stopMCPServer', async () => {
      if (!mcpServerInstance) {
        vscode.window.showInformationMessage('MCP server is not running');
        return;
      }

      try {
        // Stop the MCP server directly
        stopMCPServer();
        mcpServerInstance = null;

        vscode.window.showInformationMessage('MCP server stopped successfully');
        serverStatusEmitter.fire({ type: 'mcp', status: 'stopped' });
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to stop MCP server: ${error}`);
      }
    })
  );

  // Register MCP Server command
  context.subscriptions.push(
    vscode.commands.registerCommand('clay.registerMCPServer', async () => {
      const serverUrl = await vscode.window.showInputBox({
        prompt: 'Enter the MCP server URL',
        placeHolder: 'http://localhost:3000'
      });

      if (!serverUrl) {
        return;
      }

      const serverName = await vscode.window.showInputBox({
        prompt: 'Enter a name for the MCP server',
        placeHolder: 'My MCP Server'
      });

      if (!serverName) {
        return;
      }

      // TODO: Implement actual registration with the registry server
      vscode.window.showInformationMessage(`Registered MCP server: ${serverName} at ${serverUrl}`);
    })
  );
}
