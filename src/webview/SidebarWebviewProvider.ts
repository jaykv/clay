import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { isGatewayServerRunning, isMCPServerRunning } from '../commands';
import { logger } from '../server/utils/logger';

// Cache for HTML content to avoid reading from disk repeatedly
interface HtmlCache {
  html: string;
  jsUri: string;
  cssUri: string;
  timestamp: number;
}

/**
 * Manages the sidebar webview for the Clay Gateway
 */
export class SidebarWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'clay.sidebar.dashboard';
  private _view?: vscode.WebviewView;
  private extensionUri: vscode.Uri;
  private htmlCache: HtmlCache | null = null;
  private readonly CACHE_TTL = 1000 * 60 * 5; // 5 minutes cache TTL

  constructor(private readonly _extensionUri: vscode.Uri) {
    this.extensionUri = _extensionUri;
  }

  /**
   * Send a message to the webview
   */
  public postMessage(message: any): Thenable<boolean> | boolean {
    if (this._view) {
      return this._view.webview.postMessage(message);
    }
    return false;
  }

  /**
   * Called when the view is first created
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    // Set options for the webview with more permissive content security policy
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'webview-ui'),
        vscode.Uri.joinPath(this.extensionUri, 'webview-ui', 'dist'),
        vscode.Uri.joinPath(this.extensionUri, 'webview-ui', 'dist', 'assets'),
        vscode.Uri.joinPath(this.extensionUri, 'webview-ui', 'dist', 'fonts'),
      ],
    };

    // Log the resource roots for debugging
    const roots = webviewView.webview.options.localResourceRoots;
    if (roots) {
      logger.info(`Webview local resource roots:`);
      roots.forEach(root => logger.info(` - ${root.toString()}`));
    }

    // Set the HTML content
    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    // Log that the HTML content has been set
    logger.info(`Webview HTML content set for Gateway Dashboard sidebar view`);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(
      message => {
        logger.debug('Received message from sidebar webview:', message);

        // Handle commands that start with 'clay.'
        if (message.command && message.command.startsWith('clay.')) {
          // Forward these commands directly to VS Code
          vscode.commands.executeCommand(message.command, message);
          return;
        }

        // Handle other specific commands
        switch (message.command) {
          case 'alert':
            vscode.window.showErrorMessage(message.text);
            return;
          case 'startGatewayServer':
            vscode.commands.executeCommand('clay.startGatewayServer').then(() => {
              // Update server status after command completes
              setTimeout(() => {
                this.sendServerStatus().catch((error: Error) => {
                  logger.error('Error updating server status:', error);
                });
              }, 500);
            });
            return;
          case 'stopGatewayServer':
            vscode.commands.executeCommand('clay.stopGatewayServer').then(() => {
              // Update server status after command completes
              setTimeout(() => {
                this.sendServerStatus().catch((error: Error) => {
                  logger.error('Error updating server status:', error);
                });
              }, 500);
            });
            return;
          case 'startMCPServer':
            vscode.commands.executeCommand('clay.startMCPServer').then(() => {
              // Update server status after command completes
              setTimeout(() => {
                this.sendServerStatus().catch((error: Error) => {
                  logger.error('Error updating server status:', error);
                });
              }, 500);
            });
            return;
          case 'stopMCPServer':
            vscode.commands.executeCommand('clay.stopMCPServer').then(() => {
              // Update server status after command completes
              setTimeout(() => {
                this.sendServerStatus().catch((error: Error) => {
                  logger.error('Error updating server status:', error);
                });
              }, 500);
            });
            return;
          case 'openRoutesManager':
            vscode.commands.executeCommand('clay.openRoutesManager');
            return;
          case 'refresh':
            // Clear the cache and refresh the webview content
            this.htmlCache = null;
            webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
            return;
          case 'getServerStatus':
            // Send the current server status
            this.sendServerStatus().catch((error: Error) => {
              logger.error('Error sending server status:', error);
            });
            return;
          case 'switchTab':
            // Forward the tab switching command back to the webview
            // We need to send a message that will trigger the custom event in the webview
            logger.debug(`Forwarding switchTab command for tab: ${message.tab}`);
            this.postMessage({
              command: 'dispatchCustomEvent',
              eventName: 'switchTab',
              detail: { tab: message.tab }
            });
            return;
        }
      },
      undefined,
      []
    );

    // Send initial server status
    this.sendServerStatus().catch((error: Error) => {
      logger.error('Error sending initial server status:', error);
    });
  }

  /**
   * Send the current server status to the webview
   */
  private async sendServerStatus(): Promise<void> {
    if (!this._view) {
      return;
    }

    try {
      const gatewayRunning = await isGatewayServerRunning();
      const mcpRunning = await isMCPServerRunning();

      this.postMessage({
        command: 'serverStatus',
        gatewayRunning,
        mcpRunning,
      });
    } catch (error) {
      logger.error('Error checking server status:', error);
    }
  }

  /**
   * Get the HTML for the webview
   */
  private getHtmlForWebview(webview: vscode.Webview): string {
    // Clear cache for now to ensure we always generate fresh content
    this.htmlCache = null;

    logger.debug('Generating fresh HTML content for sidebar webview');

    // Path to the webview UI dist directory
    const webviewUiDistPath = path.join(this.extensionUri.fsPath, 'webview-ui', 'dist');
    const indexHtmlPath = path.join(webviewUiDistPath, 'index.html');

    // Check if index.html exists
    if (!fs.existsSync(indexHtmlPath)) {
      return this.getErrorHtml(`Cannot find index.html at ${indexHtmlPath}`);
    }

    // Get the JS file path (required)
    const jsFilePath = path.join(webviewUiDistPath, 'assets', 'index.js');

    // Check if JS file exists (this is required)
    if (!fs.existsSync(jsFilePath)) {
      return this.getErrorHtml(`Missing required JavaScript asset at ${jsFilePath}`);
    }

    // Get the CSS file path (optional)
    const cssFiles = fs
      .readdirSync(path.join(webviewUiDistPath, 'assets'))
      .filter(file => file.endsWith('.css'));

    if (cssFiles.length === 0) {
      logger.warn('No CSS file found in assets directory');
    }

    // Read the index.html file
    let html = fs.readFileSync(indexHtmlPath, 'utf8');

    // Create URIs for the scripts and styles
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'webview-ui', 'dist', 'assets', 'index.js')
    );

    let styleUri = null;
    if (cssFiles.length > 0) {
      styleUri = webview.asWebviewUri(
        vscode.Uri.joinPath(this.extensionUri, 'webview-ui', 'dist', 'assets', cssFiles[0])
      );
    }

    // Create URI for the Material Icons CSS
    const materialIconsCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.extensionUri,
        'webview-ui',
        'dist',
        'fonts',
        'material-icons',
        'material-icons.css'
      )
    );

    // Generate a nonce for CSP
    const nonce = this.getNonce();

    // Construct the HTML with direct script and style tags and CSP
    html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="vscode-view-type" content="sidebar" />
        <meta http-equiv="Content-Security-Policy" content="default-src 'self' ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' 'unsafe-inline' 'unsafe-eval' ${webview.cspSource}; img-src ${webview.cspSource} data:; font-src ${webview.cspSource}; connect-src 'self' http://localhost:* https://localhost:* ws://localhost:* wss://localhost:*;" />
        <title>Clay Dashboard</title>
        ${styleUri ? `<link rel="stylesheet" type="text/css" href="${styleUri}" />` : ''}
        <link rel="stylesheet" type="text/css" href="${materialIconsCssUri}" />
      </head>
      <body class="vscode-sidebar-view">
        <div id="root"></div>
        <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
      </body>
      </html>
    `;

    return html;
  }

  /**
   * Get HTML for an error message
   */
  private getErrorHtml(errorMessage: string): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Error</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            color: #e74c3c;
          }
          h1 {
            font-size: 18px;
          }
          p {
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <h1>Error Loading Clay Dashboard</h1>
        <p>${errorMessage}</p>
        <p>Please ensure the webview UI has been built by running <code>npm run build</code> in the webview-ui directory.</p>
      </body>
      </html>
    `;
  }

  /**
   * Generates a nonce string for CSP
   */
  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
