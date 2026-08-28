import { describe, expect, it } from "vitest";

import { createDefaultProceduralBoatConfig } from "./procedural-boat-config";
import {
  advanceProceduralBoatBroadside,
  createIdleProceduralBoatBroadsideState,
  resolveProceduralBoatBroadsideSignals,
  startProceduralBoatBroadside,
} from "./procedural-boat-broadside-cycle";

describe("procedural boat broadside cycle", () => {
  it("emits exactly one deterministic release edge and recovers", () => {
    const config = createDefaultProceduralBoatConfig();
    let state = startProceduralBoatBroadside(createIdleProceduralBoatBroadsideState(), "port");
    const events = [];

    for (let step = 0; step < 300 && state.phase !== "idle"; step += 1) {
      const advanced = advanceProceduralBoatBroadside(state, config, 1 / 120);
      state = advanced.state;
      events.push(...advanced.events);
    }

    expect(events.filter(({ type }) => type === "release")).toEqual([{ generation: 1, side: "port", type: "release" }]);
    expect(events.at(-1)).toEqual({ generation: 1, type: "recovered" });
    expect(state.phase).toBe("idle");
    expect(state.releaseCount).toBe(1);
  });

  it("produces bounded brace, flash, and recoil signals", () => {
    const config = createDefaultProceduralBoatConfig();
    let state = startProceduralBoatBroadside(createIdleProceduralBoatBroadsideState(), "starboard");
    const observed: number[] = [];

    for (let step = 0; step < 250 && state.phase !== "idle"; step += 1) {
      state = advanceProceduralBoatBroadside(state, config, 1 / 120).state;
      const signals = resolveProceduralBoatBroadsideSignals(state, config);
      observed.push(signals.brace, signals.muzzleFlash, signals.recoil);
    }

    expect(Math.min(...observed)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...observed)).toBeLessThanOrEqual(1);
    expect(Math.max(...observed)).toBeGreaterThan(0.9);
  });
});
