const esbuild = require('esbuild');
const fs = require('fs');

// Determine if we're in production mode
const isProduction = process.env.NODE_ENV === 'production';

// Define external packages (same as in webpack.config.js)
const externalPackages = [
  'vscode',
  'fsevents',
  'chokidar',
  'node-fetch',
  'ws',
  'express',
  'fastify',
  '@fastify/cors',
  '@fastify/http-proxy',
  '@fastify/sensible',
  '@fastify/static',
  '@fastify/websocket',
  '@modelcontextprotocol/sdk',
];

// Note: We're using the externalPackages array directly in the build options

// Build options
const buildOptions = {
  entryPoints: ['./src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  platform: 'node',
  target: 'node16', // Target Node.js version
  external: externalPackages, // Externalize specific modules
  format: 'cjs', // CommonJS format for VS Code extensions
  sourcemap: !isProduction,
  minify: isProduction,
  metafile: true, // Generate metadata for analysis
  logLevel: 'info',
  define: {
    'process.env.NODE_ENV': isProduction ? '"production"' : '"development"',
  },
  // Handle native modules and other special cases
  plugins: [
    {
      name: 'native-modules',
      setup(build) {
        // Exclude all node_modules
        build.onResolve({ filter: /.*/ }, args => {
          if (args.path.includes('node_modules')) {
            return { external: true };
          }
          return null;
        });
      },
    },
  ],
};

// Watch mode function
const watch = async () => {
  const context = await esbuild.context(buildOptions);
  await context.watch();
  console.log('Watching for changes...');
};

// Build function
const build = async () => {
  try {
    const result = await esbuild.build(buildOptions);

    // Output build stats
    const outputSize = result.metafile
      ? Object.values(result.metafile.outputs).reduce((total, output) => total + output.bytes, 0) /
        1024
      : 0;

    console.log(`Build completed successfully! Output size: ${outputSize.toFixed(2)} KB`);

    // Write metafile for analysis if needed
    if (result.metafile) {
      fs.writeFileSync('dist/meta.json', JSON.stringify(result.metafile));
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
};

// Determine if we're in watch mode
const isWatch = process.argv.includes('--watch');

if (isWatch) {
  watch();
} else {
  build();
}
