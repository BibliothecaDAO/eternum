import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig } from "vite";
import svgr from "vite-plugin-svgr";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    tsconfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tanstackStart({
      target: "vercel",
    }),
    svgr({
      include: "**/*.svg?react",
    }),
    tailwindcss(),
  ],
  build: {
    chunkSizeWarningLimit: 1000,
  },
  optimizeDeps: {
    include: ["@realms-world/db"],
  },
});
