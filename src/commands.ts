import * as vscode from 'vscode';
import { getConfig } from './server/utils/config';

// Import server functions directly
import { startServer as startGatewayServer, stopServer as stopGatewayServer } from './server/gateway';
import { startServer as startMCPServer, stopServer as stopMCPServer } from './server/mcp';

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

  // Start MCP Server command
  context.subscriptions.push(
    vscode.commands.registerCommand('clay.startMCPServer', async () => {
      // Check if gateway server is running with MCP enabled
      if (gatewayServerInstance) {
        const config = getConfig();
        if (config.gateway.mcpEnabled) {
          vscode.window.showInformationMessage('MCP server is already running as part of the gateway server');
          mcpServerInstance = true; // Mark as running
          serverStatusEmitter.fire({ type: 'mcp', status: 'started' });
          return;
        }
      }

      if (mcpServerInstance) {
        vscode.window.showInformationMessage('MCP server is already running');
        return;
      }

      try {
        // Start the gateway server with MCP enabled if not already running
        if (!gatewayServerInstance) {
          // Update config to enable MCP
          const config = getConfig();
          config.gateway.mcpEnabled = true;

          // Start the gateway server which will include MCP
          gatewayServerInstance = startGatewayServer();
          mcpServerInstance = true; // Mark MCP as running

          vscode.window.showInformationMessage('Gateway server with MCP started successfully');
          serverStatusEmitter.fire({ type: 'gateway', status: 'started' });
          serverStatusEmitter.fire({ type: 'mcp', status: 'started' });
          return;
        }

        // If we get here, gateway is running but MCP is not enabled
        // This is a fallback to the old behavior of starting a separate MCP server
        mcpServerInstance = startMCPServer();
        vscode.window.showInformationMessage('MCP server started successfully (standalone mode)');
        serverStatusEmitter.fire({ type: 'mcp', status: 'started' });
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to start MCP server: ${error}`);
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

  // Stop MCP Server command
  context.subscriptions.push(
    vscode.commands.registerCommand('clay.stopMCPServer', async () => {
      if (!mcpServerInstance) {
        vscode.window.showInformationMessage('MCP server is not running');
        return;
      }

      // Check if MCP is running as part of the gateway server
      const config = getConfig();
      if (gatewayServerInstance && config.gateway.mcpEnabled) {
        // Ask user if they want to stop the gateway server or just disable MCP
        const action = await vscode.window.showInformationMessage(
          'MCP server is running as part of the gateway server. What would you like to do?',
          { modal: true },
          'Stop Gateway Server', 'Disable MCP Only', 'Cancel'
        );

        if (action === 'Stop Gateway Server') {
          // Stop the gateway server (which includes MCP)
          stopGatewayServer();
          gatewayServerInstance = null;
          mcpServerInstance = null;

          vscode.window.showInformationMessage('Gateway server (including MCP) stopped successfully');
          serverStatusEmitter.fire({ type: 'gateway', status: 'stopped' });
          serverStatusEmitter.fire({ type: 'mcp', status: 'stopped' });
        } else if (action === 'Disable MCP Only') {
          // Just disable MCP in the config
          config.gateway.mcpEnabled = false;
          mcpServerInstance = null;

          vscode.window.showInformationMessage('MCP server disabled. Gateway server is still running.');
          serverStatusEmitter.fire({ type: 'mcp', status: 'stopped' });
        }

        return;
      }

      try {
        // Stop the standalone MCP server
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
