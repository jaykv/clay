import * as vscode from 'vscode';
import { logger } from '../server/utils/logger';
import { getConfig } from '../server/utils/config';

/**
 * Manages the webview panel for the MCP Inspector
 * Simplified to load the MCP Inspector from the gateway server
 */
export class MCPInspectorWebviewProvider {
  public static readonly viewType = 'clayMCPInspector';
  private static panel: vscode.WebviewPanel | undefined;

  /**
   * Creates and shows the webview panel, or reveals it if it already exists
   */
  public static async createOrShow(extensionUri: vscode.Uri) {
    // If we already have a panel, show it
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      return;
    }

    // Get gateway server configuration
    const gatewayConfig = getConfig().gateway;
    const gatewayUrl = `http://${gatewayConfig.host}:${gatewayConfig.port}/mcp-inspector`;

    // Create a new panel
    const panel = vscode.window.createWebviewPanel(
      this.viewType,
      'MCP Inspector',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        // Allow access to the gateway server
        localResourceRoots: [],
      }
    );

    this.panel = panel;

    // Set the webview's HTML content to load the gateway server
    panel.webview.html = this.getWebviewContent(gatewayUrl);

    // Listen for when the panel is disposed
    panel.onDidDispose(
      () => {
        this.panel = undefined;
      },
      null,
      []
    );

    logger.info(`MCP Inspector webview created, loading from: ${gatewayUrl}`);
  }

  /**
   * Generate HTML content that loads the MCP Inspector from the gateway server
   */
  private static getWebviewContent(gatewayUrl: string): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>MCP Inspector</title>
        <style>
          html, body {
            margin: 0;
            padding: 0;
            height: 100%;
            overflow: hidden;
          }
          iframe {
            width: 100%;
            height: 100%;
            border: none;
          }
          .loading {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
          }
          .error {
            color: var(--vscode-errorForeground);
            text-align: center;
            padding: 2rem;
          }
        </style>
      </head>
      <body>
        <div class="loading" id="loading">
          <div>
            <h2>Loading MCP Inspector...</h2>
            <p>Connecting to gateway server at ${gatewayUrl}</p>
          </div>
        </div>
        <iframe 
          id="inspector-frame"
          src="${gatewayUrl}"
          style="display: none;"
          onload="document.getElementById('loading').style.display='none'; this.style.display='block';"
          onerror="document.getElementById('loading').innerHTML='<div class=error><h2>Failed to Load MCP Inspector</h2><p>Could not connect to gateway server at ${gatewayUrl}</p><p>Please ensure the Clay gateway server is running.</p></div>';">
        </iframe>
      </body>
      </html>
    `;
  }
}
