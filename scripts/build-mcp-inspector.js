#!/usr/bin/env node

/**
 * This script downloads and builds the MCP Inspector UI for integration with the Clay extension.
 * It clones the MCP Inspector repository, builds the client, and copies the necessary files to the extension.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const MCP_INSPECTOR_REPO = 'https://github.com/modelcontextprotocol/inspector.git';
const TEMP_DIR = path.join(__dirname, '../.temp');
const MCP_INSPECTOR_DIR = path.join(TEMP_DIR, 'inspector');
const OUTPUT_DIR = path.join(__dirname, '../mcp-inspector');

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log('Building MCP Inspector UI for Clay extension...');

try {
  // Clone the repository if it doesn't exist
  if (!fs.existsSync(MCP_INSPECTOR_DIR)) {
    console.log(`Cloning MCP Inspector repository from ${MCP_INSPECTOR_REPO}...`);
    execSync(`git clone ${MCP_INSPECTOR_REPO} ${MCP_INSPECTOR_DIR}`, { stdio: 'inherit' });
  } else {
    console.log('MCP Inspector repository already exists, pulling latest changes...');
    execSync(`cd ${MCP_INSPECTOR_DIR} && git pull`, { stdio: 'inherit' });
  }

  // Install dependencies
  console.log('Installing dependencies...');
  execSync(`cd ${MCP_INSPECTOR_DIR} && npm install`, { stdio: 'inherit' });

  // Build the client
  console.log('Building MCP Inspector client...');
  execSync(`cd ${MCP_INSPECTOR_DIR} && cd client && npm run build`, { stdio: 'inherit' });

  // Copy the built files to the output directory
  console.log(`Copying built files to ${OUTPUT_DIR}...`);
  
  // Clear the output directory first
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  
  // Copy the client dist directory
  const clientDistDir = path.join(MCP_INSPECTOR_DIR, 'client', 'dist');
  execSync(`cp -R ${clientDistDir}/* ${OUTPUT_DIR}`, { stdio: 'inherit' });

  // Create a custom index.html file that integrates with VS Code
  console.log('Creating custom index.html for VS Code integration...');
  
  // Read the original index.html
  const indexHtmlPath = path.join(OUTPUT_DIR, 'index.html');
  let indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  
  // Add VS Code integration script
  const vscodeScript = `
    <!-- VS Code Integration -->
    <script>
      // Check if we're running in VS Code
      const isVSCode = typeof acquireVsCodeApi === 'function';
      
      if (isVSCode) {
        // Initialize VS Code API
        const vscode = acquireVsCodeApi();
        
        // Listen for MCP server status changes
        window.addEventListener('mcpServerStatusChanged', (event) => {
          const { status, config } = event.detail;
          console.log('MCP server status changed:', status, config);
          
          // If the server is running, automatically connect to it
          if (status === 'running') {
            // The MCP_SERVER_URL global variable is set by the extension
            console.log('Connecting to MCP server at:', window.MCP_SERVER_URL);
            
            // Wait for the app to initialize
            setTimeout(() => {
              // Find the server URL input field and set its value
              const serverUrlInput = document.querySelector('input[placeholder*="server"]');
              if (serverUrlInput) {
                serverUrlInput.value = window.MCP_SERVER_URL;
                
                // Find the connect button and click it
                const connectButton = document.querySelector('button:not([disabled]):not([aria-disabled="true"])');
                if (connectButton) {
                  connectButton.click();
                }
              }
            }, 1000);
          }
        });
        
        // Send a message to get the current server status
        vscode.postMessage({ command: 'getServerStatus' });
      }
    </script>
  `;
  
  // Insert the script before the closing body tag
  indexHtml = indexHtml.replace('</body>', `${vscodeScript}\n</body>`);
  
  // Write the modified index.html
  fs.writeFileSync(indexHtmlPath, indexHtml);

  console.log('MCP Inspector UI built successfully!');
} catch (error) {
  console.error('Error building MCP Inspector UI:', error);
  process.exit(1);
}
