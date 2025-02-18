import path from "path";
import type { Configuration } from "webpack";
import { plugins } from "./webpack.plugins";
import { rules } from "./webpack.rules";

rules.push({
  test: /\.css$/,
  use: [{ loader: "style-loader" }, { loader: "css-loader" }],
});

rules.push(
  {
    test: /\.tsx?$/,
    include: [path.resolve(__dirname, "src")],
    loader: "babel-loader",
    resolve: {
      extensions: [".js", ".jsx", ".json", ".ts", ".tsx"],
    },
  },
  {
    // loads .html files
    test: /\.(html)$/,
    include: [path.resolve(__dirname, "src")],
    use: {
      loader: "html-loader",
    },
  },
  {
    // loads .css files
    test: /\.css$/,
    include: [path.resolve(__dirname, "src")],
    use: ["style-loader", "css-loader", "postcss-loader"],
  },
);

plugins.push(
  new HtmlWebpackPlugin({
    template: path.resolve(__dirname, "app/src/index.html"),
    filename: "index.html",
  }),
);
export const rendererConfig: Configuration = {
  module: {
    rules,
  },
  plugins,
  resolve: {
    extensions: [".js", ".ts", ".jsx", ".tsx"],
  },
};
