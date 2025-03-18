import { defineConfig } from "@tanstack/react-start/config";
import svgr from "vite-plugin-svgr";
import viteTsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  tsr: {
    // https://github.com/TanStack/router/discussions/2863#discussioncomment-12458714
    appDirectory: "./src",
  },
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
        include: "**/*.svg?react",
      }),
    ],
  },
});
