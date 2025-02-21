import react from "@vitejs/plugin-react";
import path, { resolve } from "path";
import { defineConfig } from "vite";
import mkcert from "vite-plugin-mkcert";
import wasm from "vite-plugin-wasm";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), wasm(), mkcert()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@/assets": path.resolve(__dirname, "../../public/assets"),
      "@config": path.resolve(__dirname, "../../../config/utils/utils"),
    },
  },
  build: {
    target: "esnext",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
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
