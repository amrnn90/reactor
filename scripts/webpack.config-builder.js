const path = require("path");
const webpack = require("webpack");
const HtmlWebPackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const TerserWebpackPlugin = require("terser-webpack-plugin");
const OptimizeCssAssetsPlugin = require("optimize-css-assets-webpack-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");
const FriendlyErrorsWebpackPlugin = require("friendly-errors-webpack-plugin");
const webpackMerge = require("webpack-merge");

module.exports = ({
  srcPath,
  entry,
  outputAbsPath,
  jsBundleName,
  cssBundleName,
  indexTemplate,
  staticPath,
  proxies,
  context,
}) => {
  const mode = process.env.NODE_ENV || "development";

  const getDevServerProxy = proxies => {
    const proxy = {};
    proxies.forEach(([from, target]) => {
      proxy[from] = {
        target: target,
        bypass: function(req, res) {
          /** serve assets by webpack-dev-server */
          if (req.originalUrl.match(/\/(js|images|fonts|static)\//)) {
            return req.originalUrl;
          }

          /** in development styles are inlined by JS, so just return nothing for css file requests */
          if (req.originalUrl.match(/\/css\/.*\.css/)) {
            res.type("text/css");
            res.send("");
            return;
          }

          /** else proxy */
          return null;
        },
      };
    });

    return proxy;
  };

  const conditionalPlugins = () => {
    const plugins = [];
    if (staticPath) {
      plugins.push(
        new CopyPlugin([
          { from: path.join(srcPath, staticPath), to: "./static" },
        ])
      );
    }

    if (indexTemplate) {
      plugins.push(
        new HtmlWebPackPlugin({
          template: path.join(srcPath, indexTemplate),
          filename: "./index.html",
        })
      );
    }

    return {
      plugins,
    };
  };

  const prodConfig = () => ({
    devtool: "source-map",
    module: {
      rules: [
        {
          test: /\.(css|s[ac]ss)$/,
          use: [
            MiniCssExtractPlugin.loader,
            "css-loader",
            "postcss-loader",
            "sass-loader",
          ],
        },
      ],
    },
    plugins: [
      new CleanWebpackPlugin({
        cleanOnceBeforeBuildPatterns: [
          "js/**/*",
          "css/**/*",
          "images/**/*",
          "fonts/**/*",
          "static/**/*",
        ],
      }),
      new MiniCssExtractPlugin({
        filename: `css/${cssBundleName}`,
      }),
    ],
  });

  const devConfig = () => ({
    devtool: "source-map",
    module: {
      rules: [
        {
          test: /\.(css|s[ac]ss)$/,
          use: ["style-loader", "css-loader", "postcss-loader", "sass-loader"],
        },
      ],
    },
  });

  return webpackMerge(
    {
      mode: mode,
      context: context,
      entry: path.join(srcPath, entry),
      output: {
        path: outputAbsPath,
        publicPath: "/",
        filename: `js/${jsBundleName}`,
        chunkFilename: "[name].js",
      },
      module: {
        rules: [
          {
            test: /.jsx?$/,
            exclude: /node_modules/,
            use: [
              {
                loader: "babel-loader",
              },
              "eslint-loader",
            ],
          },
          {
            test: /\.(png|jpe?g|gif)$/i,
            use: {
              loader: "url-loader",
              options: {
                limit: 8192,
                name: "images/[name].[hash:8].[ext]",
              },
            },
          },
          {
            test: /\.svg$/,
            use: {
              loader: "@svgr/webpack",
              options: {},
            },
          },
          {
            test: /\.(eot|otf|ttf|woff|woff2)$/,
            loader: "file-loader",
            options: {
              name: "fonts/[name].[hash:8].[ext]",
            },
          },
        ],
      },
      plugins: [
        new webpack.DefinePlugin({
          "process.env.NODE_ENV": JSON.stringify(mode),
        }),
        new webpack.ProgressPlugin(),
        new FriendlyErrorsWebpackPlugin(),
      ],
      optimization: {
        minimize: mode === "production",
        minimizer: [
          new TerserWebpackPlugin({
            extractComments: false,
          }),
          new OptimizeCssAssetsPlugin(),
        ],
      },
      resolve: {
        extensions: [".js", ".jsx"],
        alias: {
          "react-dom": "@hot-loader/react-dom",
        },
      },
      devtool: "source-map",
      stats: {
        modules: false,
        children: false,
        hash: false,
        entrypoints: false,
        excludeAssets: [/hot-update/],
        colors: true,
      },
      devServer: {
        compress: true,
        historyApiFallback: true,
        open: true,
        overlay: true,
        host: "localhost",
        port: 3000,
        /** check out proxy settings */
        proxy: getDevServerProxy(proxies),
      },
    },
    conditionalPlugins(),
    mode == "development" ? devConfig() : prodConfig()
  );
};
