import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { isMCPServerRunning } from '../commands';
import { logger } from '../server/utils/logger';
import { getConfig } from '../server/utils/config';

// Cache for HTML content to avoid reading from disk repeatedly
interface HtmlCache {
  html: string;
  timestamp: number;
}

/**
 * Manages the webview panel for the MCP Inspector
 */
export class MCPInspectorWebviewProvider {
  public static readonly viewType = 'clayMCPInspector';
  private static panel: vscode.WebviewPanel | undefined;
  private static extensionUri: vscode.Uri;
  private static htmlCache: HtmlCache | null = null;
  private static readonly CACHE_TTL = 1000 * 60 * 5; // 5 minutes cache TTL

  /**
   * Send a message to the webview
   */
  public static postMessage(message: any): Thenable<boolean> | boolean {
    if (this.panel) {
      return this.panel.webview.postMessage(message);
    }
    return false;
  }

  /**
   * Send the current MCP server status to the webview
   */
  private static async sendServerStatus(): Promise<void> {
    try {
      // Send MCP server status
      const mcpRunning = await isMCPServerRunning();
      const mcpConfig = getConfig().mcp;
      
      this.postMessage({
        command: 'mcpServerStatus',
        status: mcpRunning ? 'running' : 'stopped',
        config: {
          host: mcpConfig.host,
          port: mcpConfig.port
        }
      });
    } catch (error) {
      logger.error('Error checking MCP server status:', error);
    }
  }

