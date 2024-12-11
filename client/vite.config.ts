import svgr from "@svgr/rollup";
import react from "@vitejs/plugin-react";
import path, { resolve } from "path";
import { defineConfig } from "vite";
import mkcert from "vite-plugin-mkcert";
import { VitePWA } from "vite-plugin-pwa";
import topLevelAwait from "vite-plugin-top-level-await";
import wasm from "vite-plugin-wasm";
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    mkcert(),
    svgr({ dimensions: false, svgo: false, typescript: true }),
    react(),
    wasm(),
    topLevelAwait(),
    VitePWA({
      devOptions: {
        enabled: process.env.VITE_PUBLIC_DEV === "true",
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 4000000,
        clientsClaim: true,
        skipWaiting: false,
      },
      manifest: {
        name: "Eternum",
        short_name: "Eternum",
        description: "Glory awaits for those who rule the Hex",
        theme_color: "#F6C297",
        background_color: "#F6C297",
        display: "standalone",
        orientation: "landscape",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/images/pwa-64x64.png",
            sizes: "64x64",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/images/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/images/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      events: "events",
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "esnext",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        map: resolve(__dirname, "map/index.html"),
        hex: resolve(__dirname, "hex/index.html"),
      },
      maxParallelFileOps: 2,
      cache: false,
      // external: ["react", "react-dom"],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
        },
        sourcemap: true,
        manualChunks: (id) => {
          if (id.includes("node_modules")) {
            return "vendor";
          }
        },
        inlineDynamicImports: false,
        sourcemapIgnoreList: (relativeSourcePath) => {
          const normalizedPath = path.normalize(relativeSourcePath);
          return normalizedPath.includes("node_modules");
        },
      },
    },
  },
  optimizeDeps: {
    exclude: [
      "js-big-decimal",
      "@bibliothecadao/eternum", // Add your dependency here
    ],
  },
});
