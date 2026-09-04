import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// The SPA talks to its own identity server under /api (server/main.ts, port 3001
// in dev) so the session cookie is first-party in every environment.
export default defineConfig({
  server: {
    port: 3002,
    host: true,
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
  plugins: [tsconfigPaths({ projects: ["./tsconfig.json"] }), viteReact(), tailwindcss()],
  build: {
    target: "esnext",
  },
});
