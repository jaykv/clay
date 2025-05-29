import * as vscode from 'vscode';

// Import server functions directly
import {
  startServer as startGatewayServer,
  stopServer as stopGatewayServer,
} from './server/gateway';
import { startMCPServer, stopMCPServer } from './server/mcp';
import { startPhoenixServer, stopPhoenixServer, isPhoenixServerRunning } from './server/phoenix';
import { isMCPServer, isGatewayServer, isPhoenixServer } from './server/utils/port';
import { getConfig } from './server/utils/config';
import { logger } from './server/utils/logger';

// Import globals
import { serverStatusEmitter } from './globals';

// Import server bridge
import {
  getGatewayServerInstance,
  getMCPServerInstance,
  getRegistryServerInstance,
  getPhoenixServerInstance,
  setGatewayServerInstance,
  setMCPServerInstance,
  setPhoenixServerInstance,
} from './server/utils/server-bridge';

// Check if servers are running
export async function isGatewayServerRunning(): Promise<boolean> {
  const config = getConfig().gateway;

  // First check if there's a Gateway server actually running on the configured port
  const isRunning = await isGatewayServer(config.port, config.host);

  // If the server is not running but we have an instance reference, clear it
  const gatewayServerInstance = getGatewayServerInstance();
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
  const mcpServerInstance = getMCPServerInstance();
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
  return getRegistryServerInstance() !== null;
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
        return getMCPServerInstance();
      }

      try {
        // Start the MCP server directly
        // The server implementation will set the global reference
        await startMCPServer();

        vscode.window.showInformationMessage('MCP server started successfully');
        // Emit event for immediate UI update (faster than waiting for health checks)
        serverStatusEmitter.fire({ type: 'mcp', status: 'started' });
        return getMCPServerInstance();
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

  // Start Phoenix Server command
  context.subscriptions.push(
    vscode.commands.registerCommand('clay.startPhoenixServer', async () => {
      if (await isPhoenixServerRunning()) {
        vscode.window.showInformationMessage('Phoenix server is already running');
        return getPhoenixServerInstance();
      }

      try {
        // Start the Phoenix server directly
        // The server implementation will set the global reference
        await startPhoenixServer();

        vscode.window.showInformationMessage('Phoenix server started successfully');
        // Emit event for immediate UI update (faster than waiting for health checks)
        serverStatusEmitter.fire({ type: 'phoenix', status: 'started' });
        return getPhoenixServerInstance();
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to start Phoenix server: ${error}`);
        return null;
      }
    })
  );

  // Stop Phoenix Server command
  context.subscriptions.push(
    vscode.commands.registerCommand('clay.stopPhoenixServer', async () => {
      try {
        // Stop the Phoenix server with force option to ensure it's fully stopped
        await stopPhoenixServer(true);
        setPhoenixServerInstance(null);

        vscode.window.showInformationMessage('Phoenix server stopped successfully');
        serverStatusEmitter.fire({ type: 'phoenix', status: 'stopped' });
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to stop Phoenix server: ${error}`);
      }
    })
  );

  // Open Phoenix UI command
  context.subscriptions.push(
    vscode.commands.registerCommand('clay.openPhoenix', async () => {
      const config = getConfig().phoenix;
      const phoenixUrl = `http://${config.host}:${config.port}`;

      // Check if Phoenix is running
      if (!(await isPhoenixServerRunning())) {
        const startPhoenix = await vscode.window.showWarningMessage(
          'Phoenix server is not running. Would you like to start it?',
          'Start Phoenix',
          'Cancel'
        );

        if (startPhoenix === 'Start Phoenix') {
          try {
            await startPhoenixServer();
            vscode.window.showInformationMessage('Phoenix server started successfully');
            serverStatusEmitter.fire({ type: 'phoenix', status: 'started' });
          } catch (error) {
            vscode.window.showErrorMessage(`Failed to start Phoenix server: ${error}`);
            return;
          }
        } else {
          return;
        }
      }

      // Open Phoenix UI in external browser
      vscode.env.openExternal(vscode.Uri.parse(phoenixUrl));
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
