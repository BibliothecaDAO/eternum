import react from "@vitejs/plugin-react";
import path, { resolve } from "path";
import { defineConfig } from "vite";
import mkcert from "vite-plugin-mkcert";
import topLevelAwait from "vite-plugin-top-level-await";
import wasm from "vite-plugin-wasm";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), wasm(), mkcert(), topLevelAwait()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@/assets": path.resolve(__dirname, "../../public/assets"),
      "@config": path.resolve(__dirname, "../../../config/utils/utils"),
      "@contracts": path.resolve(__dirname, "../../../contracts/utils/utils"),
    },
    dedupe: ["@starknet-react/core"],
  },
  build: {
    target: "esnext",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        chat: resolve(__dirname, "chat/index.html"),
        trade: resolve(__dirname, "trade/index.html"),
        realm: resolve(__dirname, "realm/index.html"),
        settings: resolve(__dirname, "settings/index.html"),
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
    exclude: ["js-big-decimal", "@bibliothecadao/eternum"],
  },
});
