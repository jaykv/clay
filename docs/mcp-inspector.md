# MCP Inspector Integration

The Clay extension includes a seamless integration with the [MCP Inspector](https://github.com/modelcontextprotocol/inspector), a visual testing tool for MCP servers. This integration serves the MCP Inspector directly from the Clay gateway server for maximum simplicity and performance.

## Features

- Connect to the Clay MCP server with a single click
- Test MCP tools, resources, and prompts
- Debug MCP server responses
- Visualize MCP server capabilities
- Zero configuration required
- Served directly from Clay gateway server

## Usage

1. **Start the Clay servers** using the extension (both gateway and MCP servers)
2. **Open the MCP Inspector** by:
   - Running the command `Clay: Open MCP Inspector` from the command palette (Ctrl+Shift+P / Cmd+Shift+P)
   - Using the keyboard shortcut Ctrl+Shift+M / Cmd+Shift+M

The MCP Inspector will automatically load from the gateway server and connect to your Clay MCP server.

## Simplified Architecture

The new streamlined integration works by:
1. **Clay Gateway Server**: Serves the MCP Inspector UI at `/mcp-inspector`
2. **MCP Proxy Endpoints**: Gateway server forwards MCP requests to Clay MCP server
3. **VS Code Webview**: Simply loads the inspector from the gateway server
4. **Connection Flow**: Inspector UI → Gateway Server → Clay MCP Server

## Installation

No additional installation or build steps required! The MCP Inspector is automatically available when you:
```bash
npm install  # Installs @modelcontextprotocol/inspector dependency
```

The inspector UI is served directly from the gateway server using the npm package files.

## Troubleshooting

If you encounter issues with the MCP Inspector:

1. **Gateway Server Not Running**: Ensure the Clay gateway server is started (it serves the inspector)
2. **MCP Server Not Running**: Make sure the Clay MCP server is also running
3. **Connection Issues**: Check that both servers are running on their configured ports
4. **Package Issues**: Ensure `@modelcontextprotocol/inspector` is installed with `npm install`
5. **Browser Issues**: Try refreshing the webview or restarting VS Code

## Benefits of the Simplified Integration

- **🚀 Zero Build Steps**: No compilation or bundling required
- **⚡ Instant Loading**: Inspector loads directly from gateway server
- **🔧 Zero Configuration**: Works out of the box with Clay servers
- **📦 Minimal Extension Size**: No bundled UI files in extension
- **🔄 Automatic Updates**: Inspector updates with `npm update`
- **🛡️ Better Reliability**: Uses standard web server architecture
- **🎯 Simpler Debugging**: Can test inspector in regular browser at `http://localhost:3000/mcp-inspector`

## Credits

The MCP Inspector is developed by the Model Context Protocol team at Anthropic. This integration uses the official npm package and is designed to work seamlessly within the Clay extension.
