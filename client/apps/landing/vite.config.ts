import svgr from "@svgr/rollup";
import react from "@vitejs/plugin-react";
import path, { resolve } from "path";
import { defineConfig, loadEnv } from "vite";
import mkcert from "vite-plugin-mkcert";
import topLevelAwait from "vite-plugin-top-level-await";
import wasm from "vite-plugin-wasm";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [mkcert(), svgr({ dimensions: false, svgo: false, typescript: true }), react(), wasm(), topLevelAwait()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@/assets": path.resolve(__dirname, "../../public/assets"),
        "@config": path.resolve(__dirname, "../../../config/utils/utils"),
        "@contracts": path.resolve(__dirname, "../../../contracts/utils/utils"),
      },
    },
    server: {
      port: (process.env.PORT as unknown as number) ?? 5174,
      proxy: {
        "/api": {
          target: env.VITE_PUBLIC_TORII + "/graphql",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, "index.html"),
          trade: resolve(__dirname, "trade/index.html"),
          seasonPasses: resolve(__dirname, "season-passes/index.html"),
          mint: resolve(__dirname, "mint/index.html"),
          claim: resolve(__dirname, "claim/index.html"),
        },
      },
    },
    optimizeDeps: {
      include: ["../../contracts/game/manifest_*.json", "../../contracts/common/addresses/*.json"],
    },
    publicDir: "../../public",
  };
});
