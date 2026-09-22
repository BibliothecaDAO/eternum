import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// The SPA talks to the identity Worker under /api (`wrangler dev --env staging`,
// port 8787 in dev) so the session cookie is first-party in every environment.
export default defineConfig({
  server: {
    port: 3002,
    host: true,
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
  plugins: [tsconfigPaths({ projects: ["./tsconfig.json"] }), viteReact(), tailwindcss()],
  build: {
    target: "esnext",
  },
});
