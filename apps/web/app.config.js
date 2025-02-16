import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import reactRefresh from "@vitejs/plugin-react";
import { createApp } from "vinxi";
//import tsconfigPaths from "vite-tsconfig-paths";
import svgr from "vite-plugin-svgr";
import viteTsConfigPaths from "vite-tsconfig-paths";

export default createApp({
  server: {
    preset: "vercel", // change to 'node' or 'bun' or anyof the supported presets for nitro (nitro.unjs.io)
    experimental: {
      asyncContext: true,
    },
    esbuild: {
      options: {
        target: "es2022",
      },
    },
  },
  routers: [
    {
      type: "static",
      name: "public",
      dir: "./public",
    },
    {
      type: "http",
      name: "trpc",
      base: "/trpc",
      handler: "./trpc-server.handler.ts",
      target: "server",
      plugins: () => [],
    },
    {
      type: "http",
      name: "api",
      base: "/api",
      handler: "./api/index.ts",
      target: "server",
      plugins: () => [],
    },
    {
      type: "spa",
      name: "client",
      handler: "./index.html",
      target: "browser",
      plugins: () => [
        TanStackRouterVite({
          routesDirectory: "./app/routes",
          generatedRouteTree: "./app/routeTree.gen.ts",
          autoCodeSplitting: true,
        }),
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
  ],
});
