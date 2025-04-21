import * as vscode from 'vscode';
import { registerCommands, isMCPServerRunning, isGatewayServerRunning } from './commands';
import { serverStatusEmitter, ServerStatusEvent } from './globals';
import { initializeServerContext } from './server/utils/server-bridge';
import { EnhancedWebviewProvider } from './webview/WebviewProvider';
import { SidebarWebviewProvider } from './webview/SidebarWebviewProvider';
import { MCPInspectorWebviewProvider } from './webview/MCPInspectorWebviewProvider';
import { initializeAugmentContextEngineForVSCode } from './server/augment/vscode-extension';
import { getConfig } from './server/utils/config';
import { startMCPServer } from './server/mcp';
import { logger } from './server/utils/logger';

export async function activate(context: vscode.ExtensionContext) {
  // Console log is kept for immediate feedback in the debug console
  console.log('Clay extension is now active');

  // Initialize the output channel for logging
  const outputChannel = vscode.window.createOutputChannel('Clay');
  context.subscriptions.push(outputChannel);
  logger.setOutputChannel(outputChannel);
  logger.info('Clay extension activated');

  // Load configuration from YAML file
  // Configuration is loaded automatically when getConfig() is called
  logger.info('Loading configuration...');

  // Set workspace root path if available
  if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
    const workspaceFolder = vscode.workspace.workspaceFolders[0];
    const workspaceRoot = workspaceFolder.uri.fsPath;
    // Initialize both global and server contexts with the workspace root path
    initializeServerContext(workspaceRoot);
    logger.info(`Workspace root path set to: ${workspaceRoot}`);
  } else {
    logger.warn('No workspace folder found, using current directory as workspace root');
  }

  // Register commands
  logger.info('Registering commands...');
  registerCommands(context);

  // Check if servers are already running
  const mcpConfig = getConfig().mcp;
  const gatewayConfig = getConfig().gateway;

  // Check MCP server
  const mcpRunning = await isMCPServerRunning();
  if (mcpConfig.autostart && !mcpRunning) {
    logger.info(`Autostarting MCP server on port ${mcpConfig.port}...`);
    try {
      // The server implementation will set the global reference
      await startMCPServer();
      // Emit event for immediate UI update (faster than waiting for health checks)
      serverStatusEmitter.fire({ type: 'mcp', status: 'started' });
      logger.info(`MCP server started on port ${mcpConfig.port}`);
    } catch (error) {
      logger.error('Failed to autostart MCP server:', error);
    }
  } else if (mcpRunning) {
    // If the server is running but we don't have an instance, update the status
    logger.info(`MCP server already running on port ${mcpConfig.port}`);
    // Emit event for immediate UI update (faster than waiting for health checks)
    serverStatusEmitter.fire({ type: 'mcp', status: 'started' });
  }

  // Check Gateway server
  const gatewayRunning = await isGatewayServerRunning();
  if (gatewayRunning) {
    // If the server is running but we don't have an instance, update the status
    logger.info(`Gateway server already running on port ${gatewayConfig.port}`);
    // Emit event for immediate UI update (faster than waiting for health checks)
    serverStatusEmitter.fire({ type: 'gateway', status: 'started' });
  }

  // Register gateway provider
  context.subscriptions.push(
    vscode.commands.registerCommand('clay.showGateway', () => {
      EnhancedWebviewProvider.createOrShow(context.extensionUri);
    })
  );

  // Listen for server status changes and immediately update the webview
  // This provides faster UI updates than waiting for health checks
  context.subscriptions.push(
    serverStatusEmitter.event((event: ServerStatusEvent) => {
      logger.debug(`Sending immediate server status update: ${event.type} is ${event.status}`);
      EnhancedWebviewProvider.postMessage({
        command: 'serverStatus',
        server: event.type,
        status: event.status === 'started' ? 'running' : 'stopped',
      });
    })
  );

  // Register open routes manager command
  context.subscriptions.push(
    vscode.commands.registerCommand('clay.openRoutesManager', () => {
      // First show the dashboard if it's not already visible
      EnhancedWebviewProvider.createOrShow(context.extensionUri);

      // Then send a message to navigate to the routes page
      EnhancedWebviewProvider.postMessage({
        command: 'navigate',
        route: '/proxy-routes',
      });
    })
  );

  // Register open Augment Context Engine command
  context.subscriptions.push(
    vscode.commands.registerCommand('clay.openAugmentEngine', () => {
      // First show the dashboard if it's not already visible
      EnhancedWebviewProvider.createOrShow(context.extensionUri);

      // Then send a message to switch to the Augment tab
      EnhancedWebviewProvider.postMessage({
        command: 'switchTab',
        tab: 'augment',
      });
    })
  );

  // Register open MCP Inspector command
  context.subscriptions.push(
    vscode.commands.registerCommand('clay.openMCPInspector', () => {
      // Show the MCP Inspector panel
      MCPInspectorWebviewProvider.createOrShow(context.extensionUri);
    })
  );

  // Listen for server status changes and update the MCP Inspector webview
  context.subscriptions.push(
    serverStatusEmitter.event((event: ServerStatusEvent) => {
      if (event.type === 'mcp') {
        logger.debug(`Sending MCP server status update to MCP Inspector: ${event.status}`);
        MCPInspectorWebviewProvider.postMessage({
          command: 'mcpServerStatus',
          status: event.status === 'started' ? 'running' : 'stopped',
          config: {
            host: mcpConfig.host,
            port: mcpConfig.port
          }
        });
      }
    })
  );

  // Register sidebar webview provider with persistence options
  const sidebarProvider = new SidebarWebviewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('clay.sidebar.dashboard', sidebarProvider, {
      webviewOptions: {
        retainContextWhenHidden: true, // This is crucial for performance and state persistence
      },
    })
  );

  // Log that the sidebar provider is registered
  logger.info('Clay sidebar webview provider registered with persistence enabled');

  // Listen for server status changes and update the sidebar webview
  context.subscriptions.push(
    serverStatusEmitter.event((event: ServerStatusEvent) => {
      logger.debug(
        `Sending immediate server status update to sidebar: ${event.type} is ${event.status}`
      );

      sidebarProvider.postMessage({
        command: 'serverStatus',
        server: event.type,
        status: event.status === 'started' ? 'running' : 'stopped',
      });
    })
  );

  // Initialize the Augment Context Engine for VS Code
  initializeAugmentContextEngineForVSCode(context);

  // Register Augment Context Engine commands in package.json
  // These are already registered in the initializeAugmentContextEngineForVSCode function
}

export function deactivate() {
  console.log('Deactivating Clay extension');
  // No need to clean up resources - VS Code will handle this automatically
  console.log('Clay extension deactivated');
}
