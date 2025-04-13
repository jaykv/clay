const { spawn } = require('child_process');
const path = require('path');

// Compile the extension
console.log('Compiling extension...');
const compileProcess = spawn('npm', ['run', 'compile'], {
  stdio: 'inherit',
});

compileProcess.on('close', code => {
  if (code !== 0) {
    console.error(`Compilation failed with code ${code}`);
    process.exit(code);
  }

  console.log('Compilation successful!');

  // Start the proxy server
  console.log('Starting proxy server...');
  const proxyProcess = spawn('npm', ['run', 'start-proxy'], {
    stdio: 'inherit',
    detached: true,
  });

  proxyProcess.unref();

  // Wait a bit for the proxy server to start
  setTimeout(() => {
    // Start the MCP server
    console.log('Starting MCP server...');
    const mcpProcess = spawn('npm', ['run', 'start-mcp'], {
      stdio: 'inherit',
      detached: true,
    });

    mcpProcess.unref();

    // Wait a bit for the MCP server to start
    setTimeout(() => {
      // Start the registry server
      console.log('Starting registry server...');
      const registryProcess = spawn('npm', ['run', 'start-registry'], {
        stdio: 'inherit',
        detached: true,
      });

      registryProcess.unref();

      console.log('All servers started successfully!');
      console.log('Press Ctrl+C to exit');
    }, 2000);
  }, 2000);
});
