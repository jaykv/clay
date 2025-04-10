# Clay for VSCode

This extension provides AI-related tools and services for developers, including a proxy server with tracing dashboard, an MCP server, and an MCP registry.

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

### 4. Augment Context Engine

The extension includes a powerful code intelligence engine that:

- Provides advanced code search capabilities across your entire codebase
- Enables navigation to symbol definitions and finding references
- Integrates with VS Code's language services for accurate code analysis
- Is available as an MCP tool for AI extensions

## Getting Started

1. Install the extension from the VSCode marketplace
2. Open the command palette (Ctrl+Shift+P / Cmd+Shift+P)
3. Run "Clay: Start Proxy Server" to start the proxy server
4. Run "Clay: Show Tracing Dashboard" to open the dashboard
5. Run "Clay: Start MCP Server" to start the MCP server
6. Run "Clay: Open Augment Context Engine" or press Ctrl+Shift+A (Cmd+Shift+A on Mac) to open the Augment Context Engine
7. Use the keyboard shortcuts to search your codebase, find symbol definitions, and more

## Requirements

- Node.js 16.x or higher

## Extension Settings

This extension contributes the following settings:

* `clay.proxyPort`: Port for the proxy server (default: 3000)
* `clay.mcpPort`: Port for the MCP server (default: 3001)
* `clay.registryPort`: Port for the registry server (default: 3002)

## Keyboard Shortcuts

This extension provides the following keyboard shortcuts:

* `Ctrl+Shift+D` / `Cmd+Shift+D` (Mac): Show Tracing Dashboard
* `Ctrl+Shift+A` / `Cmd+Shift+A` (Mac): Open Augment Context Engine
* `Ctrl+Shift+F` / `Cmd+Shift+F` (Mac): Search Codebase
* `Ctrl+Shift+G` / `Cmd+Shift+G` (Mac): Go to Symbol Definition
* `Ctrl+Shift+R` / `Cmd+Shift+R` (Mac): Find References
* `Ctrl+Shift+I` / `Cmd+Shift+I` (Mac): Reindex Codebase

## Known Issues

- The extension requires Node.js 16.x or higher
- Some dependencies may show warnings about unsupported Node.js versions

## Release Notes

### 0.1.0

Initial release of Clay
