import type { Plugin } from "vite";

/** What the build stamps into the worker. */
export interface WorkerStamp {
  release: string;
  /** The installed app's icon, which every alert shows: the environment's own, so a dev alert never passes for prod's. */
  alertIcon: string;
}

/**
 * Stamps the client release into the worker: its bytes change with every release even when no precached asset
 * does, and a page can ask a waiting worker which release it serves. The alert icon rides on the same line.
 */
export function createPwaReleasePlugin({ release, alertIcon }: WorkerStamp): Plugin {
  return {
    name: "pwa-release-stamp",
    generateBundle(_options, bundle) {
      const worker = Object.values(bundle).find((output) => output.type === "chunk" && output.isEntry);
      if (!worker || worker.type !== "chunk") throw new Error("PWA build has no worker entry");
      const stamp = `self.REALMS_RELEASE = ${JSON.stringify(release)}; self.REALMS_ALERT_ICON = ${JSON.stringify(alertIcon)};`;
      worker.code = `${stamp}\n${worker.code}`;
    },
  };
}
