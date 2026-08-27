// @vitest-environment node

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Console discipline: the console is for humans, and in production it carries
 * errors and actionable warnings only. `console.log/info/debug` is reserved for
 * gated debug surfaces — everything else routes through `verboseLog`
 * (src/utils/dev-mode.ts) or the silent perf collectors.
 *
 * A file may emit console.log/info/debug ONLY if it is listed here, and every
 * listed file must actually gate its output (DEV, VERBOSE_LOGS_ENABLED, a
 * dev-GUI surface, or an explicit opt-in flag). Adding a file to this list is a
 * review decision, not a formality.
 */
const SANCTIONED_CLIENT_FILES = new Set([
  "src/audio/core/AudioManager.ts",
  "src/dojo/gamewide-sync-adapter.ts",
  "src/dojo/sync-simulator.ts",
  "src/dojo/sync.ts",
  "src/hooks/shortcuts/useShortcuts.ts",
  "src/hooks/store/use-transaction-store.ts",
  "src/three/cosmetics/attachment-manager.ts",
  "src/three/cosmetics/debug-controller.ts",
  "src/three/game-renderer.ts",
  "src/three/managers/army-manager.ts",
  "src/three/managers/army-model-debug-hooks.ts",
  "src/three/scenes/hexagon-scene.ts",
  "src/three/scenes/hexception.tsx",
  "src/three/scenes/worldmap-perf-simulation.ts",
  "src/three/scenes/worldmap.tsx",
  "src/three/stats-recorder.ts",
  "src/three/systems/player-colors.ts",
  "src/three/utils/centralized-visibility-manager.ts",
  "src/three/utils/easing.ts",
  "src/three/utils/hex-geometry-debug.ts",
  "src/three/utils/hex-geometry-pool.ts",
  "src/three/utils/performance-monitor.ts",
  "src/three/webgpu-postprocess-runtime.ts",
  "src/ui/features/landing/components/game-entry-modal.tsx",
  "src/ui/features/military/chest/chest-container.tsx",
  "src/ui/features/social/components/register-points-button.tsx",
  "src/ui/features/social/realtime-chat/model/store.ts",
  "src/ui/store-managers.tsx",
  "src/utils/chain-time-debug.ts",
  "src/utils/dev-mode.ts",
  "src/utils/shortcuts/centralized-shortcut-manager.ts",
]);

// Shared packages ship in the client bundle and get no informational console
// output at all — errors and warnings only.
const PACKAGE_SOURCE_ROOTS = [
  "packages/core/src",
  "packages/torii/src",
  "packages/provider/src",
  "packages/dojo/src",
  "packages/react/src",
  "packages/types/src",
];

const CLIENT_ROOT = process.cwd();
const REPO_ROOT = resolve(CLIENT_ROOT, "../..");

const INFORMATIONAL_CONSOLE = /\bconsole\.(log|info|debug)\s*\(/;

const CAPTURED_WARN_ERROR_SITES = [
  {
    path: "src/init/bootstrap.tsx",
    required: "formatReadableErrorForConsole(error)",
    forbidden: 'console.error("System call error:", error)',
  },
  {
    path: "src/ui/shared/components/tx-emit.tsx",
    required: "console.error(`Transaction failed: ${consoleReason}`)",
    forbidden: 'console.error("Transaction failed:", reason, payload.error ?? payload.message)',
  },
  {
    path: "src/dojo/gamewide-sync-adapter.ts",
    required: 'appendConsoleFields("[GameSync] authoritative Torii model did not parse into RECS"',
    forbidden: 'console.error("[GameSync] authoritative Torii model did not parse into RECS", {',
  },
  {
    path: "src/dojo/gamewide-sync-adapter.ts",
    required: 'appendConsoleFields("[GameSync] authoritative echo observed before the transaction hash bound"',
    forbidden: 'console.warn("[GameSync] authoritative echo observed before the transaction hash bound", info)',
  },
  {
    path: "src/three/scenes/worldmap.tsx",
    required: "console.warn(formatWorldmapChunkWarning(event, details))",
    forbidden: "console.warn(`[WorldmapChunk] ${event}`, details)",
  },
  {
    path: "packages/provider/src/index.ts",
    required: "formatErrorForConsole(error)",
    forbidden: 'console.warn("[provider] Failed to estimate invoke fee, using default v3 tx details", error)',
    fromRepoRoot: true,
  },
] as const;

const isSourceFile = (name: string) =>
  (name.endsWith(".ts") || name.endsWith(".tsx")) && !name.endsWith(".test.ts") && !name.endsWith(".test.tsx");

const walk = (dir: string, files: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry === "assets") continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, files);
    else if (isSourceFile(entry)) files.push(path);
  }
  return files;
};

const informationalConsoleLines = (path: string): number[] => {
  const lines = readFileSync(path, "utf8").split("\n");
  const hits: number[] = [];
  lines.forEach((line, index) => {
    const trimmed = line.trimStart();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
    if (INFORMATIONAL_CONSOLE.test(line)) hits.push(index + 1);
  });
  return hits;
};

describe("console discipline", () => {
  it("keeps the captured warning and error sites on their single-line formatters", () => {
    for (const site of CAPTURED_WARN_ERROR_SITES) {
      const root = "fromRepoRoot" in site && site.fromRepoRoot ? REPO_ROOT : CLIENT_ROOT;
      const source = readFileSync(join(root, site.path), "utf8");
      expect(source, `${site.path} must keep its focused single-line console formatter`).toContain(site.required);
      expect(source, `${site.path} must not restore the captured raw-object console call`).not.toContain(
        site.forbidden,
      );
    }
  });

  it("keeps informational console output out of unsanctioned client files", () => {
    const offenders: string[] = [];
    for (const file of walk(join(CLIENT_ROOT, "src"))) {
      const relativePath = relative(CLIENT_ROOT, file);
      if (SANCTIONED_CLIENT_FILES.has(relativePath)) continue;
      const hits = informationalConsoleLines(file);
      if (hits.length > 0) offenders.push(`${relativePath}:${hits.join(",")}`);
    }
    expect(
      offenders,
      "console.log/info/debug found outside the sanctioned list. Gate it (verboseLog, DEV, or a debug flag) " +
        "or route the data to the perf collectors; add the file to SANCTIONED_CLIENT_FILES only as a review decision.",
    ).toEqual([]);
  });

  it("keeps shared packages free of informational console output", () => {
    const offenders: string[] = [];
    for (const root of PACKAGE_SOURCE_ROOTS) {
      for (const file of walk(join(REPO_ROOT, root))) {
        const hits = informationalConsoleLines(file);
        if (hits.length > 0) offenders.push(`${relative(REPO_ROOT, file)}:${hits.join(",")}`);
      }
    }
    expect(offenders, "shared packages log errors and warnings only — no console.log/info/debug").toEqual([]);
  });

  it("drops stale sanction entries once a file goes quiet", () => {
    const stale = [...SANCTIONED_CLIENT_FILES].filter(
      (relativePath) => informationalConsoleLines(join(CLIENT_ROOT, relativePath)).length === 0,
    );
    expect(
      stale,
      "these files no longer emit console.log/info/debug — remove them from SANCTIONED_CLIENT_FILES",
    ).toEqual([]);
  });
});
