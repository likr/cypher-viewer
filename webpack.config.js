const path = require('path')

const options = {
  module: {
    rules: [
      {
        test: /\.js?$/,
        include: [
          path.resolve(__dirname, 'src')
        ],
        use: [
          {
            loader: 'babel-loader',
            options: {
              presets: ['env', 'react']
            }
          }
        ]
      }
    ]
  },
  entry: {
    bundle: './src/index'
  },
  output: {
    path: path.resolve(__dirname, 'public'),
    filename: '[name].js'
  },
  plugins: [
  ],
  devServer: {
    contentBase: path.join(__dirname, 'public'),
    historyApiFallback: true,
    port: 8080
  },
  node: {
    crypto: 'empty',
    path: 'empty',
    fs: 'empty'
  }
}

if (process.env.NODE_ENV !== 'production') {
  Object.assign(options, {
    devtool: 'inline-source-map'
  })
}

module.exports = options
