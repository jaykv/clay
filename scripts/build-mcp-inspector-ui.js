#!/usr/bin/env node

/**
 * This script copies only the essential MCP Inspector UI files to the extension bundle.
 * This keeps the extension size small while maintaining full functionality.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const INSPECTOR_ROOT = path.join(__dirname, '..', 'node_modules', '@modelcontextprotocol', 'inspector');
const CLIENT_SOURCE_PATH = path.join(INSPECTOR_ROOT, 'client', 'dist');
const SERVER_SOURCE_PATH = path.join(INSPECTOR_ROOT, 'server', 'build');
const OUTPUT_DIR = path.join(__dirname, '..', 'mcp-inspector-bundle');

console.log('Building MCP Inspector UI for Clay extension...');

try {
  // Check if sources exist
  if (!fs.existsSync(CLIENT_SOURCE_PATH)) {
    throw new Error(`MCP Inspector client not found at ${CLIENT_SOURCE_PATH}. Please run 'npm install' first.`);
  }
  if (!fs.existsSync(SERVER_SOURCE_PATH)) {
    throw new Error(`MCP Inspector server not found at ${SERVER_SOURCE_PATH}. Please run 'npm install' first.`);
  }

  // Ensure output directory exists
  if (fs.existsSync(OUTPUT_DIR)) {
    console.log('Removing existing MCP Inspector bundle directory...');
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Create subdirectories
  const clientOutputDir = path.join(OUTPUT_DIR, 'client');
  const serverOutputDir = path.join(OUTPUT_DIR, 'server');
  fs.mkdirSync(clientOutputDir, { recursive: true });
  fs.mkdirSync(serverOutputDir, { recursive: true });

  // Copy client files (UI assets)
  console.log(`Copying UI files from ${CLIENT_SOURCE_PATH} to ${clientOutputDir}...`);
  execSync(`cp -R "${CLIENT_SOURCE_PATH}"/* "${clientOutputDir}"`, { stdio: 'inherit' });

  // Copy server files
  console.log(`Copying server files from ${SERVER_SOURCE_PATH} to ${serverOutputDir}...`);
  execSync(`cp -R "${SERVER_SOURCE_PATH}"/* "${serverOutputDir}"`, { stdio: 'inherit' });

  // Get the size of copied files
  const stats = execSync(`du -sh "${OUTPUT_DIR}"`, { encoding: 'utf8' });
  console.log(`✅ MCP Inspector bundle built successfully! Size: ${stats.trim()}`);

  console.log('\nFiles copied:');
  console.log('Client files:');
  const clientFiles = fs.readdirSync(clientOutputDir, { recursive: true });
  clientFiles.forEach(file => {
    console.log(`  - client/${file}`);
  });

  console.log('Server files:');
  const serverFiles = fs.readdirSync(serverOutputDir, { recursive: true });
  serverFiles.forEach(file => {
    console.log(`  - server/${file}`);
  });

} catch (error) {
  console.error('❌ Error building MCP Inspector bundle:', error.message);
  process.exit(1);
}
