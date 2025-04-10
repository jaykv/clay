const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Define the dependencies we need to include
const dependencies = [
  'chokidar',
  'fsevents',
  'glob',
  'js-yaml',
  '@modelcontextprotocol/sdk',
  'node-fetch',
  'zod',
  'express',
  'readdirp',
  'fastify',
  '@fastify/cors',
  '@fastify/http-proxy',
  '@fastify/sensible',
  '@fastify/static'
];

// Create a temporary package.json for installing only the required dependencies
const tempPackageJson = {
  name: 'clay-dependencies',
  version: '1.0.0',
  dependencies: {}
};

// Read the main package.json to get the dependency versions
const mainPackageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// Add the dependencies with their versions
dependencies.forEach(dep => {
  if (mainPackageJson.dependencies[dep]) {
    tempPackageJson.dependencies[dep] = mainPackageJson.dependencies[dep];
  } else {
    console.warn(`Warning: Dependency ${dep} not found in package.json`);
  }
});

// Create a temp directory
const tempDir = path.join(__dirname, 'temp-deps');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

// Write the temporary package.json
fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(tempPackageJson, null, 2));

// Install the dependencies
console.log('Installing dependencies...');
execSync('npm install --production', { cwd: tempDir, stdio: 'inherit' });

// Create the node_modules directory in the extension
const extensionNodeModulesDir = path.join(__dirname, 'dist', 'node_modules');
if (!fs.existsSync(extensionNodeModulesDir)) {
  fs.mkdirSync(extensionNodeModulesDir, { recursive: true });
}

// Copy all node_modules to the extension
console.log('Copying all node_modules to extension...');
const srcNodeModules = path.join(tempDir, 'node_modules');

// Remove existing node_modules directory if it exists
if (fs.existsSync(extensionNodeModulesDir)) {
  console.log('Removing existing node_modules directory...');
  execSync(`rm -rf "${extensionNodeModulesDir}"`, { stdio: 'inherit' });
}

// Create the destination directory
fs.mkdirSync(extensionNodeModulesDir, { recursive: true });

// Copy all node_modules
console.log('Copying node_modules...');
execSync(`cp -R "${srcNodeModules}"/* "${extensionNodeModulesDir}"`, { stdio: 'inherit' });
console.log('Copied all node_modules');

// Clean up
console.log('Cleaning up...');
execSync(`rm -rf "${tempDir}"`, { stdio: 'inherit' });

console.log('Done!');
