const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Compile the extension
console.log('Compiling extension...');
const compileProcess = spawn('npm', ['run', 'compile'], {
  stdio: 'inherit'
});

compileProcess.on('close', (code) => {
  if (code !== 0) {
    console.error(`Compilation failed with code ${code}`);
    process.exit(code);
  }

  console.log('Compilation successful!');
  
  // Package the extension
  console.log('Packaging extension...');
  const packageProcess = spawn('npm', ['run', 'vsce:package'], {
    stdio: 'inherit'
  });
  
  packageProcess.on('close', (code) => {
    if (code !== 0) {
      console.error(`Packaging failed with code ${code}`);
      process.exit(code);
    }
    
    console.log('Extension packaged successfully!');
    
    // Find the VSIX file
    const files = fs.readdirSync('.');
    const vsixFile = files.find(file => file.endsWith('.vsix'));
    
    if (vsixFile) {
      console.log(`VSIX file created: ${vsixFile}`);
      console.log('You can install this extension in VSCode by:');
      console.log('1. Opening VSCode');
      console.log('2. Going to the Extensions view (Ctrl+Shift+X / Cmd+Shift+X)');
      console.log('3. Clicking on the "..." menu in the top-right corner');
      console.log('4. Selecting "Install from VSIX..."');
      console.log(`5. Navigating to and selecting the ${vsixFile} file`);
    } else {
      console.log('VSIX file not found. Check for errors in the packaging process.');
    }
  });
});
