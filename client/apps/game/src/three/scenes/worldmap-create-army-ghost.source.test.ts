// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const worldmapSource = readFileSync(new URL("./worldmap.tsx", import.meta.url), "utf8");
const bridgeSource = readFileSync(new URL("./worldmap-provisional-fx.ts", import.meta.url), "utf8");

describe("worldmap provisional action FX", () => {
  it("uses a renderer lifecycle bridge instead of window events", () => {
    expect(bridgeSource).toContain("registerWorldmapProvisionalFxRenderer");
    expect(worldmapSource).toContain("startWorldmapProvisionalFx(spec, intent)");
    expect(worldmapSource).not.toContain("CustomEvent<PendingWorldmapFx");
    expect(worldmapSource).not.toContain("WORLDMAP_PENDING_FX");
  });

  it("clears attack FX from intent outcomes without an FX timeout", () => {
    expect(worldmapSource).toContain("unsubscribe = intent.subscribe(cleanup)");
    expect(worldmapSource).not.toContain("pendingActionEffectTimeoutsByKey");
    expect(worldmapSource).not.toContain('"stale_timeout"');
  });

  it("settles create-army ghosts from authoritative projection occupancy", () => {
    expect(worldmapSource).toContain("this.getArmyAtHex(pending.targetHex)");
    expect(worldmapSource).toContain('this.clearPendingCreateArmyGhost(key, "projection_occupied")');
    expect(worldmapSource).not.toContain("nextPendingCreateArmyGhostId = -1");
  });
});
