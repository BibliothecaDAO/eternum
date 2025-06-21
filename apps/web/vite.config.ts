import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig } from "vite";
import svgr from "vite-plugin-svgr";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    tsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tanstackStart({
      target: "vercel",
    }),
    svgr({
      include: "**/*.svg?react",
    }),
  ],
  optimizeDeps: {
    force: false,
    include: ["@noble/ciphers"],
  },
  ssr: {
    noExternal: ["@noble/ciphers", "lossless-json"],
  },
});
