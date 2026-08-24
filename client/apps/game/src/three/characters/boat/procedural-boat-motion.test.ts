import { describe, expect, it } from "vitest";

import { createDefaultProceduralBoatConfig } from "./procedural-boat-config";
import { resolveProceduralBoatMotion } from "./procedural-boat-motion";

const IDLE_BROADSIDE = { brace: 0, muzzleFlash: 0, recoil: 0, stateProgress: 0 };

describe("procedural boat motion", () => {
  it("is deterministic, finite, and bounded for a shared seed and clock", () => {
    const config = createDefaultProceduralBoatConfig();
    const first = resolveProceduralBoatMotion(config, 8.25, IDLE_BROADSIDE, "starboard");
    const second = resolveProceduralBoatMotion(config, 8.25, IDLE_BROADSIDE, "starboard");

    expect(first).toEqual(second);
    expect(Object.values(first).every(Number.isFinite)).toBe(true);
    expect(Math.abs(first.heave)).toBeLessThanOrEqual(config.heaveAmplitude);
    expect(first.wakeStrength).toBeGreaterThan(0);
    expect(first.wakeStrength).toBeLessThanOrEqual(1);
  });

  it("sinks monotonically below the waterline and rolls toward the damaged side", () => {
    const config = createDefaultProceduralBoatConfig();
    const samples = [0, 1, 2, 3, 4.2].map((elapsedSeconds) =>
      resolveProceduralBoatMotion(config, elapsedSeconds, IDLE_BROADSIDE, "port", {
        elapsedSeconds,
        side: "port",
      }),
    );

    expect(samples.map(({ sinkProgress }) => sinkProgress)).toEqual(
      [...samples.map(({ sinkProgress }) => sinkProgress)].toSorted((left, right) => left - right),
    );
    expect(samples.map(({ sinkY }) => sinkY)).toEqual(
      [...samples.map(({ sinkY }) => sinkY)].toSorted((left, right) => right - left),
    );
    expect(samples.at(-1)?.sinkY).toBeCloseTo(-config.sinkDepth);
    expect(samples.at(-1)?.rollRadians).toBeGreaterThan(0);
    expect(samples.at(-1)?.wakeStrength).toBe(0);
  });
});
