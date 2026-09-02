// @vitest-environment node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("P7D push ownership gates", () => {
  it("keeps the route free of reconnect grace timers — the identity session owns reconnect", () => {
    expect(existsSync(resolve(process.cwd(), "src/hooks/context/use-unified-onboarding.ts"))).toBe(false);
    expect(source("src/game-entry/play-route-boot.ts")).not.toContain("PLAY_ROUTE_RECONNECT_GRACE_MS");
  });

  it("removes superseded scene-ready events and orphan polling surfaces", () => {
    const loadingHelpers = source("src/ui/layouts/game-loading-overlay.utils.ts");
    const polling = source("src/config/polling.ts");
    const diagnostics = source("src/three/perf/worldmap-render-diagnostics.ts");

    expect(loadingHelpers).not.toContain("READY_EVENT");
    expect(loadingHelpers).not.toContain("waitForWorldmapSceneReady");
    expect(polling).not.toContain("playerStructuresMs");
    expect(diagnostics).not.toContain('"army_dead"');
  });

  it("settles entry waits from entity changes and verifies fee top-ups", () => {
    const entityWait = source("src/ui/features/landing/components/selected-world-entity-wait.ts");
    const registration = source("src/hooks/use-world-registration.ts");

    expect(entityWait).toContain("HeraldGameSyncTransport");
    expect(entityWait).toContain("is still waiting after");
    expect(registration).toContain("const confirmedBalance = await fetchTokenBalance");
    expect(registration).not.toContain("setTimeout(resolve, 2000)");
  });

  it("invalidates automation snapshots from the spatial projection", () => {
    const automation = source("src/hooks/use-exploration-automation-runner.ts");

    expect(automation).toContain("worldSpatialProjection.subscribe");
    expect(automation).toContain("snapshotCacheRef.current.clear()");
    expect(automation).not.toContain("FAST_CACHE_TTL_MS");
  });
});
