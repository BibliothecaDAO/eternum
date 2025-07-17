import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import svgr from "vite-plugin-svgr";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    tsconfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tanstackStart({
      target: "vercel",
      customViteReactPlugin: true,
    }),
    viteReact(),
    svgr({
      include: "**/*.svg?react",
    }),
    tailwindcss(),
  ],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          // Group blockchain libraries together
          blockchain: [
            "viem",
            "wagmi", 
            "starknet",
            "@starknet-react/core",
            "@starknet-react/chains"
          ],
          // Group UI libraries
          ui: [
            "@radix-ui/react-accordion",
            "@radix-ui/react-alert-dialog",
            "@radix-ui/react-avatar",
            "@radix-ui/react-checkbox",
            "@radix-ui/react-collapsible",
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-label",
            "@radix-ui/react-navigation-menu",
            "@radix-ui/react-popover",
            "@radix-ui/react-progress",
            "@radix-ui/react-radio-group",
            "@radix-ui/react-scroll-area",
            "@radix-ui/react-select",
            "@radix-ui/react-separator",
            "@radix-ui/react-slider",
            "@radix-ui/react-slot",
            "@radix-ui/react-switch",
            "@radix-ui/react-tabs",
            "@radix-ui/react-toast",
            "@radix-ui/react-toggle",
            "@radix-ui/react-toggle-group",
            "@radix-ui/react-tooltip"
          ],
          // Group graphql and query libraries
          graphql: [
            "graphql-request",
            "@tanstack/react-query",
            "@tanstack/react-query-devtools"
          ]
        }
      }
    }
  },
  optimizeDeps: {
    include: [
      "@realms-world/db",
      "@reown/appkit",
      "@reown/appkit-adapter-wagmi",
      "viem",
      "wagmi",
      "starknet",
      "@starknet-react/core"
    ],
    exclude: [
      "@starknet-io/starknet-types-07",
      "@starknet-io/starknet-types-08"
    ]
  },
  ssr: {
    noExternal: [
      "@realms-world/db",
      "@realms-world/constants"
    ]
  }
});
