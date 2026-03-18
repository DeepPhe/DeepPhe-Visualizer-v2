const webpack = require("webpack");

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };

      webpackConfig.plugins = [
        ...webpackConfig.plugins,
        new webpack.IgnorePlugin({
          resourceRegExp: /^fs$/,
        }),
      ];

      return webpackConfig;
    },
  },
};
