import type { Plugin } from "vite";

/**
 * Stamps the client release into the worker: its bytes change with every release even when no precached asset
 * does, and a page can ask a waiting worker which release it serves.
 */
export function createPwaReleasePlugin(release: string): Plugin {
  return {
    name: "pwa-release-stamp",
    generateBundle(_options, bundle) {
      const worker = Object.values(bundle).find((output) => output.type === "chunk" && output.isEntry);
      if (!worker || worker.type !== "chunk") throw new Error("PWA build has no worker entry");
      worker.code = `self.REALMS_RELEASE = ${JSON.stringify(release)};\n${worker.code}`;
    },
  };
}
