# Clay for VSCode

A VSCode extension that provides AI-related tools and services for developers.

## Features

### 1. Proxy Server with Tracing Dashboard

The extension includes a high-performance proxy server built with Hono.js that can:

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

### Registry

The registry server runs on `http://localhost:3002` by default and provides:

- `/api/servers` - API for managing registered MCP servers

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
- `/server` - Server implementations
  - `/proxy` - Hono-based proxy server with tracing
  - `/mcp` - MCP server implementation
  - `/registry` - MCP registry implementation
- `/server/utils` - Shared utilities

## License

MIT
