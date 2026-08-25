import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
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
    tanstackStart({}),
    nitro(),
    viteReact(),
    svgr({
      include: "**/*.svg?react",
    }),
    tailwindcss(),
  ],
  build: {
    chunkSizeWarningLimit: 1000,
    target: "esnext",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("react-markdown") ||
            id.includes("remark-gfm") ||
            id.includes("rehype-raw") ||
            id.includes("rehype-sanitize")
          ) {
            return "markdown-vendors";
          }

          if (id.includes("recharts")) {
            return "charts-vendors";
          }

          return undefined;
        },
      },
    },
  },
  optimizeDeps: {
    include: ["@realms-world/db", "starknet", "@starknet-start/react", "zod"],
  },
  ssr: {
    noExternal: ["@realms-world/db", "@realms-world/chain", "zod"],
    external: ["@walletconnect/time"],
  },
});
