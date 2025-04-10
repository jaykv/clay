import * as vscode from 'vscode';
import { registerCommands, serverStatusEmitter } from './commands';
import { EnhancedWebviewProvider } from './webview/EnhancedWebviewProvider';
import { initializeAugmentContextEngineForVSCode } from './server/augment/vscode-extension';

export async function activate(context: vscode.ExtensionContext) {
  console.log('Clay extension is now active');

  // Register commands
  registerCommands(context);

  // Register dashboard provider
  context.subscriptions.push(
    vscode.commands.registerCommand('clay.showDashboard', () => {
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
