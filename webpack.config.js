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
    libraryTarget: 'commonjs2'
  },
  externals: {
    vscode: 'commonjs vscode'
  },
  resolve: {
    extensions: ['.ts', '.js']
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
            }
          }
        ]
      }
    ]
  },
  optimization: {
    minimize: isProduction,
    minimizer: [new TerserPlugin({
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
    })],
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
};

module.exports = config;
