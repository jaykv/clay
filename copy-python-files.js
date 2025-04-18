const fs = require('fs');
const path = require('path');

// Define source and destination paths
const pythonPath = path.join(__dirname, 'src', 'server', 'mcp', 'extensions', 'python');

const pythonDistPath = path.join(__dirname, 'dist', 'python');

if (!fs.existsSync(pythonDistPath)) {
  fs.mkdirSync(pythonDistPath, { recursive: true });
}

// Copy Python folder to the dist directory
console.log('Copying Python folder to dist directory...');
fs.promises.cp(pythonPath, pythonDistPath, { recursive: true });

console.log('Python files copied successfully!');
