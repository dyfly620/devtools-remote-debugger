const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { VueLoaderPlugin } = require('vue-loader');
const Dotenv = require('dotenv-webpack');

const cwd = process.cwd();

module.exports = [
  {
    mode: 'development',
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
    devtool: 'inline-source-map',
    plugins: [
      new Dotenv({
        path: path.resolve(cwd, '.env.dev'),
      }),
    ]
  },
  {
    mode: 'development',
    entry: './src/client/page/app.ts',
    output: {
      filename: 'index.js',
      path: path.resolve(cwd, './dist/page'),
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
          use: ['vue-style-loader', 'css-loader']
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.js', '.vue', '.json'],
    },
    devtool: 'eval-source-map',
    devServer: {
      static: {
        directory: path.resolve(cwd, './dist/page/'),
      },
      client: {
        overlay: false,
      },
      host: 'localhost',
      port: 8899,
      open: './index.html'
    },
    plugins: [
      new Dotenv({
        path: path.resolve(cwd, '.env.dev')
      }),
      new VueLoaderPlugin(),
      new HtmlWebpackPlugin({
        template: './src/client/page/index.html',
        filename: 'index.html'
      })
    ]
  }
];
