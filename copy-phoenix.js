const fs = require('fs');
const path = require('path');

// Copy phoenix.pyz to the dist directory for packaging
const sourceFile = path.join(__dirname, 'phoenix.pyz');
const destFile = path.join(__dirname, 'dist', 'phoenix.pyz');

if (fs.existsSync(sourceFile)) {
  // Ensure dist directory exists
  const distDir = path.dirname(destFile);
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }
  
  // Copy the file
  fs.copyFileSync(sourceFile, destFile);
  console.log(`Copied phoenix.pyz to ${destFile}`);
} else {
  console.warn('Warning: phoenix.pyz not found. Run "python scripts/build-phoenix-simple.py" first.');
}
