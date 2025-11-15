import svgr from "@svgr/rollup";
import react from "@vitejs/plugin-react";
import path, { resolve } from "path";
import { visualizer } from "rollup-plugin-visualizer";
import { ConfigEnv, defineConfig, PluginOption, UserConfig } from "vite";
import mkcert from "vite-plugin-mkcert";
import { VitePWA } from "vite-plugin-pwa";
import topLevelAwait from "vite-plugin-top-level-await";
import wasm from "vite-plugin-wasm";

// https://vitejs.dev/config/
export default defineConfig(({ command }: ConfigEnv): UserConfig => {
  const isServe = command === "serve";
  const isBuild = command === "build";
  const enableAnalyzer = process.env.ANALYZE === "true";

  const plugins = [svgr({ dimensions: false, svgo: false, typescript: true }), react()];

  if (isServe) {
    plugins.unshift(mkcert() as any);
  }

  plugins.push(wasm());
  plugins.push(topLevelAwait() as any);

  if (isBuild) {
    plugins.push(
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
      }) as any,
    );
  }

  if (enableAnalyzer) {
    plugins.push(
      visualizer({
        filename: "dist/bundle-analysis.html",
        open: false,
        gzipSize: true,
        brotliSize: true,
        template: "treemap",
      }),
    );
  }

  return {
    plugins: plugins as unknown as PluginOption[],
    resolve: {
      alias: {
        "@/assets": path.resolve(__dirname, "../../public/assets"),
        events: "events",
        "@": path.resolve(__dirname, "./src"),
        "@config": path.resolve(__dirname, "../../../config/utils/utils"),
        "@config-deployer": path.resolve(__dirname, "../../../config/deployer"),
        "@contracts": path.resolve(__dirname, "../../../contracts/utils/utils"),
        "@manifests": path.resolve(__dirname, "../../../contracts/game"),
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
  };
});
