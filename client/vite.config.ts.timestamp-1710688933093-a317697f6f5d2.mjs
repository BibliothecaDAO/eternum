// vite.config.ts
import { defineConfig } from "file:///Users/aymericdelabrousse/Projects/blockchain/cairo/realms/official-eternum/eternum/node_modules/.pnpm/vite@4.5.2/node_modules/vite/dist/node/index.js";
import { resolve } from "path";
import react from "file:///Users/aymericdelabrousse/Projects/blockchain/cairo/realms/official-eternum/eternum/node_modules/.pnpm/@vitejs+plugin-react@3.1.0_vite@4.5.2/node_modules/@vitejs/plugin-react/dist/index.mjs";
import svgr from "file:///Users/aymericdelabrousse/Projects/blockchain/cairo/realms/official-eternum/eternum/node_modules/.pnpm/vite-plugin-svgr@3.3.0_typescript@5.4.2_vite@4.5.2/node_modules/vite-plugin-svgr/dist/index.js";
import wasm from "file:///Users/aymericdelabrousse/Projects/blockchain/cairo/realms/official-eternum/eternum/node_modules/.pnpm/vite-plugin-wasm@3.3.0_vite@4.5.2/node_modules/vite-plugin-wasm/exports/import.mjs";
import topLevelAwait from "file:///Users/aymericdelabrousse/Projects/blockchain/cairo/realms/official-eternum/eternum/node_modules/.pnpm/vite-plugin-top-level-await@1.4.1_vite@4.5.2/node_modules/vite-plugin-top-level-await/exports/import.mjs";
import path from "path";
var __vite_injected_original_dirname = "/Users/aymericdelabrousse/Projects/blockchain/cairo/realms/official-eternum/eternum/client";
var vite_config_default = defineConfig({
  plugins: [svgr(), react(), wasm(), topLevelAwait()],
  resolve: {
    alias: {
      events: "events"
    }
  },
  build: {
    target: "esnext",
    rollupOptions: {
      input: {
        main: resolve(__vite_injected_original_dirname, "index.html"),
        map: resolve(__vite_injected_original_dirname, "map/index.html"),
        realm: resolve(__vite_injected_original_dirname, "realm/index.html")
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
    exclude: ["js-big-decimal"]
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvYXltZXJpY2RlbGFicm91c3NlL1Byb2plY3RzL2Jsb2NrY2hhaW4vY2Fpcm8vcmVhbG1zL29mZmljaWFsLWV0ZXJudW0vZXRlcm51bS9jbGllbnRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy9heW1lcmljZGVsYWJyb3Vzc2UvUHJvamVjdHMvYmxvY2tjaGFpbi9jYWlyby9yZWFsbXMvb2ZmaWNpYWwtZXRlcm51bS9ldGVybnVtL2NsaWVudC92aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvYXltZXJpY2RlbGFicm91c3NlL1Byb2plY3RzL2Jsb2NrY2hhaW4vY2Fpcm8vcmVhbG1zL29mZmljaWFsLWV0ZXJudW0vZXRlcm51bS9jbGllbnQvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHsgcmVzb2x2ZSB9IGZyb20gXCJwYXRoXCI7XG5pbXBvcnQgcmVhY3QgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXJlYWN0XCI7XG5pbXBvcnQgc3ZnciBmcm9tIFwidml0ZS1wbHVnaW4tc3ZnclwiO1xuaW1wb3J0IHdhc20gZnJvbSBcInZpdGUtcGx1Z2luLXdhc21cIjtcbmltcG9ydCB0b3BMZXZlbEF3YWl0IGZyb20gXCJ2aXRlLXBsdWdpbi10b3AtbGV2ZWwtYXdhaXRcIjtcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XG4vLyBodHRwczovL3ZpdGVqcy5kZXYvY29uZmlnL1xuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW3N2Z3IoKSwgcmVhY3QoKSwgd2FzbSgpLCB0b3BMZXZlbEF3YWl0KCldLFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgIGV2ZW50czogXCJldmVudHNcIixcbiAgICB9LFxuICB9LFxuICBidWlsZDoge1xuICAgIHRhcmdldDogXCJlc25leHRcIixcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBpbnB1dDoge1xuICAgICAgICBtYWluOiByZXNvbHZlKF9fZGlybmFtZSwgXCJpbmRleC5odG1sXCIpLFxuICAgICAgICBtYXA6IHJlc29sdmUoX19kaXJuYW1lLCBcIm1hcC9pbmRleC5odG1sXCIpLFxuICAgICAgICByZWFsbTogcmVzb2x2ZShfX2Rpcm5hbWUsIFwicmVhbG0vaW5kZXguaHRtbFwiKSxcbiAgICAgIH0sXG4gICAgICBtYXhQYXJhbGxlbEZpbGVPcHM6IDIsXG4gICAgICBjYWNoZTogZmFsc2UsXG4gICAgICAvLyBleHRlcm5hbDogW1wicmVhY3RcIiwgXCJyZWFjdC1kb21cIl0sXG4gICAgICBvdXRwdXQ6IHtcbiAgICAgICAgZ2xvYmFsczoge1xuICAgICAgICAgIHJlYWN0OiBcIlJlYWN0XCIsXG4gICAgICAgICAgXCJyZWFjdC1kb21cIjogXCJSZWFjdERPTVwiLFxuICAgICAgICB9LFxuICAgICAgICBzb3VyY2VtYXA6IHRydWUsXG4gICAgICAgIG1hbnVhbENodW5rczogKGlkKSA9PiB7XG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzXCIpKSB7XG4gICAgICAgICAgICByZXR1cm4gXCJ2ZW5kb3JcIjtcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGlubGluZUR5bmFtaWNJbXBvcnRzOiBmYWxzZSxcbiAgICAgICAgc291cmNlbWFwSWdub3JlTGlzdDogKHJlbGF0aXZlU291cmNlUGF0aCkgPT4ge1xuICAgICAgICAgIGNvbnN0IG5vcm1hbGl6ZWRQYXRoID0gcGF0aC5ub3JtYWxpemUocmVsYXRpdmVTb3VyY2VQYXRoKTtcbiAgICAgICAgICByZXR1cm4gbm9ybWFsaXplZFBhdGguaW5jbHVkZXMoXCJub2RlX21vZHVsZXNcIik7XG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG4gIG9wdGltaXplRGVwczoge1xuICAgIGV4Y2x1ZGU6IFtcImpzLWJpZy1kZWNpbWFsXCJdLFxuICB9LFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQWdjLFNBQVMsb0JBQW9CO0FBQzdkLFNBQVMsZUFBZTtBQUN4QixPQUFPLFdBQVc7QUFDbEIsT0FBTyxVQUFVO0FBQ2pCLE9BQU8sVUFBVTtBQUNqQixPQUFPLG1CQUFtQjtBQUMxQixPQUFPLFVBQVU7QUFOakIsSUFBTSxtQ0FBbUM7QUFRekMsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUyxDQUFDLEtBQUssR0FBRyxNQUFNLEdBQUcsS0FBSyxHQUFHLGNBQWMsQ0FBQztBQUFBLEVBQ2xELFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLFFBQVE7QUFBQSxJQUNWO0FBQUEsRUFDRjtBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsUUFBUTtBQUFBLElBQ1IsZUFBZTtBQUFBLE1BQ2IsT0FBTztBQUFBLFFBQ0wsTUFBTSxRQUFRLGtDQUFXLFlBQVk7QUFBQSxRQUNyQyxLQUFLLFFBQVEsa0NBQVcsZ0JBQWdCO0FBQUEsUUFDeEMsT0FBTyxRQUFRLGtDQUFXLGtCQUFrQjtBQUFBLE1BQzlDO0FBQUEsTUFDQSxvQkFBb0I7QUFBQSxNQUNwQixPQUFPO0FBQUE7QUFBQSxNQUVQLFFBQVE7QUFBQSxRQUNOLFNBQVM7QUFBQSxVQUNQLE9BQU87QUFBQSxVQUNQLGFBQWE7QUFBQSxRQUNmO0FBQUEsUUFDQSxXQUFXO0FBQUEsUUFDWCxjQUFjLENBQUMsT0FBTztBQUNwQixjQUFJLEdBQUcsU0FBUyxjQUFjLEdBQUc7QUFDL0IsbUJBQU87QUFBQSxVQUNUO0FBQUEsUUFDRjtBQUFBLFFBQ0Esc0JBQXNCO0FBQUEsUUFDdEIscUJBQXFCLENBQUMsdUJBQXVCO0FBQzNDLGdCQUFNLGlCQUFpQixLQUFLLFVBQVUsa0JBQWtCO0FBQ3hELGlCQUFPLGVBQWUsU0FBUyxjQUFjO0FBQUEsUUFDL0M7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLGNBQWM7QUFBQSxJQUNaLFNBQVMsQ0FBQyxnQkFBZ0I7QUFBQSxFQUM1QjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
