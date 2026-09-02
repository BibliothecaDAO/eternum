// @vitest-environment node

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

type AllowedTimerClass = "clock" | "debug" | "external" | "scheduler" | "ui";

interface AllowedTimer {
  class: AllowedTimerClass;
  reason: string;
}

const ALLOWED_TIMERS: Record<string, AllowedTimer> = {
  "apps/game/src/hooks/store/use-chain-time-store.ts": {
    class: "clock",
    reason: "local interpolation between Herald heads",
  },
  "apps/game/src/three/managers/ambience-manager.ts": { class: "debug", reason: "developer ambience counters" },
  "apps/game/src/three/managers/army-manager.ts": { class: "debug", reason: "developer army counters" },
  "apps/game/src/three/managers/structure-manager.ts": { class: "clock", reason: "local timed-label interpolation" },
  "apps/game/src/three/managers/weather-manager.ts": { class: "debug", reason: "developer weather counters" },
  "apps/game/src/three/systems/wind-system.ts": { class: "debug", reason: "developer wind counters" },
  "apps/game/src/ui/components/transaction-center/transaction-item.tsx": { class: "ui", reason: "elapsed-time label" },
  "apps/game/src/ui/components/world-countdown.tsx": { class: "clock", reason: "countdown interpolation" },
  "apps/game/src/ui/debug/army-movement-latency-overlay.tsx": { class: "debug", reason: "local metrics repaint" },
  "apps/game/src/ui/debug/dev-sync-overlay.tsx": { class: "debug", reason: "local age-label repaint" },
  "apps/game/src/ui/features/cosmetics/components/cosmetic-model-viewer.tsx": {
    class: "ui",
    reason: "renderer readiness check",
  },
  "apps/game/src/ui/features/debug/procedural-terrain-benchmark-view.tsx": {
    class: "debug",
    reason: "developer benchmark repaint",
  },
  "apps/game/src/ui/features/debug/procedural-terrain-debug-view.tsx": {
    class: "debug",
    reason: "developer terrain metrics repaint",
  },
  "apps/game/src/ui/features/economy/resources/resource-chip.tsx": {
    class: "clock",
    reason: "production interpolation",
  },
  "apps/game/src/ui/features/economy/trading/resource-arrivals.tsx": {
    class: "clock",
    reason: "arrival countdown interpolation",
  },
  "apps/game/src/ui/features/factory-v2/hooks/use-factory-v2.ts": {
    class: "external",
    reason: "deployment worker run status cannot push",
  },
  "apps/game/src/ui/features/infrastructure/automation/production-automation-dashboard.tsx": {
    class: "clock",
    reason: "automation countdown interpolation",
  },
  "apps/game/src/ui/features/landing/components/game-entry-modal.tsx": {
    class: "ui",
    reason: "reveal animation and registration countdown",
  },
  "apps/game/src/ui/features/landing/components/game-review-modal.tsx": {
    class: "clock",
    reason: "review playback interpolation",
  },
  "apps/game/src/ui/features/military/battle/battle-cooldown-timer.tsx": {
    class: "clock",
    reason: "battle cooldown interpolation",
  },
  "apps/game/src/ui/features/military/battle/quick-attack-preview.tsx": {
    class: "clock",
    reason: "battle cooldown interpolation",
  },
  "apps/game/src/ui/features/military/components/exploration-automation-dashboard.tsx": {
    class: "clock",
    reason: "automation countdown interpolation",
  },
  "apps/game/src/ui/features/military/components/structure-defence.tsx": {
    class: "clock",
    reason: "stamina interpolation",
  },
  "apps/game/src/ui/features/prize/prize-panel.tsx": { class: "clock", reason: "prize countdown interpolation" },
  "apps/game/src/ui/features/settlement/construction/select-preview-building.tsx": {
    class: "clock",
    reason: "production interpolation",
  },
  "apps/game/src/ui/features/settlement/production/production-sidebar.tsx": {
    class: "clock",
    reason: "production interpolation",
  },
  "apps/game/src/ui/features/social/components/register-points-button.tsx": {
    class: "clock",
    reason: "points interpolation",
  },
  "apps/game/src/ui/features/social/components/social.tsx": {
    class: "clock",
    reason: "leaderboard points interpolation",
  },
  "apps/game/src/ui/features/social/player/use-leaderboard-effects.ts": {
    class: "debug",
    reason: "opt-in mock effect generator",
  },
  "apps/game/src/ui/features/world/components/hyperstructures/leaderboard.tsx": {
    class: "clock",
    reason: "leaderboard points interpolation",
  },
  "apps/game/src/ui/features/world/components/network-status-banner.tsx": { class: "ui", reason: "outage age label" },
  "apps/game/src/ui/features/world/components/network-status-pill.tsx": { class: "ui", reason: "stream age label" },
  "apps/game/src/ui/features/world/containers/left-facets/empire-cockpit.tsx": {
    class: "clock",
    reason: "arrival countdown interpolation",
  },
  "apps/game/src/ui/features/world/containers/left-facets/merged-resource-panel.tsx": {
    class: "clock",
    reason: "production interpolation",
  },
  "apps/game/src/ui/features/world/containers/top-header/game-end-timer.tsx": {
    class: "clock",
    reason: "game countdown interpolation",
  },
  "apps/game/src/ui/features/world/containers/top-header/game-start-countdown.tsx": {
    class: "clock",
    reason: "game countdown interpolation",
  },
  "apps/game/src/ui/layouts/bootstrap-loading/bootstrap-loading-panel.tsx": {
    class: "ui",
    reason: "loading elapsed-time label",
  },
  "apps/game/src/ui/layouts/game-loading-overlay.tsx": { class: "ui", reason: "loading progress animation" },
  "apps/game/src/ui/modules/boot-loader/boot-debug-panel.tsx": { class: "debug", reason: "boot metrics repaint" },
  "apps/game/src/ui/shared/components/block-timestamp-poller.tsx": {
    class: "clock",
    reason: "local chain-time interpolation",
  },
  "apps/game/src/ui/action-runners.tsx": { class: "scheduler", reason: "submits due point claims on chain time" },
  "packages/core/src/managers/leaderboard-manager.ts": { class: "clock", reason: "accrued points interpolation" },
};

