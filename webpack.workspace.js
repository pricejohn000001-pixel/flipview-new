const path = require('path');
const webpack = require('webpack');
const { getBaseOptions } = require('./scripts/buildOptions');

module.exports = (env, argv) => {
  const baseOptions = getBaseOptions();
  
  return {
    ...baseOptions,
    mode: argv.mode || 'production',
    entry: path.resolve(__dirname, 'src/workspace-standalone.js'),
    output: {
      filename: 'document-workspace.js',
      path: path.resolve(__dirname, 'dist'),
      publicPath: '', // Allow assets to load relative to the script location
      library: {
        type: 'umd',
        name: 'DocumentWorkspace',
      },
    },
    // Remove HtmlWebpackPlugin since we are bundling a library
    plugins: [
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(argv.mode || 'production'),
        'process.env.BACKEND_BASE_URL': JSON.stringify(''), // Will be overridden by window.WORKSPACE_CONFIG
      }),
    ],
    // Ensure all styles are bundled into the JS (style-loader) or a single CSS file
    // The existing baseOptions uses style-loader which is fine for a single-file bundle.
  };
};
