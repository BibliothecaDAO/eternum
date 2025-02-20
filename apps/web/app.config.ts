import { defineConfig } from "@tanstack/start/config";
import svgr from "vite-plugin-svgr";
import viteTsConfigPaths from "vite-tsconfig-paths";

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
    externals: { inline: ["starknet-types-07"] },
  },
  vite: {
    ssr: { noExternal: ["starknet-types-07"] },
    optimizeDeps: {
      include: ["starknet-types-07"],
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
