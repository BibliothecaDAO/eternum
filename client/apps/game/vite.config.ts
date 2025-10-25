import svgr from "@svgr/rollup";
import react from "@vitejs/plugin-react";
import path, { resolve } from "path";
import { visualizer } from "rollup-plugin-visualizer";
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
      selfDestroying: true,
      devOptions: {
        enabled: process.env.VITE_PUBLIC_CHAIN === "local",
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 8000000,
        clientsClaim: true,
        skipWaiting: false,
      },
      manifest: {
        name: "Realms",
        short_name: "Realms",
        description: "Glory awaits for those who rule the Hex",
        theme_color: "#F6C297",
        background_color: "#F6C297",
        display: "standalone",
        orientation: "landscape",
        scope: "/",
        start_url: "/",
        icons: [],
      },
    }),
    visualizer({
      filename: "dist/bundle-analysis.html",
      open: false,
      gzipSize: true,
      brotliSize: true,
      template: "treemap", // 'sunburst', 'treemap', 'network'
    }),
  ],
  resolve: {
    alias: {
      "@/assets": path.resolve(__dirname, "../../public/assets"),
      events: "events",
      "@": path.resolve(__dirname, "./src"),
      "@config": path.resolve(__dirname, "../../../config/utils/utils"),
      "@config-deployer": path.resolve(__dirname, "../../../config/deployer"),
      "@contracts": path.resolve(__dirname, "../../../contracts/utils/utils"),
    },
  },
  build: {
    target: "esnext",
    sourcemap: true,
    chunkSizeWarningLimit: 5000,
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
        manualChunks: {
          // Three.js ecosystem - Separate chunk for 3D graphics
          three: ["three", "three-stdlib", "postprocessing"],

          // Blockchain/Dojo ecosystem - Separate chunk for crypto functionality
          blockchain: [
            "@bibliothecadao/dojo",
            "@bibliothecadao/eternum",
            "@bibliothecadao/provider",
            "@bibliothecadao/torii",
            "@bibliothecadao/types",
            "@dojoengine/core",
            "@dojoengine/sdk",
            "@dojoengine/state",
            "@dojoengine/torii-client",
            "@dojoengine/torii-wasm",
            "starknet",
          ],

          // React ecosystem - Core framework chunk
          "react-vendor": ["react", "react-dom", "react-beautiful-dnd", "react-draggable"],

          // UI & Animation libraries
          "ui-libs": ["gsap", "lil-gui", "@tanstack/react-query", "zustand"],

          // OpenTelemetry observability - Can be lazy loaded
          telemetry: [
            "@opentelemetry/api",
            "@opentelemetry/context-zone",
            "@opentelemetry/exporter-trace-otlp-http",
            "@opentelemetry/instrumentation",
            "@opentelemetry/instrumentation-fetch",
            "@opentelemetry/instrumentation-xml-http-request",
            "@opentelemetry/resources",
            "@opentelemetry/sdk-trace-base",
            "@opentelemetry/sdk-trace-web",
            "@opentelemetry/semantic-conventions",
          ],

          // Utilities & Misc
          utils: ["lodash", "uuid", "platform", "buffer", "wouter"],

          // Communication & External APIs
          external: ["socket.io-client", "graphql-request", "@vercel/analytics", "posthog-js"],
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
  publicDir: "../../public",
});
