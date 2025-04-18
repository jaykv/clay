const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

// Determine if we're in production mode
const isProduction = process.env.NODE_ENV === 'production';

const config = {
  target: 'node',
  mode: isProduction ? 'production' : 'development',
  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
  },
  externals: {
    vscode: 'commonjs vscode',
    // Exclude native modules and problematic modules
    fsevents: 'commonjs fsevents',
    chokidar: 'commonjs chokidar',
    // Add other native modules that might cause issues
    'node-fetch': 'commonjs node-fetch',
    ws: 'commonjs ws',
    express: 'commonjs express',
    fastify: 'commonjs fastify',
    '@fastify/cors': 'commonjs @fastify/cors',
    '@fastify/http-proxy': 'commonjs @fastify/http-proxy',
    '@fastify/sensible': 'commonjs @fastify/sensible',
    '@fastify/static': 'commonjs @fastify/static',
    '@fastify/websocket': 'commonjs @fastify/websocket',
    '@modelcontextprotocol/sdk': 'commonjs @modelcontextprotocol/sdk',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: true, // Faster builds, but no type checking
              experimentalWatchApi: true, // Faster incremental builds
            },
          },
        ],
      },
    ],
  },
  optimization: {
    minimize: isProduction,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: false, // Keep console logs for debugging
            passes: 2, // Multiple passes for better optimization
          },
          mangle: true,
          output: {
            comments: false,
          },
        },
        extractComments: false,
      }),
    ],
    removeAvailableModules: isProduction,
    removeEmptyChunks: isProduction,
    splitChunks: false, // Don't split chunks for VS Code extensions
  },
  devtool: isProduction ? 'nosources-source-map' : 'source-map',
  infrastructureLogging: {
    level: 'log', // Enable logging
  },
  stats: {
    preset: 'normal',
    modules: false,
    chunks: false,
  },
  // Ignore warnings for optional dependencies
  ignoreWarnings: [
    {
      module: /fsevents/,
    },
    {
      module: /chokidar/,
    },
  ],
};

module.exports = config;
