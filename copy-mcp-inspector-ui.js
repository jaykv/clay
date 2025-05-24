#!/usr/bin/env node

/**
 * Copy only the essential MCP Inspector UI files to minimize extension size
 * This avoids including the full package with all its dependencies
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Source and destination paths
const sourceInspectorPath = path.join(__dirname, 'node_modules', '@modelcontextprotocol', 'inspector', 'client', 'dist');
const destInspectorPath = path.join(__dirname, 'dist', 'mcp-inspector-ui');

console.log('Copying MCP Inspector UI files...');

// Check if source exists
if (!fs.existsSync(sourceInspectorPath)) {
  console.error('❌ MCP Inspector source not found. Please run: npm install @modelcontextprotocol/inspector');
  process.exit(1);
}

// Create destination directory
if (!fs.existsSync(destInspectorPath)) {
  fs.mkdirSync(destInspectorPath, { recursive: true });
} else {
  // Clean existing directory
  execSync(`rm -rf "${destInspectorPath}"/*`, { stdio: 'inherit' });
}

// Copy only the essential UI files
try {
  console.log(`Copying from: ${sourceInspectorPath}`);
  console.log(`Copying to: ${destInspectorPath}`);
  
  // Copy all files from the dist directory
  execSync(`cp -R "${sourceInspectorPath}"/* "${destInspectorPath}"/`, { stdio: 'inherit' });
  
  console.log('✅ MCP Inspector UI files copied successfully');
  
  // Show what was copied
  const files = fs.readdirSync(destInspectorPath);
  console.log('Copied files:', files);
  
  // Check size
  const sizeOutput = execSync(`du -sh "${destInspectorPath}"`, { encoding: 'utf8' });
  console.log(`Total size: ${sizeOutput.trim()}`);
  
} catch (error) {
  console.error('❌ Failed to copy MCP Inspector UI files:', error.message);
  process.exit(1);
}

console.log('✅ Done!');