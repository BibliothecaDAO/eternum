import { resolve } from "path";
import { defineConfig } from "vite";
import svgr from "vite-plugin-svgr";

// https://vitejs.dev/config
export default defineConfig({
  plugins: [svgr()],
  resolve: {
    alias: {
      "@public": resolve(__dirname, "public"),
    },
    dedupe: ["react", "react-dom"],
  },
});
