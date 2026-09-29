import { defineConfig } from "tsup";

export default defineConfig({
  // classify-transaction-error is a subpath entry (see package.json "./errors"
  // export): the game client imports the error extractor directly so pulling it
  // never evaluates the package barrel, which loads transaction execution and queueing. The module is stateless, so esm
  // code-splitting keeping it one shared chunk is hygiene, not correctness.
  entry: ["src/index.ts", "src/classify-transaction-error.ts"],
  target: "esnext",
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  minify: true,
});