const ALLOWED_RECURRING_TIMEOUTS: Record<string, AllowedTimer & { callback: string }> = {
  "apps/game/src/hooks/use-automation.tsx": {
    callback: "void runAutomationIfDue()",
    class: "scheduler",
    reason: "submits production automation when chain time makes it due",
  },
  "apps/game/src/hooks/use-exploration-automation-runner.ts": {
    callback: "void processRef.current()",
    class: "scheduler",
    reason: "submits exploration automation when chain time makes it due",
  },
  "apps/game/src/hooks/use-transfer-automation-runner.ts": {
    callback: "void processRef.current()",
    class: "scheduler",
    reason: "submits transfer automation when chain time makes it due",
  },
  "packages/core/src/sync/herald-game-sync-transport.ts": {
    callback: "this.connect()",
    class: "scheduler",
    reason: "reconnects a closed Herald stream without polling chain state",
  },
};

const ALLOWED_TRANSACTION_WAITS: Record<string, string> = {
  "apps/game/src/sync/game-sync.ts": "injects the active Herald transaction channel into the provider",
  "apps/game/src/observability/observed-client-transaction.ts": "resolves an observed submit from the Herald channel",
  "apps/game/src/three/scenes/worldmap.tsx": "resolves movement from the Herald channel",
  "apps/game/src/ui/utils/transactions.ts": "resolves a submitted hash from the Herald channel",
  "packages/core/src/sync/game-sync-runtime.ts": "owns the Herald transaction-channel waiter",
  "packages/core/src/account/gameplay-account.ts":
    "one bounded deployment wait for non-browser callers that do not have a Herald session",
};

