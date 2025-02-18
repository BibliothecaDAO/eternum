import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "@tanstack/start/config";
import svgr from "vite-plugin-svgr";
import viteTsConfigPaths from "vite-tsconfig-paths";

// Create a require function compatible with ESM
const require = createRequire(import.meta.url);

// Compute __filename and __dirname in ESM.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve the directory of the aliased package using its package.json.
const starknetAlias = path.dirname(
  require.resolve("@starknet-io/types-js/package.json"),
);

console.log(
  "Aliasing 'starknet-types-07' to",
  path.resolve(__dirname, "starknet-types-07/index.mjs"),
);

export default defineConfig({
  server: {
    preset: "vercel", // change to 'node' or 'bun' or anyof the supported presets for nitro (nitro.unjs.io)
    experimental: {
      asyncContext: true,
    },
    esbuild: {
      options: {
        target: "esnext",
      },
    },
  },
  vite: {
    ssr: { noExternal: ["starknet-types-07"] },
    optimizeDeps: {
      include: ["starknet-types-07"],
    },
    resolve: {
      alias: {
        // Optionally you can keep this alias for your own source, but now it may not be needed:
        // "starknet-types-07": path.resolve(__dirname, "starknet-types-07/index.mjs"),
      },
    },
    plugins: [
      viteTsConfigPaths({
        projects: ["./tsconfig.json"],
      }),
      svgr({
        // Additional svgr options if needed
      }),
    ],
  },
});
