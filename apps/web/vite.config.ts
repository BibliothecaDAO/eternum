import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
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
      customViteSolidPlugin: true,
    }),
    viteReact(),
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
