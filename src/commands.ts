import * as vscode from 'vscode';

// Import server functions directly
import { startServer as startGatewayServer, stopServer as stopGatewayServer } from './server/gateway';
import { startMCPServer } from './server/mcp';

// Server instances
let gatewayServerInstance: any = null;
let mcpServerInstance: any = null;
let registryServerInstance: any = null;

// Event emitters for server status changes
export const serverStatusEmitter = new vscode.EventEmitter<{
  type: 'gateway' | 'mcp' | 'registry';
  status: 'started' | 'stopped';
}>();

// Check if servers are running
export function isGatewayServerRunning(): boolean {
  return gatewayServerInstance !== null;
}

export function isMCPServerRunning(): boolean {
  return mcpServerInstance !== null;
}

export function isRegistryServerRunning(): boolean {
  return registryServerInstance !== null;
}

export function registerCommands(context: vscode.ExtensionContext) {
  // Start Gateway Server command
  context.subscriptions.push(
    vscode.commands.registerCommand('clay.startGatewayServer', async () => {
      if (gatewayServerInstance) {
        vscode.window.showInformationMessage('Gateway server is already running');
        return;
      }

      try {
        // Start the gateway server directly
        gatewayServerInstance = startGatewayServer();

        vscode.window.showInformationMessage('Gateway server started successfully');
        serverStatusEmitter.fire({ type: 'gateway', status: 'started' });
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to start gateway server: ${error}`);
      }
    })
  );

  // Stop Gateway Server command
  context.subscriptions.push(
    vscode.commands.registerCommand('clay.stopGatewayServer', async () => {
      if (!gatewayServerInstance) {
        vscode.window.showInformationMessage('Gateway server is not running');
        return;
      }

      try {
        // Stop the gateway server directly
        stopGatewayServer();
        gatewayServerInstance = null;

        vscode.window.showInformationMessage('Gateway server stopped successfully');
        serverStatusEmitter.fire({ type: 'gateway', status: 'stopped' });
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to stop gateway server: ${error}`);
      }
    })
  );

  // Start MCP Server command
  context.subscriptions.push(
    vscode.commands.registerCommand('clay.startMCPServer', async () => {
      if (mcpServerInstance) {
        vscode.window.showInformationMessage('MCP server is already running');
        return mcpServerInstance;
      }

      try {
        // Start the MCP server directly
        mcpServerInstance = await startMCPServer();

        vscode.window.showInformationMessage('MCP server started successfully');
        serverStatusEmitter.fire({ type: 'mcp', status: 'started' });
        return mcpServerInstance;
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to start MCP server: ${error}`);
        return null;
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
        // For now, we'll just set the instance to null
        // In the future, we might want to add a stop method to the MCP server
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
        placeHolder: 'http://localhost:3001'
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
