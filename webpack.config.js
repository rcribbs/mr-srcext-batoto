const TerserPlugin = require("terser-webpack-plugin");

module.exports = (env) => ({
    entry: ["./src/index.js"],
    output: {
        path: __dirname + "/dist",
        filename: "index.js",
        library: {
            name: "mangaRightSource",
            type: "umd"
        },
        globalObject: "this",
    },
    module: {
        rules: [
            {
                test: /\.(js|mjs|jsx)$/,
                exclude: /node_modules/,
                use: {
                    loader: "babel-loader"
                }
            }
        ]
    },
    optimization: {
        minimize: env.producion === true,
        minimizer: [
            new TerserPlugin({
                terserOptions: {
                    format: {
                        comments: false,
                    },
                },
                extractComments: false,
            }),
        ],
    },
});
