// vite.config.ts
import svgr from "file:///Users/os/Documents/code/eternum/node_modules/.pnpm/@svgr+rollup@8.1.0_rollup@2.79.2_typescript@5.6.3/node_modules/@svgr/rollup/dist/index.js";
import react from "file:///Users/os/Documents/code/eternum/node_modules/.pnpm/@vitejs+plugin-react@4.3.3_vite@5.4.10_@types+node@20.17.1_terser@5.36.0_/node_modules/@vitejs/plugin-react/dist/index.mjs";
import path, { resolve } from "path";
import { defineConfig } from "file:///Users/os/Documents/code/eternum/node_modules/.pnpm/vite@5.4.10_@types+node@20.17.1_terser@5.36.0/node_modules/vite/dist/node/index.js";
import mkcert from "file:///Users/os/Documents/code/eternum/node_modules/.pnpm/vite-plugin-mkcert@1.17.6_vite@5.4.10_@types+node@20.17.1_terser@5.36.0_/node_modules/vite-plugin-mkcert/dist/mkcert.mjs";
import { VitePWA } from "file:///Users/os/Documents/code/eternum/node_modules/.pnpm/vite-plugin-pwa@0.20.5_@vite-pwa+assets-generator@0.2.6_vite@5.4.10_@types+node@20.17.1_terse_7t7wuoxnr3f3er4wisi3sc5dva/node_modules/vite-plugin-pwa/dist/index.js";
import topLevelAwait from "file:///Users/os/Documents/code/eternum/node_modules/.pnpm/vite-plugin-top-level-await@1.4.4_rollup@2.79.2_vite@5.4.10_@types+node@20.17.1_terser@5.36.0_/node_modules/vite-plugin-top-level-await/exports/import.mjs";
import wasm from "file:///Users/os/Documents/code/eternum/node_modules/.pnpm/vite-plugin-wasm@3.3.0_vite@5.4.10_@types+node@20.17.1_terser@5.36.0_/node_modules/vite-plugin-wasm/exports/import.mjs";
var __vite_injected_original_dirname = "/Users/os/Documents/code/eternum/client";
var vite_config_default = defineConfig({
  plugins: [
    mkcert(),
    svgr({ dimensions: false, svgo: false, typescript: true }),
    react(),
    wasm(),
    topLevelAwait(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: {
        enabled: process.env.VITE_PUBLIC_DEV === "true"
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 4e6
      },
      manifest: {
        name: "Eternum",
        short_name: "Eternum",
        description: "Rule the Hex",
        theme_color: "#000000",
        background_color: "#000000",
        display: "standalone",
        orientation: "landscape",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/images/pwa-64x64.png",
            sizes: "64x64",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: "/images/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: "/images/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      events: "events",
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  },
  build: {
    target: "esnext",
    rollupOptions: {
      input: {
        main: resolve(__vite_injected_original_dirname, "index.html"),
        map: resolve(__vite_injected_original_dirname, "map/index.html"),
        hex: resolve(__vite_injected_original_dirname, "hex/index.html")
      },
      maxParallelFileOps: 2,
      cache: false,
      // external: ["react", "react-dom"],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM"
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
        }
      }
    }
  },
  optimizeDeps: {
    exclude: [
      "js-big-decimal",
      "@bibliothecadao/eternum"
      // Add your dependency here
    ]
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvb3MvRG9jdW1lbnRzL2NvZGUvZXRlcm51bS9jbGllbnRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy9vcy9Eb2N1bWVudHMvY29kZS9ldGVybnVtL2NsaWVudC92aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvb3MvRG9jdW1lbnRzL2NvZGUvZXRlcm51bS9jbGllbnQvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgc3ZnciBmcm9tIFwiQHN2Z3Ivcm9sbHVwXCI7XG5pbXBvcnQgcmVhY3QgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXJlYWN0XCI7XG5pbXBvcnQgcGF0aCwgeyByZXNvbHZlIH0gZnJvbSBcInBhdGhcIjtcbmltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gXCJ2aXRlXCI7XG5pbXBvcnQgbWtjZXJ0IGZyb20gXCJ2aXRlLXBsdWdpbi1ta2NlcnRcIjtcbmltcG9ydCB7IFZpdGVQV0EgfSBmcm9tIFwidml0ZS1wbHVnaW4tcHdhXCI7XG5pbXBvcnQgdG9wTGV2ZWxBd2FpdCBmcm9tIFwidml0ZS1wbHVnaW4tdG9wLWxldmVsLWF3YWl0XCI7XG5pbXBvcnQgd2FzbSBmcm9tIFwidml0ZS1wbHVnaW4td2FzbVwiO1xuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtcbiAgICBta2NlcnQoKSxcbiAgICBzdmdyKHsgZGltZW5zaW9uczogZmFsc2UsIHN2Z286IGZhbHNlLCB0eXBlc2NyaXB0OiB0cnVlIH0pLFxuICAgIHJlYWN0KCksXG4gICAgd2FzbSgpLFxuICAgIHRvcExldmVsQXdhaXQoKSxcbiAgICBWaXRlUFdBKHtcbiAgICAgIHJlZ2lzdGVyVHlwZTogXCJhdXRvVXBkYXRlXCIsXG4gICAgICBkZXZPcHRpb25zOiB7XG4gICAgICAgIGVuYWJsZWQ6IHByb2Nlc3MuZW52LlZJVEVfUFVCTElDX0RFViA9PT0gXCJ0cnVlXCIsXG4gICAgICB9LFxuICAgICAgd29ya2JveDoge1xuICAgICAgICBtYXhpbXVtRmlsZVNpemVUb0NhY2hlSW5CeXRlczogNDAwMDAwMCxcbiAgICAgIH0sXG4gICAgICBtYW5pZmVzdDoge1xuICAgICAgICBuYW1lOiBcIkV0ZXJudW1cIixcbiAgICAgICAgc2hvcnRfbmFtZTogXCJFdGVybnVtXCIsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBcIlJ1bGUgdGhlIEhleFwiLFxuICAgICAgICB0aGVtZV9jb2xvcjogXCIjMDAwMDAwXCIsXG4gICAgICAgIGJhY2tncm91bmRfY29sb3I6IFwiIzAwMDAwMFwiLFxuICAgICAgICBkaXNwbGF5OiBcInN0YW5kYWxvbmVcIixcbiAgICAgICAgb3JpZW50YXRpb246IFwibGFuZHNjYXBlXCIsXG4gICAgICAgIHNjb3BlOiBcIi9cIixcbiAgICAgICAgc3RhcnRfdXJsOiBcIi9cIixcbiAgICAgICAgaWNvbnM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBzcmM6IFwiL2ltYWdlcy9wd2EtNjR4NjQucG5nXCIsXG4gICAgICAgICAgICBzaXplczogXCI2NHg2NFwiLFxuICAgICAgICAgICAgdHlwZTogXCJpbWFnZS9wbmdcIixcbiAgICAgICAgICAgIHB1cnBvc2U6IFwiYW55IG1hc2thYmxlXCIsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBzcmM6IFwiL2ltYWdlcy9wd2EtMTkyeDE5Mi5wbmdcIixcbiAgICAgICAgICAgIHNpemVzOiBcIjE5MngxOTJcIixcbiAgICAgICAgICAgIHR5cGU6IFwiaW1hZ2UvcG5nXCIsXG4gICAgICAgICAgICBwdXJwb3NlOiBcImFueSBtYXNrYWJsZVwiLFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgc3JjOiBcIi9pbWFnZXMvcHdhLTUxMng1MTIucG5nXCIsXG4gICAgICAgICAgICBzaXplczogXCI1MTJ4NTEyXCIsXG4gICAgICAgICAgICB0eXBlOiBcImltYWdlL3BuZ1wiLFxuICAgICAgICAgICAgcHVycG9zZTogXCJhbnkgbWFza2FibGVcIixcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICB9KSxcbiAgXSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICBldmVudHM6IFwiZXZlbnRzXCIsXG4gICAgICBcIkBcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL3NyY1wiKSxcbiAgICB9LFxuICB9LFxuICBidWlsZDoge1xuICAgIHRhcmdldDogXCJlc25leHRcIixcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBpbnB1dDoge1xuICAgICAgICBtYWluOiByZXNvbHZlKF9fZGlybmFtZSwgXCJpbmRleC5odG1sXCIpLFxuICAgICAgICBtYXA6IHJlc29sdmUoX19kaXJuYW1lLCBcIm1hcC9pbmRleC5odG1sXCIpLFxuICAgICAgICBoZXg6IHJlc29sdmUoX19kaXJuYW1lLCBcImhleC9pbmRleC5odG1sXCIpLFxuICAgICAgfSxcbiAgICAgIG1heFBhcmFsbGVsRmlsZU9wczogMixcbiAgICAgIGNhY2hlOiBmYWxzZSxcbiAgICAgIC8vIGV4dGVybmFsOiBbXCJyZWFjdFwiLCBcInJlYWN0LWRvbVwiXSxcbiAgICAgIG91dHB1dDoge1xuICAgICAgICBnbG9iYWxzOiB7XG4gICAgICAgICAgcmVhY3Q6IFwiUmVhY3RcIixcbiAgICAgICAgICBcInJlYWN0LWRvbVwiOiBcIlJlYWN0RE9NXCIsXG4gICAgICAgIH0sXG4gICAgICAgIHNvdXJjZW1hcDogdHJ1ZSxcbiAgICAgICAgbWFudWFsQ2h1bmtzOiAoaWQpID0+IHtcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXNcIikpIHtcbiAgICAgICAgICAgIHJldHVybiBcInZlbmRvclwiO1xuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgaW5saW5lRHluYW1pY0ltcG9ydHM6IGZhbHNlLFxuICAgICAgICBzb3VyY2VtYXBJZ25vcmVMaXN0OiAocmVsYXRpdmVTb3VyY2VQYXRoKSA9PiB7XG4gICAgICAgICAgY29uc3Qgbm9ybWFsaXplZFBhdGggPSBwYXRoLm5vcm1hbGl6ZShyZWxhdGl2ZVNvdXJjZVBhdGgpO1xuICAgICAgICAgIHJldHVybiBub3JtYWxpemVkUGF0aC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlc1wiKTtcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbiAgb3B0aW1pemVEZXBzOiB7XG4gICAgZXhjbHVkZTogW1xuICAgICAgXCJqcy1iaWctZGVjaW1hbFwiLFxuICAgICAgXCJAYmlibGlvdGhlY2FkYW8vZXRlcm51bVwiLCAvLyBBZGQgeW91ciBkZXBlbmRlbmN5IGhlcmVcbiAgICBdLFxuICB9LFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXVTLE9BQU8sVUFBVTtBQUN4VCxPQUFPLFdBQVc7QUFDbEIsT0FBTyxRQUFRLGVBQWU7QUFDOUIsU0FBUyxvQkFBb0I7QUFDN0IsT0FBTyxZQUFZO0FBQ25CLFNBQVMsZUFBZTtBQUN4QixPQUFPLG1CQUFtQjtBQUMxQixPQUFPLFVBQVU7QUFQakIsSUFBTSxtQ0FBbUM7QUFTekMsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLElBQ1AsS0FBSyxFQUFFLFlBQVksT0FBTyxNQUFNLE9BQU8sWUFBWSxLQUFLLENBQUM7QUFBQSxJQUN6RCxNQUFNO0FBQUEsSUFDTixLQUFLO0FBQUEsSUFDTCxjQUFjO0FBQUEsSUFDZCxRQUFRO0FBQUEsTUFDTixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsUUFDVixTQUFTLFFBQVEsSUFBSSxvQkFBb0I7QUFBQSxNQUMzQztBQUFBLE1BQ0EsU0FBUztBQUFBLFFBQ1AsK0JBQStCO0FBQUEsTUFDakM7QUFBQSxNQUNBLFVBQVU7QUFBQSxRQUNSLE1BQU07QUFBQSxRQUNOLFlBQVk7QUFBQSxRQUNaLGFBQWE7QUFBQSxRQUNiLGFBQWE7QUFBQSxRQUNiLGtCQUFrQjtBQUFBLFFBQ2xCLFNBQVM7QUFBQSxRQUNULGFBQWE7QUFBQSxRQUNiLE9BQU87QUFBQSxRQUNQLFdBQVc7QUFBQSxRQUNYLE9BQU87QUFBQSxVQUNMO0FBQUEsWUFDRSxLQUFLO0FBQUEsWUFDTCxPQUFPO0FBQUEsWUFDUCxNQUFNO0FBQUEsWUFDTixTQUFTO0FBQUEsVUFDWDtBQUFBLFVBQ0E7QUFBQSxZQUNFLEtBQUs7QUFBQSxZQUNMLE9BQU87QUFBQSxZQUNQLE1BQU07QUFBQSxZQUNOLFNBQVM7QUFBQSxVQUNYO0FBQUEsVUFDQTtBQUFBLFlBQ0UsS0FBSztBQUFBLFlBQ0wsT0FBTztBQUFBLFlBQ1AsTUFBTTtBQUFBLFlBQ04sU0FBUztBQUFBLFVBQ1g7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLElBQ0YsQ0FBQztBQUFBLEVBQ0g7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLFFBQVE7QUFBQSxNQUNSLEtBQUssS0FBSyxRQUFRLGtDQUFXLE9BQU87QUFBQSxJQUN0QztBQUFBLEVBQ0Y7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNMLFFBQVE7QUFBQSxJQUNSLGVBQWU7QUFBQSxNQUNiLE9BQU87QUFBQSxRQUNMLE1BQU0sUUFBUSxrQ0FBVyxZQUFZO0FBQUEsUUFDckMsS0FBSyxRQUFRLGtDQUFXLGdCQUFnQjtBQUFBLFFBQ3hDLEtBQUssUUFBUSxrQ0FBVyxnQkFBZ0I7QUFBQSxNQUMxQztBQUFBLE1BQ0Esb0JBQW9CO0FBQUEsTUFDcEIsT0FBTztBQUFBO0FBQUEsTUFFUCxRQUFRO0FBQUEsUUFDTixTQUFTO0FBQUEsVUFDUCxPQUFPO0FBQUEsVUFDUCxhQUFhO0FBQUEsUUFDZjtBQUFBLFFBQ0EsV0FBVztBQUFBLFFBQ1gsY0FBYyxDQUFDLE9BQU87QUFDcEIsY0FBSSxHQUFHLFNBQVMsY0FBYyxHQUFHO0FBQy9CLG1CQUFPO0FBQUEsVUFDVDtBQUFBLFFBQ0Y7QUFBQSxRQUNBLHNCQUFzQjtBQUFBLFFBQ3RCLHFCQUFxQixDQUFDLHVCQUF1QjtBQUMzQyxnQkFBTSxpQkFBaUIsS0FBSyxVQUFVLGtCQUFrQjtBQUN4RCxpQkFBTyxlQUFlLFNBQVMsY0FBYztBQUFBLFFBQy9DO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxjQUFjO0FBQUEsSUFDWixTQUFTO0FBQUEsTUFDUDtBQUFBLE1BQ0E7QUFBQTtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
