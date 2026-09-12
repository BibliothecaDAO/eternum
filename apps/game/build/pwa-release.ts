import { createHash } from "node:crypto";
import type { Plugin } from "vite";

/** A release must change worker bytes even when every precached offline asset is unchanged. */
export function createPwaReleasePlugin(release: string): Plugin {
  const fingerprint = createHash("sha256").update(release).digest("hex");
  return {
    name: "pwa-release-fingerprint",
    generateBundle(_options, bundle) {
      const worker = Object.values(bundle).find((output) => output.type === "chunk" && output.isEntry);
      if (!worker || worker.type !== "chunk") throw new Error("PWA build has no worker entry");
      worker.code = `/* Realms PWA release: ${fingerprint} */\n${worker.code}`;
    },
  };
}
