import { describe, expect, it } from "vitest";

import { createDefaultProceduralDragonConfig } from "./procedural-dragon-config";
import {
  advanceProceduralDragonFire,
  createIdleProceduralDragonFireState,
  resolveProceduralDragonFireSignals,
  startProceduralDragonFire,
} from "./procedural-dragon-fire-cycle";

describe("procedural dragon fire cycle", () => {
  it("emits one release edge and recovers to idle", () => {
    const config = createDefaultProceduralDragonConfig();
    let state = startProceduralDragonFire(createIdleProceduralDragonFireState());
    const events = [];
    for (let frame = 0; frame < 240 && state.phase !== "idle"; frame += 1) {
      const advanced = advanceProceduralDragonFire(state, config, 1 / 60, false);
      state = advanced.state;
      events.push(...advanced.events);
    }

    expect(events.filter(({ type }) => type === "release")).toHaveLength(1);
    expect(state.phase).toBe("idle");
    expect(state.releaseCount).toBe(1);
  });

  it("opens the jaw and exposes a bounded breath signal during fire", () => {
    const config = createDefaultProceduralDragonConfig();
    let state = startProceduralDragonFire(createIdleProceduralDragonFireState());
    state = advanceProceduralDragonFire(state, config, config.acquireSeconds + config.inhaleSeconds + 0.1, false).state;
    const signals = resolveProceduralDragonFireSignals(state, config);

    expect(state.phase).toBe("fire");
    expect(signals.jawOpen).toBeGreaterThan(0.8);
    expect(signals.breath).toBeGreaterThan(0);
    expect(signals.breath).toBeLessThanOrEqual(1);
  });
});