const REPO_ROOT = resolve(process.cwd(), "../..");
const SOURCE_ROOTS = ["apps/game/src", "packages/core/src", "packages/provider/src", "packages/react/src"];
const TIMER_PATTERN = /\bsetInterval\s*\(|\brefetchInterval\s*:/;
const TRANSACTION_WAIT_PATTERN = /\bwaitForTransaction\s*\(/;

const walk = (directory: string, files: string[] = []): string[] => {
  for (const entry of readdirSync(directory)) {
    if (["assets", "dist", "node_modules"].includes(entry)) continue;
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) walk(path, files);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|source\.test)\.(ts|tsx)$/.test(entry)) files.push(path);
  }
  return files;
};

const source = (path: string): string => readFileSync(join(REPO_ROOT, path), "utf8");

describe("polling discipline", () => {
  it("requires a class and reason for every surviving interval", () => {
    const actual = SOURCE_ROOTS.flatMap((root) => walk(join(REPO_ROOT, root)))
      .filter((path) => TIMER_PATTERN.test(readFileSync(path, "utf8")))
      .map((path) => relative(REPO_ROOT, path))
      .toSorted();
    const allowed = Object.keys(ALLOWED_TIMERS).toSorted();

    expect(actual, "classify a new interval or replace it with a stream/clock subscription").toEqual(allowed);
    expect(Object.values(ALLOWED_TIMERS).every((entry) => entry.reason.trim().length > 0)).toBe(true);
  });

  it("keeps chain facts, health, and transaction status off polling loops", () => {
    expect(source("packages/provider/src/index.ts")).not.toContain("this.provider.waitForTransaction(");
    expect(source("apps/game/src/ui/shared/components/chain-time-poller.tsx")).not.toContain('getBlock("latest")');
    expect(source("apps/game/src/ui/features/military/components/exploration-automation-dashboard.tsx")).not.toContain(
      "refreshExplorerPositions",
    );
    expect(existsSync(join(REPO_ROOT, "apps/game/src/dojo"))).toBe(false);
    expect(source("apps/game/src/init/bootstrap.tsx")).not.toContain("probeWorldToriiAlive");
  });

  it("allows transaction waits only at Herald channel call sites", () => {
    const actual = SOURCE_ROOTS.flatMap((root) => walk(join(REPO_ROOT, root)))
      .filter((path) => TRANSACTION_WAIT_PATTERN.test(readFileSync(path, "utf8")))
      .map((path) => relative(REPO_ROOT, path))
      .toSorted();

    expect(actual, "route a transaction wait through the Herald tx channel").toEqual(
      Object.keys(ALLOWED_TRANSACTION_WAITS).toSorted(),
    );
    expect(Object.values(ALLOWED_TRANSACTION_WAITS).every((reason) => reason.trim().length > 0)).toBe(true);
  });

  it("documents every surviving recurring timeout as a scheduler", () => {
    for (const [path, entry] of Object.entries(ALLOWED_RECURRING_TIMEOUTS)) {
      expect(source(path), path).toContain(entry.callback);
      expect(entry.class).toBe("scheduler");
      expect(entry.reason.trim().length).toBeGreaterThan(0);
    }
  });

  it("keeps migrated fact readers off query polling", () => {
    [
      "apps/game/src/hooks/store/use-story-events-store.ts",
      "apps/game/src/hooks/use-player-world-registrations.ts",
      "apps/game/src/hooks/use-world-availability.ts",
      "apps/game/src/hooks/use-worlds-summary.ts",
      "apps/game/src/ui/features/landing/components/game-entry-modal.tsx",
      "apps/game/src/ui/features/landing/components/use-settlement-planner-data.ts",
      "apps/game/src/ui/features/social/faith/faith-leaderboard-panel.tsx",
      "apps/game/src/ui/features/social/faith/wonder-faith-detail-panel.tsx",
      "apps/game/src/ui/features/world/components/actions/faith-devotion-action-panel.tsx",
    ].forEach((path) => expect(source(path), path).not.toContain("refetchInterval"));
  });
});
