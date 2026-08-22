import { describe, expect, it } from "vitest";

import { createDefaultProceduralArcherConfig } from "./procedural-archer-config";
import {
  advanceProceduralArcherShot,
  cancelProceduralArcherShot,
  createIdleProceduralArcherShotState,
  resolveProceduralArcherShotSignals,
  startProceduralArcherShot,
} from "./procedural-archer-shot-cycle";

describe("procedural archer shot cycle", () => {
  it("emits one release edge and returns to idle", () => {
    const config = createDefaultProceduralArcherConfig();
    let state = startProceduralArcherShot(createIdleProceduralArcherShotState());
    const events: string[] = [];

    for (let step = 0; step < 400 && state.phase !== "idle"; step += 1) {
      const advanced = advanceProceduralArcherShot(state, config, 1 / 120);
      state = advanced.state;
      events.push(...advanced.events.map(({ type }) => type));
    }

    expect(events.filter((event) => event === "release")).toHaveLength(1);
    expect(events.at(-1)).toBe("recovered");
    expect(state.phase).toBe("idle");
    expect(state.releaseCount).toBe(1);
  });

  it("cancels a pre-release shot without emitting a projectile", () => {
    const config = createDefaultProceduralArcherConfig();
    const started = advanceProceduralArcherShot(
      startProceduralArcherShot(createIdleProceduralArcherShotState()),
      config,
      0.2,
    );
    const cancelled = cancelProceduralArcherShot(started.state);
    const completed = advanceProceduralArcherShot(cancelled, config, config.recoverSeconds);

    expect(started.events).toEqual([]);
    expect(cancelled.phase).toBe("recover");
    expect(completed.events).toEqual([{ type: "recovered", shotGeneration: 1 }]);
    expect(completed.state.releaseCount).toBe(0);
  });

  it("keeps the preview arrow owned by the actor until release", () => {
    const config = createDefaultProceduralArcherConfig();
    const state = {
      ...createIdleProceduralArcherShotState(),
      phase: "draw" as const,
      phaseElapsedSeconds: config.drawSeconds / 2,
      shotGeneration: 1,
    };
    const signals = resolveProceduralArcherShotSignals(state, config);

    expect(signals.previewArrowVisible).toBe(true);
    expect(signals.drawFraction).toBeCloseTo(0.5);
    expect(signals.actionWeight).toBe(1);
  });
});
