# MCP Servers

This directory contains MCP server modules that Clay can load using the standard MCP format.

## Migration from Custom Extensions

Clay has migrated from a custom extension format to the standard MCP format. This provides better compatibility with the MCP ecosystem and reduces maintenance overhead.

### What Changed

**Old Format (Deprecated):**
- Custom extension format in `.clay/mcp/`
- Custom `main()` function returning JSON structure
- Custom parameter validation and handler registration

**New Format (Standard MCP):**
- Standard MCP server modules in `.clay/mcp-servers/`
- Uses official MCP SDKs (TypeScript/Python)
- Standard tool/resource/prompt registration

## Server Types

Clay supports three types of MCP servers:

### 1. Built-in Servers
Built-in Clay servers like Augment Context Engine.

```yaml
# Configuration
mcp:
  servers:
    servers:
      - name: "augment"
        type: "builtin"
        enabled: true
```

### 2. Module Servers
Standard MCP server modules (TypeScript/JavaScript) loaded directly.

```yaml
# Configuration
mcp:
  servers:
    servers:
      - name: "calculator"
        type: "module"
        path: "./calculator.mjs"
        enabled: true
```

### 3. External Servers
External MCP servers (Python, etc.) via subprocess.

```yaml
# Configuration
mcp:
  servers:
    servers:
      - name: "filesystem"
        type: "external"
        command: "npx"
        args: ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"]
        enabled: true
```

## Creating Module Servers

### TypeScript/JavaScript Example

Create a `.mjs` file that exports a standard MCP server:

```javascript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'Calculator',
  version: '1.0.0'
});

// Add tools
server.tool('add', 
  { 
    a: z.number().describe('First number'),
    b: z.number().describe('Second number')
  },
  async ({ a, b }) => ({
    content: [{ type: 'text', text: String(a + b) }]
  })
);

// Add resources
server.resource(
  'math-constants',
  'math://constants',
  async (uri) => ({
    contents: [{
      uri: uri.href,
      text: 'π = 3.14159, e = 2.71828'
    }]
  })
);

// Add prompts
server.prompt(
  'solve-equation',
  { equation: z.string() },
  ({ equation }) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `Please solve this equation: ${equation}`
      }
    }]
  })
);

export { server };
```

### Python Example

For Python servers, use the standard MCP Python SDK and configure as external servers:

```python
# calculator.py
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool
from pydantic import BaseModel

class AddArgs(BaseModel):
    a: float
    b: float

server = Server("calculator")

@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="add",
            description="Add two numbers",
            inputSchema=AddArgs.schema()
        )
    ]

@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    if name == "add":
        args = AddArgs(**arguments)
        result = args.a + args.b
        return [TextContent(type="text", text=str(result))]

async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
```

Then configure as external server:

```yaml
mcp:
  servers:
    servers:
      - name: "python-calculator"
        type: "external"
        command: "python"
        args: ["./calculator.py"]
        enabled: true
```

## Migration Guide

### Step 1: Backup Old Extensions
Your old extensions in `.clay/mcp/` are preserved and can be used as reference.

### Step 2: Convert to Standard Format
Convert your custom extensions to standard MCP format using the examples above.

### Step 3: Update Configuration
Update your Clay configuration to use the new server format.

### Step 4: Test
Test your migrated servers to ensure they work correctly.

## Benefits of Standard MCP Format

- **Ecosystem Compatibility**: Use existing MCP servers from the community
- **Better Performance**: No process spawning for every call
- **Standard Compliance**: Full MCP protocol compliance
- **Future-Proof**: Automatic access to MCP SDK updates
- **Better Tooling**: Access to MCP debugging and development tools

## Community Servers

You can also use existing MCP servers from the community:

```yaml
mcp:
  servers:
    servers:
      # Official filesystem server
      - name: "filesystem"
        type: "external"
        command: "npx"
        args: ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"]
        
      # Official git server
      - name: "git"
        type: "external"
        command: "uvx"
        args: ["mcp-server-git", "--repository", "./"]
        
      # Official GitHub server
      - name: "github"
        type: "external"
        command: "npx"
        args: ["-y", "@modelcontextprotocol/server-github"]
        env:
          GITHUB_PERSONAL_ACCESS_TOKEN: "your-token"
```

See the [MCP Servers Repository](https://github.com/modelcontextprotocol/servers) for more community servers.
