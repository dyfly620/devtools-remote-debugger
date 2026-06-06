const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { VueLoaderPlugin } = require('vue-loader');
const AutoImport = require('unplugin-auto-import/webpack');
const Components = require('unplugin-vue-components/webpack');
const { ElementPlusResolver } = require('unplugin-vue-components/resolvers');
const Dotenv = require('dotenv-webpack');

const cwd = process.cwd();

module.exports = [
  {
    mode: 'production',
    entry: './src/client/cdp/index.ts',
    output: {
      filename: 'cdp.js',
      path: path.resolve(cwd, './dist'),
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.js$/,
          loader: 'babel-loader',
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.js'],
    },
    plugins: [
      new Dotenv({
        path: path.resolve(cwd, '.env'),
      }),
    ],
  },
  {
    mode: 'production',
    entry: './src/client/page/app.ts',
    output: {
      filename: 'index.js',
      path: path.resolve(cwd, './dist/page'),
      publicPath: './dist/page'
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.vue$/,
          loader: 'vue-loader',
        },
        {
          test: /\.css$/,
          use: [MiniCssExtractPlugin.loader, 'css-loader']
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.js', '.vue', '.json'],
    },
    plugins: [
      new Dotenv({
        path: path.resolve(cwd, '.env'),
      }),
      new VueLoaderPlugin(),
      new MiniCssExtractPlugin({
        filename: 'index.css'
      }),
      new HtmlWebpackPlugin({
        template: './src/client/page/index.html',
        filename: 'index.html'
      }),
      AutoImport({
        resolvers: [ElementPlusResolver()],
      }),
      Components({
        resolvers: [ElementPlusResolver()],
      }),
    ]
  }
];
