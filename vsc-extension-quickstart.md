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

## Getting Started

1. Install the extension from the VSCode marketplace
2. Open the command palette (Ctrl+Shift+P / Cmd+Shift+P)
3. Run "Clay: Start Proxy Server" to start the proxy server
4. Run "Clay: Show Tracing Dashboard" to open the dashboard
5. Run "Clay: Start MCP Server" to start the MCP server

## Requirements

- Node.js 16.x or higher

## Extension Settings

This extension contributes the following settings:

* `clay.proxyPort`: Port for the proxy server (default: 3000)
* `clay.mcpPort`: Port for the MCP server (default: 3001)
* `clay.registryPort`: Port for the registry server (default: 3002)

## Known Issues

- The extension requires Node.js 16.x or higher
- Some dependencies may show warnings about unsupported Node.js versions

## Release Notes

### 0.1.0

Initial release of Clay
