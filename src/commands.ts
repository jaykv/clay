import * as vscode from 'vscode';

// Import server functions directly
import { startServer as startGatewayServer, stopServer as stopGatewayServer } from './server/gateway';

// Server instances
let gatewayServerInstance: any = null;
let registryServerInstance: any = null;

// Event emitters for server status changes
export const serverStatusEmitter = new vscode.EventEmitter<{
  type: 'gateway' | 'registry';
  status: 'started' | 'stopped';
}>();

// Check if servers are running
export function isGatewayServerRunning(): boolean {
  return gatewayServerInstance !== null;
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
