# MCP Inspector Integration

The Clay extension includes an integration with the [MCP Inspector](https://github.com/modelcontextprotocol/inspector), a visual testing tool for MCP servers. This integration allows you to test and debug your MCP server directly from VS Code.

## Features

- Connect to the Clay MCP server with a single click
- Test MCP tools, resources, and prompts
- Debug MCP server responses
- Visualize MCP server capabilities

## Usage

1. Start the MCP server using the Clay extension
2. Open the MCP Inspector by:
   - Running the command `Clay: Open MCP Inspector` from the command palette (Ctrl+Shift+P / Cmd+Shift+P)
   - Using the keyboard shortcut Ctrl+Shift+M / Cmd+Shift+M

The MCP Inspector will automatically connect to your running MCP server.

## Building the MCP Inspector UI

The MCP Inspector UI is built from the [modelcontextprotocol/inspector](https://github.com/modelcontextprotocol/inspector) repository. To rebuild the UI:

```bash
npm run build-mcp-inspector
```

This script will:
1. Clone the MCP Inspector repository (or update it if already cloned)
2. Install dependencies
3. Build the client
4. Copy the built files to the extension
5. Customize the HTML for VS Code integration

## Troubleshooting

If you encounter issues with the MCP Inspector:

1. Make sure the MCP server is running
2. Check the VS Code output panel for any error messages
3. Try rebuilding the MCP Inspector UI with `npm run build-mcp-inspector`
4. Restart VS Code

## Credits

The MCP Inspector is developed by the Model Context Protocol team at Anthropic. This integration is provided as-is and is not officially supported by Anthropic.