  /**
   * Creates and shows the webview panel, or reveals it if it already exists
   */
  public static createOrShow(extensionUri: vscode.Uri) {
    // Save the extension URI for later use
    this.extensionUri = extensionUri;

    // If we already have a panel, show it
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      return;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      this.viewType,
      'MCP Inspector',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'webview-ui'),
          vscode.Uri.joinPath(extensionUri, 'webview-ui', 'dist'),
          vscode.Uri.joinPath(extensionUri, 'webview-ui', 'dist', 'assets'),
          vscode.Uri.joinPath(extensionUri, 'mcp-inspector'),
        ],
      }
    );

    this.panel = panel;

    // Set the webview's initial html content
    panel.webview.html = this.getHtmlForWebview(panel.webview, extensionUri);

    // Listen for when the panel is disposed
    panel.onDidDispose(
      () => {
        this.panel = undefined;
        // Clear the cache when the panel is disposed
        this.htmlCache = null;
      },
      null,
      []
    );

    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(
      message => {
        logger.debug('Received message from MCP Inspector webview:', message);

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
          case 'startMCPServer':
            vscode.commands.executeCommand('clay.startMCPServer').then(() => {
              // Update server status after command completes
              setTimeout(() => {
                this.sendServerStatus().catch((error: Error) => {
                  logger.error('Error updating MCP server status:', error);
                });
              }, 500);
            });
            return;
          case 'stopMCPServer':
            vscode.commands.executeCommand('clay.stopMCPServer').then(() => {
              // Update server status after command completes
              setTimeout(() => {
                this.sendServerStatus().catch((error: Error) => {
                  logger.error('Error updating MCP server status:', error);
                });
              }, 500);
            });
            return;
          case 'refresh':
            // Clear the cache and refresh the webview content
            this.htmlCache = null;
            panel.webview.html = this.getHtmlForWebview(panel.webview, extensionUri);
            return;
          case 'getServerStatus':
            // Send the current server status
            this.sendServerStatus().catch((error: Error) => {
              logger.error('Error sending MCP server status:', error);
            });
            return;
        }
      },
      undefined,
      []
    );

    // Send initial server status
    this.sendServerStatus().catch((error: Error) => {
      logger.error('Error sending initial MCP server status:', error);
    });
  }

  /**
   * Gets the HTML content for the webview
   */
  private static getHtmlForWebview(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    try {
      const now = Date.now();

      // Check if we have a valid cache
      if (
        this.htmlCache &&
        now - this.htmlCache.timestamp < this.CACHE_TTL &&
        this.htmlCache.html
      ) {
        logger.debug('Using cached HTML content for MCP Inspector webview');
        return this.htmlCache.html;
      }

      logger.debug('Generating fresh HTML content for MCP Inspector webview');

      // Path to the MCP Inspector directory
      const mcpInspectorPath = path.join(extensionUri.fsPath, 'mcp-inspector');
      const indexHtmlPath = path.join(mcpInspectorPath, 'index.html');

      // Check if index.html exists
      if (!fs.existsSync(indexHtmlPath)) {
        return this.getErrorHtml(`Cannot find MCP Inspector index.html at ${indexHtmlPath}. Please run 'npm run build-mcp-inspector' to build the MCP Inspector UI.`);
      }

      // Read the index.html file
      let indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

      // Get the MCP server configuration
      const mcpConfig = getConfig().mcp;
      const mcpServerUrl = `http://${mcpConfig.host}:${mcpConfig.port}`;

      // Convert all local paths to webview URIs
      indexHtml = this.rewriteHtml(indexHtml, webview, extensionUri);

      // Add CSP and scrolling styles
      const nonce = this.getNonce();
      indexHtml = indexHtml.replace(
        /<head>/,
        `<head>
        <meta http-equiv="Content-Security-Policy" content="default-src 'self' ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' 'unsafe-inline' 'unsafe-eval' ${webview.cspSource}; img-src ${webview.cspSource} data:; font-src ${webview.cspSource}; connect-src 'self' http://localhost:* https://localhost:* ws://localhost:* wss://localhost:*; ">
        <style>
          html, body {
            height: 100%;
            width: 100%;
            margin: 0;
            padding: 0;
            overflow: auto !important;
          }
          #root {
            height: 100%;
            overflow: auto !important;
          }
        </style>`
      );

      // Add nonce to scripts
      indexHtml = indexHtml.replace(/<script/g, `<script nonce="${nonce}"`);

      // Add VS Code API initialization script
      indexHtml = indexHtml.replace(
        /<\/head>/,
        `<script nonce="${nonce}">
          // Initialize VS Code API
          const vscode = acquireVsCodeApi();
          
          // Store MCP server URL
          window.MCP_SERVER_URL = "${mcpServerUrl}";
          
          // Listen for messages from the extension
          window.addEventListener('message', event => {
            const message = event.data;
            
            if (message.command === 'mcpServerStatus') {
              // Update MCP server status
              window.MCP_SERVER_STATUS = message.status;
              window.MCP_SERVER_CONFIG = message.config;
              
              // Dispatch a custom event that the MCP Inspector can listen for
              window.dispatchEvent(new CustomEvent('mcpServerStatusChanged', { 
                detail: { 
                  status: message.status,
                  config: message.config
                } 
              }));
            }
          });
          
          // Function to send messages to the extension
          window.sendMessageToExtension = function(message) {
            vscode.postMessage(message);
          };
        </script>
        </head>`
      );

      // Cache the HTML content
      this.htmlCache = {
        html: indexHtml,
        timestamp: now,
      };

      return indexHtml;
    } catch (error) {
      logger.error('Error generating MCP Inspector webview HTML:', error);
      return this.getErrorHtml(`Error generating MCP Inspector webview HTML: ${error}`);
    }
  }

  /**
   * Rewrite HTML to use webview URIs for all local resources
   */
  private static rewriteHtml(html: string, webview: vscode.Webview, extensionUri: vscode.Uri): string {
    // Replace script src attributes
    html = html.replace(
      /<script([^>]*) src="([^"]+)"/g,
      (match, attrs, src) => {
        if (src.startsWith('http') || src.startsWith('//')) {
          // External URL, don't modify
          return match;
        }
        
        // Convert to webview URI
        const webviewUri = webview.asWebviewUri(
          vscode.Uri.joinPath(extensionUri, 'mcp-inspector', src)
        );
        
        return `<script${attrs} src="${webviewUri}"`;
      }
    );

    // Replace link href attributes
    html = html.replace(
      /<link([^>]*) href="([^"]+)"/g,
      (match, attrs, href) => {
        if (href.startsWith('http') || href.startsWith('//')) {
          // External URL, don't modify
          return match;
        }
        
        // Convert to webview URI
        const webviewUri = webview.asWebviewUri(
          vscode.Uri.joinPath(extensionUri, 'mcp-inspector', href)
        );
        
        return `<link${attrs} href="${webviewUri}"`;
      }
    );

    // Replace img src attributes
    html = html.replace(
      /<img([^>]*) src="([^"]+)"/g,
      (match, attrs, src) => {
        if (src.startsWith('http') || src.startsWith('//') || src.startsWith('data:')) {
          // External URL or data URI, don't modify
          return match;
        }
        
        // Convert to webview URI
        const webviewUri = webview.asWebviewUri(
          vscode.Uri.joinPath(extensionUri, 'mcp-inspector', src)
        );
        
        return `<img${attrs} src="${webviewUri}"`;
      }
    );

    return html;
  }

  /**
   * Get HTML for an error message
   */
  private static getErrorHtml(errorMessage: string): string {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Error</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
          padding: 2rem;
          color: var(--vscode-foreground);
          background-color: var(--vscode-editor-background);
        }
        h1 {
          color: var(--vscode-editor-foreground);
          margin-bottom: 1rem;
        }
        .error {
          color: var(--vscode-errorForeground);
          background-color: var(--vscode-inputValidation-errorBackground);
          border: 1px solid var(--vscode-inputValidation-errorBorder);
          padding: 1rem;
          margin-bottom: 1rem;
          border-radius: 4px;
        }
        button {
          background-color: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 2px;
          cursor: pointer;
        }
        button:hover {
          background-color: var(--vscode-button-hoverBackground);
        }
      </style>
    </head>
    <body>
      <h1>Error Loading MCP Inspector</h1>
      <div class="error">
        <p>${errorMessage}</p>
      </div>
      <p>Please try reloading the extension or check the developer console for more information.</p>
      <button onclick="reload()">Reload</button>
      <script>
        function reload() {
          // Send a message to the extension to refresh the webview
          const vscode = acquireVsCodeApi();
          vscode.postMessage({ command: 'refresh' });
        }
      </script>
    </body>
    </html>`;
  }

  /**
   * Generates a nonce string for CSP
   */
  private static getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
