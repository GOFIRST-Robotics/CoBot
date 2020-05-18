const path = require('path');

module.exports = {
  // mode: 'production', // This is signaled by -p flag in build script
  entry: './src/index.js',
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist'),
  },
  resolve: {
    extensions: ['.js', '.jsx']
  },
  devServer: {
    contentBase: './src',
    publicPath: './dist',
  },
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: path.resolve(__dirname, '/node_modules'),
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
            plugins: [["@babel/plugin-proposal-class-properties", {"loose": true}]]
          }
        }
      }
    ]
  }
};
