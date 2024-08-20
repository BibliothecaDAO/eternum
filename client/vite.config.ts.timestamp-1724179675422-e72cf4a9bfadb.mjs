// vite.config.ts
import react from "file:///Users/os/Documents/code/eternum/node_modules/.pnpm/@vitejs+plugin-react@4.3.1_vite@5.3.5_@types+node@20.14.13_/node_modules/@vitejs/plugin-react/dist/index.mjs";
import { resolve } from "path";
import { defineConfig } from "file:///Users/os/Documents/code/eternum/node_modules/.pnpm/vite@5.3.5_@types+node@20.14.13/node_modules/vite/dist/node/index.js";
import svgr from "file:///Users/os/Documents/code/eternum/node_modules/.pnpm/@svgr+rollup@8.1.0_rollup@4.19.1_typescript@5.4.4/node_modules/@svgr/rollup/dist/index.js";
import path from "path";
import topLevelAwait from "file:///Users/os/Documents/code/eternum/node_modules/.pnpm/vite-plugin-top-level-await@1.4.2_rollup@4.19.1_vite@5.3.5_@types+node@20.14.13_/node_modules/vite-plugin-top-level-await/exports/import.mjs";
import wasm from "file:///Users/os/Documents/code/eternum/node_modules/.pnpm/vite-plugin-wasm@3.3.0_vite@5.3.5_@types+node@20.14.13_/node_modules/vite-plugin-wasm/exports/import.mjs";
var __vite_injected_original_dirname = "/Users/os/Documents/code/eternum/client";
var vite_config_default = defineConfig({
  plugins: [svgr({ dimensions: false, svgo: false, typescript: true }), react(), wasm(), topLevelAwait()],
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvb3MvRG9jdW1lbnRzL2NvZGUvZXRlcm51bS9jbGllbnRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy9vcy9Eb2N1bWVudHMvY29kZS9ldGVybnVtL2NsaWVudC92aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvb3MvRG9jdW1lbnRzL2NvZGUvZXRlcm51bS9jbGllbnQvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgcmVhY3QgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXJlYWN0XCI7XG5pbXBvcnQgeyByZXNvbHZlIH0gZnJvbSBcInBhdGhcIjtcbmltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gXCJ2aXRlXCI7XG5cbmltcG9ydCBzdmdyIGZyb20gXCJAc3Znci9yb2xsdXBcIjtcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XG5pbXBvcnQgdG9wTGV2ZWxBd2FpdCBmcm9tIFwidml0ZS1wbHVnaW4tdG9wLWxldmVsLWF3YWl0XCI7XG5pbXBvcnQgd2FzbSBmcm9tIFwidml0ZS1wbHVnaW4td2FzbVwiO1xuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtzdmdyKHsgZGltZW5zaW9uczogZmFsc2UsIHN2Z286IGZhbHNlLCB0eXBlc2NyaXB0OiB0cnVlIH0pLCByZWFjdCgpLCB3YXNtKCksIHRvcExldmVsQXdhaXQoKV0sXG4gIHJlc29sdmU6IHtcbiAgICBhbGlhczoge1xuICAgICAgZXZlbnRzOiBcImV2ZW50c1wiLFxuICAgICAgXCJAXCI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi9zcmNcIiksXG4gICAgfSxcbiAgfSxcbiAgYnVpbGQ6IHtcbiAgICB0YXJnZXQ6IFwiZXNuZXh0XCIsXG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgaW5wdXQ6IHtcbiAgICAgICAgbWFpbjogcmVzb2x2ZShfX2Rpcm5hbWUsIFwiaW5kZXguaHRtbFwiKSxcbiAgICAgICAgbWFwOiByZXNvbHZlKF9fZGlybmFtZSwgXCJtYXAvaW5kZXguaHRtbFwiKSxcbiAgICAgICAgaGV4OiByZXNvbHZlKF9fZGlybmFtZSwgXCJoZXgvaW5kZXguaHRtbFwiKSxcbiAgICAgIH0sXG4gICAgICBtYXhQYXJhbGxlbEZpbGVPcHM6IDIsXG4gICAgICBjYWNoZTogZmFsc2UsXG4gICAgICAvLyBleHRlcm5hbDogW1wicmVhY3RcIiwgXCJyZWFjdC1kb21cIl0sXG4gICAgICBvdXRwdXQ6IHtcbiAgICAgICAgZ2xvYmFsczoge1xuICAgICAgICAgIHJlYWN0OiBcIlJlYWN0XCIsXG4gICAgICAgICAgXCJyZWFjdC1kb21cIjogXCJSZWFjdERPTVwiLFxuICAgICAgICB9LFxuICAgICAgICBzb3VyY2VtYXA6IHRydWUsXG4gICAgICAgIG1hbnVhbENodW5rczogKGlkKSA9PiB7XG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzXCIpKSB7XG4gICAgICAgICAgICByZXR1cm4gXCJ2ZW5kb3JcIjtcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGlubGluZUR5bmFtaWNJbXBvcnRzOiBmYWxzZSxcbiAgICAgICAgc291cmNlbWFwSWdub3JlTGlzdDogKHJlbGF0aXZlU291cmNlUGF0aCkgPT4ge1xuICAgICAgICAgIGNvbnN0IG5vcm1hbGl6ZWRQYXRoID0gcGF0aC5ub3JtYWxpemUocmVsYXRpdmVTb3VyY2VQYXRoKTtcbiAgICAgICAgICByZXR1cm4gbm9ybWFsaXplZFBhdGguaW5jbHVkZXMoXCJub2RlX21vZHVsZXNcIik7XG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG4gIG9wdGltaXplRGVwczoge1xuICAgIGV4Y2x1ZGU6IFtcbiAgICAgIFwianMtYmlnLWRlY2ltYWxcIixcbiAgICAgIFwiQGJpYmxpb3RoZWNhZGFvL2V0ZXJudW1cIiwgLy8gQWRkIHlvdXIgZGVwZW5kZW5jeSBoZXJlXG4gICAgXSxcbiAgfSxcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUF1UyxPQUFPLFdBQVc7QUFDelQsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsb0JBQW9CO0FBRTdCLE9BQU8sVUFBVTtBQUNqQixPQUFPLFVBQVU7QUFDakIsT0FBTyxtQkFBbUI7QUFDMUIsT0FBTyxVQUFVO0FBUGpCLElBQU0sbUNBQW1DO0FBU3pDLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxLQUFLLEVBQUUsWUFBWSxPQUFPLE1BQU0sT0FBTyxZQUFZLEtBQUssQ0FBQyxHQUFHLE1BQU0sR0FBRyxLQUFLLEdBQUcsY0FBYyxDQUFDO0FBQUEsRUFDdEcsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsUUFBUTtBQUFBLE1BQ1IsS0FBSyxLQUFLLFFBQVEsa0NBQVcsT0FBTztBQUFBLElBQ3RDO0FBQUEsRUFDRjtBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsUUFBUTtBQUFBLElBQ1IsZUFBZTtBQUFBLE1BQ2IsT0FBTztBQUFBLFFBQ0wsTUFBTSxRQUFRLGtDQUFXLFlBQVk7QUFBQSxRQUNyQyxLQUFLLFFBQVEsa0NBQVcsZ0JBQWdCO0FBQUEsUUFDeEMsS0FBSyxRQUFRLGtDQUFXLGdCQUFnQjtBQUFBLE1BQzFDO0FBQUEsTUFDQSxvQkFBb0I7QUFBQSxNQUNwQixPQUFPO0FBQUE7QUFBQSxNQUVQLFFBQVE7QUFBQSxRQUNOLFNBQVM7QUFBQSxVQUNQLE9BQU87QUFBQSxVQUNQLGFBQWE7QUFBQSxRQUNmO0FBQUEsUUFDQSxXQUFXO0FBQUEsUUFDWCxjQUFjLENBQUMsT0FBTztBQUNwQixjQUFJLEdBQUcsU0FBUyxjQUFjLEdBQUc7QUFDL0IsbUJBQU87QUFBQSxVQUNUO0FBQUEsUUFDRjtBQUFBLFFBQ0Esc0JBQXNCO0FBQUEsUUFDdEIscUJBQXFCLENBQUMsdUJBQXVCO0FBQzNDLGdCQUFNLGlCQUFpQixLQUFLLFVBQVUsa0JBQWtCO0FBQ3hELGlCQUFPLGVBQWUsU0FBUyxjQUFjO0FBQUEsUUFDL0M7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLGNBQWM7QUFBQSxJQUNaLFNBQVM7QUFBQSxNQUNQO0FBQUEsTUFDQTtBQUFBO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
