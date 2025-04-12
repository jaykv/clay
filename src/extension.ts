import * as vscode from 'vscode';
import { registerCommands, serverStatusEmitter, isMCPServerRunning } from './commands';
import { EnhancedWebviewProvider } from './webview/WebviewProvider';
import { initializeAugmentContextEngineForVSCode } from './server/augment/vscode-extension';
import { getConfig } from './server/utils/config';
import { startMCPServer } from './server/mcp';

export async function activate(context: vscode.ExtensionContext) {
  console.log('Clay extension is now active');

  // Load configuration from YAML file
  // Configuration is loaded automatically when getConfig() is called

  // Register commands
  registerCommands(context);

  // Autostart MCP server if enabled
  const mcpConfig = getConfig().mcp;
  if (mcpConfig.autostart && !isMCPServerRunning()) {
    console.log(`Autostarting MCP server on port ${mcpConfig.port}...`);
    try {
      const mcpServer = await startMCPServer();
      if (mcpServer) {
        serverStatusEmitter.fire({ type: 'mcp', status: 'started' });
        console.log(`MCP server started on port ${mcpConfig.port}`);
      }
    } catch (error) {
      console.error('Failed to autostart MCP server:', error);
    }
  }

  // Register gateway provider
  context.subscriptions.push(
    vscode.commands.registerCommand('clay.showGateway', () => {
      EnhancedWebviewProvider.createOrShow(context.extensionUri);
    })
  );

  // Listen for server status changes and update the webview
  context.subscriptions.push(
    serverStatusEmitter.event(({ type, status }) => {~
      EnhancedWebviewProvider.postMessage({
        command: 'serverStatus',
        server: type,
        status: status === 'started' ? 'running' : 'stopped'
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
        route: '/proxy-routes'
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
        tab: 'augment'
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
