import { defineConfig } from "tsup";
import { tsupConfig } from "../../tsup.config";

export default defineConfig({
  ...tsupConfig,
  minify: false,
  splitting: false,
  bundle: false,
});
