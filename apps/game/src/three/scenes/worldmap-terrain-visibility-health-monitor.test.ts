import { Box3 } from "three";
import { describe, expect, it, vi } from "vitest";

import {
  WorldmapTerrainVisibilityHealthMonitor,
  type WorldmapTerrainVisibilityHealthMonitorConfig,
  type WorldmapTerrainVisibilityHealthMonitorDeps,
} from "./worldmap-terrain-visibility-health-monitor";

function createHarness(
  configOverrides: Partial<WorldmapTerrainVisibilityHealthMonitorConfig> = {},
  depsOverrides: Partial<WorldmapTerrainVisibilityHealthMonitorDeps> = {},
) {
  let now = 100_000; // start past any cooldown window, as a real performance.now() clock always is
  const deps: WorldmapTerrainVisibilityHealthMonitorDeps = {
    isBoxVisible: vi.fn(() => true),
    getVisibleCellCount: vi.fn(() => 500),
    requestChunkRefresh: vi.fn(() => 1),
    // Never settles: the recovery-in-flight guard stays raised until reset() lowers it.
    waitForRequestedChunkRefresh: vi.fn(() => new Promise<void>(() => {})),
    emitTelemetry: vi.fn(),
    recordBoundsRecovery: vi.fn(),
    now: () => now,
    ...depsOverrides,
  };
  const monitor = new WorldmapTerrainVisibilityHealthMonitor({ selfHealEnabled: true, ...configOverrides }, deps);
  const activeTick = { isWorldmapScene: true, isSwitchedOff: false, currentChunk: "1,1", currentChunkBox: new Box3() };
  const tick = () => monitor.tick(activeTick);
  return { monitor, deps, tick, setNow: (value: number) => (now = value) };
}

const refresh = (deps: WorldmapTerrainVisibilityHealthMonitorDeps) =>
  deps.requestChunkRefresh as ReturnType<typeof vi.fn>;

describe("WorldmapTerrainVisibilityHealthMonitor", () => {
  it("does nothing while self-heal is disabled", () => {
    const { deps, tick } = createHarness({ selfHealEnabled: false }, { isBoxVisible: vi.fn(() => false) });

    for (let i = 0; i < 5; i += 1) tick();

    expect(refresh(deps)).not.toHaveBeenCalled();
    expect(deps.isBoxVisible).not.toHaveBeenCalled();
  });

  it("does nothing when the scene is inactive", () => {
    const { monitor, deps } = createHarness();
    const inactive = { isWorldmapScene: false, isSwitchedOff: false, currentChunk: "1,1", currentChunkBox: new Box3() };

    for (let i = 0; i < 5; i += 1) monitor.tick(inactive);

    expect(refresh(deps)).not.toHaveBeenCalled();
    expect(deps.isBoxVisible).not.toHaveBeenCalled();
  });

  it("forces a refresh once the current chunk stays offscreen past the threshold", () => {
    const { deps, tick } = createHarness({ offscreenChunkFrameThreshold: 2 }, { isBoxVisible: vi.fn(() => false) });

    tick();
    expect(refresh(deps)).not.toHaveBeenCalled();
    tick();

    expect(refresh(deps)).toHaveBeenCalledTimes(1);
    expect(refresh(deps)).toHaveBeenCalledWith(true, "offscreen_chunk");
    expect(deps.recordBoundsRecovery).toHaveBeenCalledTimes(1);
    expect(deps.emitTelemetry).toHaveBeenCalledWith(
      "self_heal_start",
      expect.objectContaining({ reason: "offscreen" }),
    );
  });

  it("forces a refresh once retained terrain reads empty past the threshold", () => {
    const { deps, tick } = createHarness(
      { zeroTerrainFrameThreshold: 3 },
      { isBoxVisible: vi.fn(() => true), getVisibleCellCount: vi.fn(() => 0) },
    );

    // Tick 1 seeds the reference chunk; ticks 2-4 accumulate zero-terrain frames to the threshold.
    for (let i = 0; i < 4; i += 1) tick();

    expect(refresh(deps)).toHaveBeenCalledTimes(1);
    expect(refresh(deps)).toHaveBeenCalledWith(true, "terrain_self_heal");
    expect(deps.emitTelemetry).toHaveBeenCalledWith("self_heal_start", expect.objectContaining({ reason: "zero" }));
  });

  it("does not re-trigger while a recovery is still in flight", () => {
    const { deps, tick, setNow } = createHarness(
      { offscreenChunkFrameThreshold: 2 },
      { isBoxVisible: vi.fn(() => false) },
    );

    tick();
    tick();
    expect(refresh(deps)).toHaveBeenCalledTimes(1);

    setNow(105_000); // past the cooldown — only the in-flight guard can still be blocking
    tick();
    tick();
    expect(refresh(deps)).toHaveBeenCalledTimes(1);
  });

  it("reset clears the in-flight guard so a later anomaly recovers again", () => {
    const { monitor, deps, tick, setNow } = createHarness(
      { offscreenChunkFrameThreshold: 2 },
      { isBoxVisible: vi.fn(() => false) },
    );

    tick();
    tick();
    expect(refresh(deps)).toHaveBeenCalledTimes(1);

    setNow(105_000); // past the cooldown recorded at the first recovery (100_000)
    monitor.reset();
    tick();
    tick();

    expect(refresh(deps)).toHaveBeenCalledTimes(2);
  });

  it("reset preserves the cooldown timestamp so it still rate-limits recovery", () => {
    const { monitor, deps, tick, setNow } = createHarness(
      { offscreenChunkFrameThreshold: 2, terrainRecoveryCooldownMs: 1500 },
      { isBoxVisible: vi.fn(() => false) },
    );

    tick();
    tick();
    expect(refresh(deps)).toHaveBeenCalledTimes(1);

    monitor.reset();
    setNow(100_100); // still inside the 1500ms cooldown window recorded at the first recovery (100_000)
    tick();
    tick();

    expect(refresh(deps)).toHaveBeenCalledTimes(1);
  });
});
