import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import { isMCPServerRunning } from '../commands';
import { logger } from '../server/utils/logger';
import { getConfig } from '../server/utils/config';

// Cache for HTML content to avoid reading from disk repeatedly
interface HtmlCache {
  html: string;
  timestamp: number;
}

// MCP Proxy server instance
interface MCPProxyServer {
  process: ChildProcess;
  port: number;
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
  private static proxyServer: MCPProxyServer | null = null;

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
   * Start the MCP proxy server
   */
  private static async startProxyServer(): Promise<number> {
    if (this.proxyServer) {
      return this.proxyServer.port;
    }

    const port = 6277; // Default MCP proxy port
    const mcpConfig = getConfig().mcp;
    const mcpServerUrl = `http://${mcpConfig.host}:${mcpConfig.port}`;

    try {
      // Try to find the inspector server (bundled with extension)
      const possibleServerPaths = [
        // Bundled server files in extension
        path.join(this.extensionUri.fsPath, 'mcp-inspector-bundle', 'server', 'index.js'),
        // Fallback to development scenario
        path.join(this.extensionUri.fsPath, 'node_modules', '@modelcontextprotocol', 'inspector', 'server', 'build', 'index.js'),
      ];

      let inspectorServerPath: string | null = null;
      for (const possiblePath of possibleServerPaths) {
        if (fs.existsSync(possiblePath)) {
          inspectorServerPath = possiblePath;
          logger.debug(`Found MCP Inspector server at: ${inspectorServerPath}`);
          break;
        }
      }

      if (!inspectorServerPath) {
        throw new Error(`Cannot find MCP Inspector server. Searched paths: ${possibleServerPaths.join(', ')}`);
      }

      // Start the proxy server process
      const childProcess = spawn('node', [inspectorServerPath], {
        env: {
          ...process.env,
          PORT: port.toString(),
          MCP_SERVER_URL: mcpServerUrl,
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      childProcess.stdout?.on('data', (data: Buffer) => {
        logger.debug(`MCP Proxy stdout: ${data.toString()}`);
      });

      childProcess.stderr?.on('data', (data: Buffer) => {
        logger.error(`MCP Proxy stderr: ${data.toString()}`);
      });

      childProcess.on('error', (error: Error) => {
        logger.error('MCP Proxy process error:', error);
        this.proxyServer = null;
      });

      childProcess.on('exit', (code: number | null) => {
        logger.info(`MCP Proxy process exited with code ${code}`);
        this.proxyServer = null;
      });

      this.proxyServer = { process: childProcess, port };
      logger.info(`Started MCP proxy server on port ${port}`);

      return port;
    } catch (error) {
      logger.error('Failed to start MCP proxy server:', error);
      throw error;
    }
  }

  /**
   * Stop the MCP proxy server
   */
  private static stopProxyServer(): void {
    if (this.proxyServer) {
      this.proxyServer.process.kill();
      this.proxyServer = null;
      logger.info('Stopped MCP proxy server');
    }
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
  public static async createOrShow(extensionUri: vscode.Uri) {
    // Save the extension URI for later use
    this.extensionUri = extensionUri;

    // If we already have a panel, show it
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      return;
    }

    // Start the proxy server
    try {
      await this.startProxyServer();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to start MCP proxy server: ${error}`);
      return;
    }

    // Resource roots for the bundled inspector
    const possibleResourceRoots = [
      // Bundled files
      vscode.Uri.joinPath(extensionUri, 'mcp-inspector-bundle', 'client'),
      vscode.Uri.joinPath(extensionUri, 'mcp-inspector-bundle', 'client', 'assets'),
      // Fallback to development scenario
      vscode.Uri.joinPath(extensionUri, 'node_modules', '@modelcontextprotocol', 'inspector', 'client', 'dist'),
      vscode.Uri.joinPath(extensionUri, 'node_modules', '@modelcontextprotocol', 'inspector', 'client', 'dist', 'assets'),
    ];

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      this.viewType,
      'MCP Inspector',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: possibleResourceRoots,
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
        // Stop the proxy server
        this.stopProxyServer();
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

      // Use the bundled MCP Inspector UI files
      const possiblePaths = [
        // Bundled UI files in extension
        path.join(extensionUri.fsPath, 'mcp-inspector-bundle', 'client'),
        // Fallback to development scenario
        path.join(extensionUri.fsPath, 'node_modules', '@modelcontextprotocol', 'inspector', 'client', 'dist'),
      ];

      let mcpInspectorPath: string | null = null;
      let indexHtmlPath: string | null = null;

      // Find the first existing path
      for (const possiblePath of possiblePaths) {
        const testIndexPath = path.join(possiblePath, 'index.html');
        if (fs.existsSync(testIndexPath)) {
          mcpInspectorPath = possiblePath;
          indexHtmlPath = testIndexPath;
          logger.debug(`Found MCP Inspector at: ${mcpInspectorPath}`);
          break;
        }
      }

      // Check if index.html exists
      if (!mcpInspectorPath || !indexHtmlPath) {
        const searchedPaths = possiblePaths.map(p => path.join(p, 'index.html')).join('\n  - ');
        return this.getErrorHtml(`Cannot find MCP Inspector index.html. Searched paths:\n  - ${searchedPaths}\n\nPlease run 'npm run build-mcp-inspector-ui' to build the bundle.`);
      }

      // Read the index.html file
      let indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

      // Get the proxy server port
      const proxyPort = this.proxyServer?.port || 6277;

      // Convert all local paths to webview URIs
      indexHtml = this.rewriteHtml(indexHtml, webview, mcpInspectorPath);

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

          // Store proxy server URL for MCP Inspector to connect to
          window.MCP_PROXY_URL = "http://localhost:${proxyPort}";

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
  private static rewriteHtml(html: string, webview: vscode.Webview, inspectorClientPath: string): string {

    // Replace script src attributes
    html = html.replace(
      /<script([^>]*) src="([^"]+)"/g,
      (match, attrs, src) => {
        if (src.startsWith('http') || src.startsWith('//')) {
          // External URL, don't modify
          return match;
        }

        // Convert to webview URI using the discovered inspector path
        const webviewUri = webview.asWebviewUri(
          vscode.Uri.file(path.join(inspectorClientPath, src))
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

        // Convert to webview URI using the discovered inspector path
        const webviewUri = webview.asWebviewUri(
          vscode.Uri.file(path.join(inspectorClientPath, href))
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

        // Convert to webview URI using the discovered inspector path
        const webviewUri = webview.asWebviewUri(
          vscode.Uri.file(path.join(inspectorClientPath, src))
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
