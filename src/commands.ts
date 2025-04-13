import * as vscode from 'vscode';

// Import server functions directly
import {
  startServer as startGatewayServer,
  stopServer as stopGatewayServer,
} from './server/gateway';
import { startMCPServer, stopMCPServer } from './server/mcp';
import { isMCPServer, isGatewayServer } from './server/utils/port';
import { getConfig } from './server/utils/config';
import { logger } from './server/utils/logger';

// Import globals
import {
  gatewayServerInstance,
  mcpServerInstance,
  registryServerInstance,
  setGatewayServerInstance,
  setMCPServerInstance,
  serverStatusEmitter,
} from './globals';

// Check if servers are running
export async function isGatewayServerRunning(): Promise<boolean> {
  const config = getConfig().gateway;

  // First check if there's a Gateway server actually running on the configured port
  const isRunning = await isGatewayServer(config.port, config.host);

  // If the server is not running but we have an instance reference, clear it
  if (!isRunning && gatewayServerInstance !== null) {
    logger.warn(
      'Gateway server instance reference exists but server is not running. Clearing reference.'
    );
    setGatewayServerInstance(null);
    return false;
  }

  // If the server is running but we don't have an instance reference, that's fine
  // The dashboard will still show it as running based on the health check

  return isRunning;
}

export async function isMCPServerRunning(): Promise<boolean> {
  const config = getConfig().mcp;

  // First check if there's an MCP server actually running on the configured port
  const isRunning = await isMCPServer(config.port, config.host);

  // If the server is not running but we have an instance reference, clear it
  if (!isRunning && mcpServerInstance !== null) {
    logger.warn(
      'MCP server instance reference exists but server is not running. Clearing reference.'
    );
    setMCPServerInstance(null);
    return false;
  }

  // If the server is running but we don't have an instance reference, that's fine
  // The dashboard will still show it as running based on the health check

  return isRunning;
}

export function isRegistryServerRunning(): boolean {
  return registryServerInstance !== null;
}

export function registerCommands(context: vscode.ExtensionContext) {
  // Start Gateway Server command
  context.subscriptions.push(
    vscode.commands.registerCommand('clay.startGatewayServer', async () => {
      if (await isGatewayServerRunning()) {
        vscode.window.showInformationMessage('Gateway server is already running');
        return;
      }

      try {
        // Start the gateway server directly
        // The server implementation will set the global reference
        await startGatewayServer();

        vscode.window.showInformationMessage('Gateway server started successfully');
        // Emit event for immediate UI update (faster than waiting for health checks)
        serverStatusEmitter.fire({ type: 'gateway', status: 'started' });
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to start gateway server: ${error}`);
      }
    })
  );

  // Stop Gateway Server command
  context.subscriptions.push(
    vscode.commands.registerCommand('clay.stopGatewayServer', async () => {
      try {
        // Stop the gateway server with force option to ensure it's fully stopped
        await stopGatewayServer(true);
        setGatewayServerInstance(null);

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
      if (await isMCPServerRunning()) {
        vscode.window.showInformationMessage('MCP server is already running');
        return mcpServerInstance;
      }

      try {
        // Start the MCP server directly
        // The server implementation will set the global reference
        await startMCPServer();

        vscode.window.showInformationMessage('MCP server started successfully');
        // Emit event for immediate UI update (faster than waiting for health checks)
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
      try {
        // Stop the MCP server with force option to ensure it's fully stopped
        await stopMCPServer(true);
        setMCPServerInstance(null);

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
        placeHolder: 'http://localhost:3001',
      });

      if (!serverUrl) {
        return;
      }

      const serverName = await vscode.window.showInputBox({
        prompt: 'Enter a name for the MCP server',
        placeHolder: 'My MCP Server',
      });

      if (!serverName) {
        return;
      }

      // TODO: Implement actual registration with the registry server
      vscode.window.showInformationMessage(`Registered MCP server: ${serverName} at ${serverUrl}`);
    })
  );
}
