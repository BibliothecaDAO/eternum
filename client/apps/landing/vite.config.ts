import svgr from "@svgr/rollup";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig, loadEnv } from "vite";
import mkcert from "vite-plugin-mkcert";
import topLevelAwait from "vite-plugin-top-level-await";
import wasm from "vite-plugin-wasm";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [mkcert(), svgr(), TanStackRouterVite(), react(), wasm(), topLevelAwait()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@/assets": path.resolve(__dirname, "../../public/assets"),
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
    optimizeDeps: {
      include: ["../../contracts/game/manifest_*.json", "../../contracts/common/addresses/*.json"],
    },
    publicDir: "../../common/public",
  };
});
