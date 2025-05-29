# Clay for VSCode

A VSCode extension that provides AI-related tools and services for developers.

## Features

### 1. Proxy Server with Tracing Dashboard

The extension includes a high-performance proxy server built with Fastify that can:

- Intercept and trace all AI-related requests
- Provide detailed logs and metrics through a visual dashboard
- Support Server-Sent Events (SSE) streaming for real-time updates
- Efficiently handle high-throughput requests

### 2. Model Context Protocol (MCP) Server

The extension implements an MCP server that:

- Follows the [Model Context Protocol](https://modelcontextprotocol.io) specification
- Provides resources, tools, and prompts for LLM applications
- Integrates with the proxy server for request handling
- Uses the official MCP TypeScript SDK
- Supports dynamic loading of custom MCP extensions from JavaScript, TypeScript, and Python

### 3. MCP Registry

The extension includes an MCP registry that:

- Allows registration and discovery of MCP servers
- Provides a unified approach for installing MCP servers in VSCode
- Implements the registry approach described in the [MCP discussion](https://github.com/orgs/modelcontextprotocol/discussions/274)

## Getting Started

1. Install the extension from the VSCode marketplace
2. Open the command palette (Ctrl+Shift+P / Cmd+Shift+P)
3. Run "Clay: Start Proxy Server" to start the proxy server (includes MCP server by default)
4. Run "Clay: Show Tracing Dashboard" to open the dashboard
5. Alternatively, run "Clay: Start MCP Server" to start just the MCP server

## Keyboard Shortcuts

This extension provides the following keyboard shortcuts:

- `Ctrl+Shift+D` / `Cmd+Shift+D` (Mac): Show Tracing Dashboard
- `Ctrl+Shift+A` / `Cmd+Shift+A` (Mac): Open Augment Context Engine
- `Ctrl+Shift+F` / `Cmd+Shift+F` (Mac): Search Codebase
- `Ctrl+Shift+G` / `Cmd+Shift+G` (Mac): Go to Symbol Definition
- `Ctrl+Shift+R` / `Cmd+Shift+R` (Mac): Find References
- `Ctrl+Shift+I` / `Cmd+Shift+I` (Mac): Reindex Codebase

## Usage

### Proxy Server

The proxy server runs on `http://localhost:3000` by default and provides:

- `/api/ai/*` - Endpoint for proxying AI requests
- `/api/traces` - API for accessing trace data
- `/api/sse` - Server-Sent Events endpoint for real-time updates

### MCP Server

The MCP server is integrated into the proxy server and is available at `http://localhost:3000/mcp` by default. It provides:

- `/mcp/sse` - SSE endpoint for MCP connections
- `/mcp/messages` - Endpoint for MCP clients to send messages

You can also run the MCP server as a standalone service on `http://localhost:3001` if needed.

#### MCP Servers

Clay now uses the standard MCP format for loading tools, resources, and prompts. This provides better compatibility with the MCP ecosystem and access to community servers.

**Migration Notice**: The old custom extension format in `.clay/mcp` is deprecated. Please migrate to the new standard MCP format in `.clay/mcp-servers`. See the [Migration Guide](.clay/mcp-servers/README.md) for details.

Clay supports three types of MCP servers:

1. **Built-in Servers**: Built-in Clay servers like Augment Context Engine
2. **Module Servers**: Standard MCP server modules (TypeScript/JavaScript)
3. **External Servers**: External MCP servers (Python, etc.) via subprocess

Configure MCP servers in your Clay configuration:

```yaml
mcp:
  servers:
    enabled: true
    serversPath: '.clay/mcp-servers'
    servers:
      # Built-in Augment server
      - name: 'augment'
        type: 'builtin'
        enabled: true

      # Local module server
      - name: 'calculator'
        type: 'module'
        path: './calculator.mjs'
        enabled: true

      # External community server
      - name: 'filesystem'
        type: 'external'
        command: 'npx'
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/workspace']
        enabled: false
```

##### Python Extensions

Python extensions can be created by defining functions with appropriate docstrings and a `main()` function that returns the extension definition:

```python
def tool_example(param1: str, param2: int = 0) -> dict:
    """Example tool function

    Args:
        param1: Description of the first parameter
        param2: Description of the second parameter
    """
    # Tool implementation
    return {
        "content": [{"type": "text", "text": f"Result: {param1}, {param2}"}]
    }

def main():
    """Define the extension"""
    return {
        "id": "example-extension",
        "description": "Example extension with tools",
        "version": "1.0.0",
        "author": "Your Name",
        "tools": [tool_example],
        "resources": [],
        "prompts": []
    }
```

The MCP server will automatically extract parameter descriptions from docstrings using the standard Python docstring format with Args sections.

### Registry

The registry server runs on `http://localhost:3002` by default and provides:

- `/api/servers` - API for managing registered MCP servers

### Augment Context Engine

The Augment Context Engine provides powerful code intelligence features to help you navigate and understand your codebase:

- **Search Codebase** (`Ctrl+Shift+F` / `Cmd+Shift+F`): Search your entire codebase for specific code patterns, functions, or text
- **Go to Symbol Definition** (`Ctrl+Shift+G` / `Cmd+Shift+G`): Navigate to the definition of a symbol
- **Find References** (`Ctrl+Shift+R` / `Cmd+Shift+R`): Find all references to a symbol across your codebase
- **Reindex Codebase** (`Ctrl+Shift+I` / `Cmd+Shift+I`): Manually trigger reindexing of your codebase

The Augment Context Engine is also available as an MCP tool for AI extensions, allowing AI assistants to access your codebase context.

## Development

### Prerequisites

- Node.js 16+
- npm or yarn

### Setup

1. Clone the repository
2. Run `npm install` to install dependencies
3. Run `npm run compile` to build the extension
4. Press F5 to start debugging the extension in a new VSCode window

### Packaging the Extension

To create a VSIX package that can be installed in VSCode:

1. Run `node package-extension.js` to compile and package the extension
2. The script will create a `.vsix` file in the root directory
3. Install the extension in VSCode by:
   - Opening VSCode
   - Going to the Extensions view (Ctrl+Shift+X / Cmd+Shift+X)
   - Clicking on the "..." menu in the top-right corner
   - Selecting "Install from VSIX..."
   - Navigating to and selecting the `.vsix` file

Alternatively, you can run the individual commands:

```bash
# Compile the extension
npm run compile

# Package the extension
npm run vsce:package
```

### Project Structure

- `/extension` - VSCode extension code
- `/src` - Source code
  - `/server` - Server implementations
    - `/gateway` - Fastify-based gateway server with tracing
    - `/mcp` - MCP server implementation
      - `/extensions` - MCP server loader (standard MCP format)
      - `/servers` - MCP server loading utilities
    - `/augment` - Augment Context Engine implementation
  - `/utils` - Shared utilities
- `/webview-ui` - Dashboard UI implementation
- `/.clay` - Configuration and extensions directory
  - `/mcp` - Custom MCP extensions (deprecated)
  - `/mcp-servers` - Standard MCP servers

## License

MIT
