const path = require('path');
const webpack = require('webpack');
const webpackMerge = require('webpack-merge');
const baseConfig = require('./config.base');
const config = require('./constant');
const util = require('./util');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer')
  .BundleAnalyzerPlugin;
const CleanWebpackPlugin = require('clean-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const InlineManifestWebpackPlugin = require('inline-manifest-webpack-plugin');
const ParallelUglifyPlugin = require('webpack-parallel-uglify-plugin');
const V8LazyParseWebpackPlugin = require('v8-lazy-parse-webpack-plugin');
const OptimizeCSSPlugin = require('optimize-css-assets-webpack-plugin');
const ReplacePlugin = require('webpack-plugin-replace');
const ServiceWorkerWebpackPlugin = require('serviceworker-webpack-plugin');
const WebpackPwaManifestPlugin = require('webpack-pwa-manifest');

const projectDir = config.projectDir;
const vendorDeps = util.getVendorDependencies();
const HASH_LENGTH = 6;
const MAX_ASSET_SIZE_IN_BYTE = 100000;
const MAX_ENTRY_SIZE_IN_BYTE = 200000;

module.exports = env =>
  webpackMerge.smart(baseConfig, {
    entry: vendorDeps.length > 0 ? { vendor: vendorDeps } : {},
    output: {
      path: config.outputPath,
      publicPath: config.publicPath,
      filename: '[name].[chunkhash:' + HASH_LENGTH + '].js',
      chunkFilename: '[name].app.[chunkhash:' + HASH_LENGTH + '].js',
    },
    module: {
      rules: [
        // sadly we cannot use happypack here as ExtractTextPlugin is not supported https://github.com/amireh/happypack/issues/12
        {
          test: /\.s?css$/,
          use: ExtractTextPlugin.extract({
            use: [
              {
                loader: 'css-loader',
                options: {
                  sourceMap: true,
                  minimize: { discardComments: { removeAll: true } },
                },
              },
              {
                loader: 'postcss-loader',
                options: {
                  plugins: require('postcss-cssnext'),
                },
              },
              'sass-loader',
            ],
          }),
        },
        { test: /\.hbs/, loader: 'handlebars-template-loader' },
      ],
    },
    devtool: 'source-map', // this is to patch ParallelUglifyPlugin as it expects a `devtool` option explicitly but doesn't care what it is
    plugins: [
      new webpack.HashedModuleIdsPlugin(),
      new webpack.optimize.ModuleConcatenationPlugin(),
      new V8LazyParseWebpackPlugin(),
      new webpack.SourceMapDevToolPlugin({
        filename: '[file].map',
        append: '\n//# sourceMappingURL=' + config.rootDomain + '/dist/[url]',
      }),
      new ExtractTextPlugin('app.[contenthash:' + HASH_LENGTH + '].css'),
      // Compress extracted CSS. We are using this plugin so that possible
      // duplicated CSS from different components can be deduped.
      new OptimizeCSSPlugin({
        cssProcessorOptions: {
          safe: true,
        },
      }),
      new webpack.optimize.CommonsChunkPlugin({
        name: 'vendor',
        filename: 'vendor.[chunkhash:' + HASH_LENGTH + '].js',
      }),
      // Separate webpack runtime from vendor. This stop vendor chunk from changing
      // whenever the webpack runtime changes. (webpack runtime will change on every build)
      // IMPORTANT: Manifest chunk need to be declared last to be extracted
      new webpack.optimize.CommonsChunkPlugin({
        name: 'manifest',
        chunks: ['vendor'],
        filename: 'manifest.js',
      }),
      new webpack.optimize.AggressiveMergingPlugin(),
      // strip out babel-helper invariant checks
      new ReplacePlugin({
        include: /babel-helper$/,
        patterns: [
          {
            regex: /throw\s+(new\s+)?(Type|Reference)?Error\s*\(/g,
            value: s => `return;${Array(s.length - 7).join(' ')}(`,
          },
        ],
      }),
      new ParallelUglifyPlugin({
        uglifyJS: {
          mangle: true,
          compress: {
            properties: true,
            keep_fargs: false,
            pure_getters: true,
            collapse_vars: true,
            warnings: false,
            sequences: true,
            dead_code: true,
            drop_debugger: true,
            comparisons: true,
            conditionals: true,
            evaluate: true,
            booleans: true,
            loops: true,
            unused: true,
            hoist_funs: true,
            if_return: true,
            join_vars: true,
            cascade: true,
            drop_console: true,
          },
          output: {
            comments: false,
          },
        },
      }),
      new CleanWebpackPlugin([config.outputPath], {
        root: path.resolve('..'),
        verbose: true,
        dry: false,
      }),
      new HtmlWebpackPlugin({
        hash: false,
        filename: './index.html',
        template: './index.hbs',
        inject: 'body',
        minify: {
          removeComments: true,
          collapseWhitespace: true,
          removeAttributeQuotes: true,
          // more options: https://github.com/kangax/html-minifier#options-quick-reference
        },
        // necessary to consistently work with multiple chunks via CommonsChunkPlugin
        chunksSortMode: 'dependency',
      }),
      new InlineManifestWebpackPlugin({
        name: 'webpackManifest',
      }),
      WebpackPwaManifest,
      new ServiceWorkerWebpackPlugin({
        entry: path.join(projectDir, 'src', 'sw.js'),
        publicPath: '/',
        filename: 'sw.js',
      }),
    ].concat(env.bundleStats ? [new BundleAnalyzerPlugin()] : []),
    performance: {
      maxAssetSize: MAX_ASSET_SIZE_IN_BYTE,
      maxEntrypointSize: MAX_ENTRY_SIZE_IN_BYTE,
      hints: 'warning',
    },
    bail: true,
    recordsPath: path.resolve(projectDir, '.webpack-path-record'),
  });

const WebpackPwaManifest = new WebpackPwaManifestPlugin({
  publicPath: '/', // must be on same origin as live, not CDN
  // Adapted from https://git.garena.com/core-services/beeshop_web/blob/master/mall/templates/home/manifest.json.html
  name: 'My PWA',
  short_name: 'My PWA',
  description: 'My PWA App',
  start_url: '/',
  display: 'standalone',
  background_color: '#ededed',
  theme_color: '#FF5722',
  prefer_related_applications: true,
  icons: [
    {
      src: path.resolve('src/assets/app-icon.png'),
      sizes: [96, 128, 192, 256, 384, 512], // multiple sizes
    },
    {
      src: path.resolve('src/assets/app-icon.png'),
      size: '1024x1024', // you can also use the specifications pattern
    },
  ],
});
