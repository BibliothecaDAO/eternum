import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import { defineConfig } from "@tanstack/start/config";
import reactRefresh from "@vitejs/plugin-react";
import { createApp } from "vinxi";
//import tsconfigPaths from "vite-tsconfig-paths";
import svgr from "vite-plugin-svgr";
import viteTsConfigPaths from "vite-tsconfig-paths";
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
    plugins: [
      viteTsConfigPaths({
        projects: ["./tsconfig.json"],
      }),
    ],
  },

  routers: {
    client: {
      vite: {
        plugins: [
          reactRefresh(),
          viteTsConfigPaths({
          projects: ["./tsconfig.json"],
        }),
        svgr({
          // svgr options: https://react-svgr.com/docs/options/
        }),
        tailwindcss(),

        ],
      },
    },
  },
});
