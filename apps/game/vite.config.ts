import svgr from "@svgr/rollup";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path, { resolve } from "path";
import { visualizer } from "rollup-plugin-visualizer";
import { ConfigEnv, defineConfig, loadEnv, PluginOption, UserConfig } from "vite";
import mkcert from "vite-plugin-mkcert";
import { VitePWA } from "vite-plugin-pwa";
import topLevelAwait from "vite-plugin-top-level-await";
import wasm from "vite-plugin-wasm";
import { resolveRendererViteAliases } from "./src/three/renderer-vite-config";
import { PWA_PRECACHE_BUDGET_BYTES, PWA_PRECACHE_FILES } from "./build/pwa-assets.mjs";
import { createPwaReleasePlugin } from "./build/pwa-release";

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }: ConfigEnv): UserConfig => {
  const isServe = command === "serve";
  const isBuild = command === "build";
  const appEnv = loadEnv(mode, process.cwd(), "");
  const enableAnalyzer = process.env.ANALYZE === "true";
  const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
  const sentryOrg = process.env.SENTRY_ORG;
  const sentryProject = process.env.SENTRY_PROJECT;
  const sentryUploadEnabled = isBuild && Boolean(sentryAuthToken && sentryOrg && sentryProject);
  const rendererViteAliases = resolveRendererViteAliases();
  const sentryRelease =
    process.env.SENTRY_RELEASE ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    appEnv.VITE_PUBLIC_SENTRY_RELEASE ||
    process.env.VITE_PUBLIC_GAME_VERSION ||
    undefined;

  const plugins = [svgr({ dimensions: false, svgo: false, typescript: true }), react()];

  if (shouldUseMkcert(isServe)) {
    plugins.unshift(mkcert() as any);
  }

  plugins.push(wasm());
  plugins.push(topLevelAwait() as any);

  if (isBuild) {
    plugins.push({
      name: "ensure-outdir",
      apply: "build",
      configResolved(config) {
        const outDir = path.resolve(config.root ?? process.cwd(), config.build.outDir ?? "dist");
        fs.mkdirSync(outDir, { recursive: true });
      },
    });
    plugins.push(
      VitePWA({
        strategies: "injectManifest",
        srcDir: "src",
        filename: "sw.ts",
        injectRegister: false,
        includeManifestIcons: false,
        injectManifest: {
          // The plugin adds manifest.webmanifest itself; globbing it too duplicates its entry.
          globPatterns: PWA_PRECACHE_FILES.filter((file) => file !== "manifest.webmanifest"),
          maximumFileSizeToCacheInBytes: PWA_PRECACHE_BUDGET_BYTES,
          sourcemap: false,
          buildPlugins: {
            rollup: [
              createPwaReleasePlugin(
                process.env.VITE_PUBLIC_GAME_VERSION || appEnv.VITE_PUBLIC_GAME_VERSION || "development",
              ),
            ],
          },
        },
        manifest: {
          id: "/",
          name: "Realms",
          short_name: "Realms",
          description: "Fully onchain strategy: Frontier expeditions and Blitz battles",
          theme_color: "#F6C297",
          background_color: "#F6C297",
          display: "standalone",
          orientation: "landscape",
          scope: "/",
          start_url: "/",
          icons: [
            { src: "/images/game-pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/images/game-pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "/images/game-maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        },
      }) as any,
    );

    if (sentryUploadEnabled) {
      plugins.push(
        sentryVitePlugin({
          authToken: sentryAuthToken!,
          org: sentryOrg!,
          project: sentryProject!,
          release: sentryRelease,
          sourcemaps: {
            assets: "./dist/**",
            filesToDeleteAfterUpload: ["./dist/**/*.map"],
          },
        }),
      );
    }
  }

  if (enableAnalyzer) {
    plugins.push(
      visualizer({
        filename: "dist/bundle-analysis.html",
        open: false,
        gzipSize: true,
        brotliSize: true,
        template: "treemap",
      }),
    );
  }

  return {
    plugins: plugins as unknown as PluginOption[],
    // The lab fronts the dev server with Caddy on https://play.realms.test (deploy/athanor/Caddyfile):
    // listen beyond loopback so the container reaches us. Let HMR follow the browser URL
    // so both the TLS proxy and direct localhost ports work.
    server: {
      host: true,
      allowedHosts: ["play.realms.test"],
    },
    resolve: {
      dedupe: ["three"],
      alias: [
        ...rendererViteAliases,
        {
          find: "@/assets",
          replacement: path.resolve(__dirname, "./public/assets"),
        },
        {
          find: "events",
          replacement: "events",
        },
        {
          find: "@",
          replacement: path.resolve(__dirname, "./src"),
        },
        {
          find: "@config",
          replacement: path.resolve(__dirname, "../../config/utils/utils"),
        },
        {
          find: "@config-deployer",
          replacement: path.resolve(__dirname, "../../config/deployer"),
        },
        {
          find: "@pm",
          replacement: path.resolve(__dirname, "./src/pm"),
        },
        {
          find: "@videos",
          replacement: path.resolve(__dirname, "./src/assets/videos"),
        },
      ],
    },
    // The procedural-terrain worker (PR #4903) is a `type: "module"` worker whose dependency graph
    // code-splits; Vite's default worker format is `iife`, which rollup rejects for code-splitting
    // ("UMD and IIFE output formats are not supported for code-splitting"). Build workers as ES modules.
    worker: {
      format: "es",
    },
    build: {
      target: "esnext",
      sourcemap: sentryUploadEnabled ? "hidden" : true,
      chunkSizeWarningLimit: 5000,
      rollupOptions: {
        input: {
          main: resolve(__dirname, "index.html"),
          map: resolve(__dirname, "map/index.html"),
          hex: resolve(__dirname, "hex/index.html"),
        },
        maxParallelFileOps: 2,
        cache: false,
        // external: ["react", "react-dom"],
        output: {
          globals: {
            react: "React",
            "react-dom": "ReactDOM",
          },
          // The shell's cold load must carry only its own modules. Vendor groups name only the library modules
          // themselves (never their dependents or Vite's helpers), so no shell import drags a game library along;
          // everything else splits by usage at the lazy route boundaries.
          manualChunks: (id) => {
            // Vite's preload helper is used by every chunk; pin it beside React so the shell never imports it from a
            // game library chunk.
            if (id.includes("vite/preload-helper")) return "react-vendor";
            if (!id.includes("node_modules")) return undefined;
            if (/node_modules\/three\//.test(id)) return "three";
            if (/node_modules\/(starknet|@cartridge|@starknet-react|@scure|@noble)\//.test(id)) return "blockchain";
            if (
              /node_modules\/(react|react-dom|react-router|react-router-dom|@tanstack\/react-query|zustand|scheduler)\//.test(
                id,
              )
            )
              return "react-vendor";
            return undefined;
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
      exclude: [
        "js-big-decimal",
        "@bibliothecadao/eternum", // Add your dependency here
      ],
    },
  };
});

function shouldUseMkcert(isServe: boolean): boolean {
  return isServe && process.env.CI !== "true" && process.env.ETERNUM_DISABLE_MKCERT !== "true";
}
