import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../utils/logger';
import { getConfig } from '../utils/config';
import fetch from 'node-fetch';

/**
 * Register the MCP Inspector API and UI with Fastify
 */
export function registerMCPInspectorAPI(fastify: FastifyInstance, options: any, done: () => void) {
  const mcpConfig = getConfig().mcp;
  const mcpServerUrl = `http://${mcpConfig.host}:${mcpConfig.port}`;

  // Serve MCP Inspector UI
  fastify.get('/mcp-inspector', async (request, reply) => {
    try {
      const inspectorHtml = getMCPInspectorHTML(mcpServerUrl);
      reply.type('text/html').send(inspectorHtml);
    } catch (error) {
      logger.error('Failed to serve MCP Inspector UI:', error);
      reply.status(500).send({ error: 'Failed to load MCP Inspector UI' });
    }
  });

  // Serve MCP Inspector static assets
  fastify.get('/mcp-inspector/assets/*', async (request, reply) => {
    try {
      const assetPath = (request.params as any)['*'];
      const inspectorPath = findMCPInspectorPath();

      if (!inspectorPath) {
        return reply.status(404).send('MCP Inspector assets not found');
      }

      let fullAssetPath: string;

      // Handle special case for mcp.svg which is in the root dist directory
      if (assetPath === 'mcp.svg') {
        fullAssetPath = path.join(inspectorPath, 'mcp.svg');
      } else {
        fullAssetPath = path.join(inspectorPath, 'assets', assetPath);
      }

      if (!fs.existsSync(fullAssetPath)) {
        logger.debug(`Asset not found: ${fullAssetPath}`);
        return reply.status(404).send('Asset not found');
      }

      const content = fs.readFileSync(fullAssetPath);
      const ext = path.extname(assetPath);

      // Set appropriate content type
      if (ext === '.js') {
        reply.type('application/javascript');
      } else if (ext === '.css') {
        reply.type('text/css');
      } else if (ext === '.svg') {
        reply.type('image/svg+xml');
      }

      reply.send(content);
    } catch (error) {
      logger.error('Failed to serve MCP Inspector asset:', error);
      reply.status(500).send('Failed to load asset');
    }
  });

  // MCP Proxy endpoints - forward requests to the actual MCP server

  // Health check
  fastify.get('/mcp-proxy/health', async (request, reply) => {
    reply.send({ status: 'ok' });
  });

  // Config endpoint
  fastify.get('/mcp-proxy/config', async (request, reply) => {
    reply.send({
      defaultEnvironment: process.env,
      defaultCommand: '',
      defaultArgs: '',
    });
  });

  // SSE connection for stdio transport
  fastify.get('/mcp-proxy/stdio', async (request, reply) => {
    try {
      // Set SSE headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      });

      // Send initial connection event
      reply.raw.write('data: {"jsonrpc":"2.0","method":"notifications/initialized","params":{}}\n\n');

      // Forward to MCP server (simplified - in a real implementation, you'd establish a proper MCP connection)
      logger.info('MCP Inspector connected via SSE');

      // Keep connection alive
      const keepAlive = setInterval(() => {
        reply.raw.write(': keepalive\n\n');
      }, 30000);

      request.raw.on('close', () => {
        clearInterval(keepAlive);
        logger.info('MCP Inspector SSE connection closed');
      });

    } catch (error) {
      logger.error('Failed to establish SSE connection:', error);
      reply.status(500).send({ error: 'Failed to establish SSE connection' });
    }
  });

  // HTTP POST for MCP messages
  fastify.post('/mcp-proxy/mcp', async (request, reply) => {
    try {
      // Forward the request to the actual MCP server
      const response = await fetch(`${mcpServerUrl}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...request.headers,
        },
        body: JSON.stringify(request.body),
      });

      const responseData = await response.text();

      reply
        .status(response.status)
        .headers(Object.fromEntries(response.headers.entries()))
        .send(responseData);

    } catch (error) {
      logger.error('Failed to proxy MCP request:', error);
      reply.status(500).send({ error: 'Failed to proxy MCP request' });
    }
  });

  // Message endpoint for SSE
  fastify.post('/mcp-proxy/message', async (request, reply) => {
    try {
      // Handle SSE message posting
      logger.debug('Received SSE message:', request.body);
      reply.send({ status: 'ok' });
    } catch (error) {
      logger.error('Failed to handle SSE message:', error);
      reply.status(500).send({ error: 'Failed to handle message' });
    }
  });

  done();
}

/**
 * Find the MCP Inspector path from npm package
 */
function findMCPInspectorPath(): string | null {
  // Get the extension root directory from the environment or use current working directory
  const extensionRoot = process.env.CLAY_EXTENSION_ROOT || process.cwd();

  const possiblePaths: string[] = [];

  // Try require.resolve first (works in development)
  try {
    const packagePath = require.resolve('@modelcontextprotocol/inspector/package.json');
    const packageDir = path.dirname(packagePath);
    possiblePaths.push(path.join(packageDir, 'client', 'dist'));
  } catch {
    // Ignore error, will try other paths
  }

  // Add other possible paths
  possiblePaths.push(
    // Extension scenario - bundled UI files (preferred for production)
    path.join(extensionRoot, 'dist', 'mcp-inspector-ui'),
    path.resolve(__dirname, '..', '..', 'mcp-inspector-ui'),

    // Development scenario - workspace root
    path.join(extensionRoot, 'node_modules', '@modelcontextprotocol', 'inspector', 'client', 'dist'),

    // Extension scenario - relative to extension root
    path.join(extensionRoot, 'dist', 'node_modules', '@modelcontextprotocol', 'inspector', 'client', 'dist'),

    // Extension scenario - relative to current file (compiled)
    path.resolve(__dirname, '..', '..', '..', 'node_modules', '@modelcontextprotocol', 'inspector', 'client', 'dist'),

    // Alternative extension scenario
    path.resolve(__dirname, '..', '..', 'node_modules', '@modelcontextprotocol', 'inspector', 'client', 'dist'),

    // VS Code extension installation
    path.resolve(__dirname, '..', '..', '..', '..', 'node_modules', '@modelcontextprotocol', 'inspector', 'client', 'dist')
  );

  logger.debug('Searching for MCP Inspector in paths:', possiblePaths);
  logger.debug('Extension root:', extensionRoot);
  logger.debug('Current working directory:', process.cwd());
  logger.debug('__dirname:', __dirname);

  for (const possiblePath of possiblePaths) {
    const indexPath = path.join(possiblePath, 'index.html');
    logger.debug(`Checking path: ${indexPath}`);
    if (fs.existsSync(indexPath)) {
      logger.info(`Found MCP Inspector at: ${possiblePath}`);
      return possiblePath;
    }
  }

  logger.error('MCP Inspector not found in any of the searched paths');
  logger.error('Searched paths:', possiblePaths);
  return null;
}

/**
 * Generate the MCP Inspector HTML with proper configuration
 */
function getMCPInspectorHTML(mcpServerUrl: string): string {
  const inspectorPath = findMCPInspectorPath();

  if (!inspectorPath) {
    return `
      <!DOCTYPE html>
      <html>
        <head><title>MCP Inspector - Error</title></head>
        <body>
          <h1>MCP Inspector Not Found</h1>
          <p>The MCP Inspector package could not be found. Please ensure it's installed:</p>
          <pre><code>npm install @modelcontextprotocol/inspector</code></pre>
          <p>Working directory: ${process.cwd()}</p>
          <p>Check the server logs for more details about the search paths.</p>
        </body>
      </html>
    `;
  }

  const indexPath = path.join(inspectorPath, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');

  // Update asset paths to use the gateway server
  html = html.replace(/src="\/assets\//g, 'src="/mcp-inspector/assets/');
  html = html.replace(/href="\/assets\//g, 'href="/mcp-inspector/assets/');
  html = html.replace(/src="\.\/assets\//g, 'src="/mcp-inspector/assets/');
  html = html.replace(/href="\.\/assets\//g, 'href="/mcp-inspector/assets/');
  html = html.replace(/href="\/mcp\.svg"/g, 'href="/mcp-inspector/assets/mcp.svg"');

  // Configure the MCP Inspector to use our proxy endpoints
  html = html.replace(
    /<\/head>/,
    `
    <script>
      // Configure MCP Inspector to use gateway proxy
      window.MCP_PROXY_URL = window.location.origin + '/mcp-proxy';
      window.MCP_SERVER_URL = '${mcpServerUrl}';
    </script>
    </head>`
  );

  return html;
}
