# MCP Inspector Integration

The Clay extension includes an integration with the [MCP Inspector](https://github.com/modelcontextprotocol/inspector), a visual testing tool for MCP servers. This integration uses the official npm package `@modelcontextprotocol/inspector` to provide a seamless debugging experience directly within VS Code.

## Features

- Connect to the Clay MCP server with a single click
- Test MCP tools, resources, and prompts
- Debug MCP server responses
- Visualize MCP server capabilities
- Automatic proxy server management
- No build steps required

## Usage

1. Start the MCP server using the Clay extension
2. Open the MCP Inspector by:
   - Running the command `Clay: Open MCP Inspector` from the command palette (Ctrl+Shift+P / Cmd+Shift+P)
   - Using the keyboard shortcut Ctrl+Shift+M / Cmd+Shift+M

The MCP Inspector will automatically:
- Start an MCP proxy server
- Connect to your running Clay MCP server
- Open the inspector UI in a VS Code webview panel

## Architecture

The integration works by:
1. **MCP Proxy Server**: Automatically started when the inspector opens (port 6277)
2. **Inspector UI**: Served from the npm package files via VS Code webview
3. **Connection Flow**: Inspector UI → MCP Proxy → Clay MCP Server

## Installation

The MCP Inspector is automatically built when you run:
```bash
npm run compile-all
```

This creates a lightweight bundle (~1.4MB) containing only the essential UI and server files, keeping the extension size minimal.

## Troubleshooting

If you encounter issues with the MCP Inspector:

1. **MCP Server Not Running**: Make sure the Clay MCP server is started before opening the inspector
2. **Proxy Server Issues**: Check the VS Code output panel for proxy server error messages
3. **Connection Problems**: Verify that port 6277 is not being used by another application
4. **Package Issues**: Ensure `@modelcontextprotocol/inspector` is properly installed by running `npm install`

## Benefits of the New Integration

- **Faster Setup**: No git cloning or building from source required
- **Automatic Updates**: Inspector updates automatically with `npm update`
- **Better Reliability**: Uses official npm packages instead of git dependencies
- **Smaller Bundle**: No need to copy built files into the extension
- **Easier Maintenance**: Leverages official package management

## Credits

The MCP Inspector is developed by the Model Context Protocol team at Anthropic. This integration uses the official npm package and is designed to work seamlessly within the Clay extension.
