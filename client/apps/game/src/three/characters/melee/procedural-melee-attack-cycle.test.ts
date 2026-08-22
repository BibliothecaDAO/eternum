import { describe, expect, it } from "vitest";

import { createDefaultProceduralMeleeConfig } from "./procedural-melee-config";
import {
  advanceProceduralMeleeAttack,
  cancelProceduralMeleeAttack,
  createIdleProceduralMeleeAttackState,
  resolveProceduralMeleeAttackSignals,
  startProceduralMeleeAttack,
} from "./procedural-melee-attack-cycle";

describe("procedural melee attack cycle", () => {
  it("emits exactly one contact edge before recovering", () => {
    const config = createDefaultProceduralMeleeConfig();
    let state = startProceduralMeleeAttack(createIdleProceduralMeleeAttackState());
    const events: string[] = [];

    for (let step = 0; step < 300 && state.phase !== "idle"; step += 1) {
      const advanced = advanceProceduralMeleeAttack(state, config, 1 / 120);
      state = advanced.state;
      events.push(...advanced.events.map(({ type }) => type));
    }

    expect(events.filter((event) => event === "contact")).toHaveLength(1);
    expect(events.at(-1)).toBe("recovered");
    expect(state.contactCount).toBe(1);
  });

  it("cancels a windup without producing contact", () => {
    const config = createDefaultProceduralMeleeConfig();
    const started = advanceProceduralMeleeAttack(
      startProceduralMeleeAttack(createIdleProceduralMeleeAttackState()),
      config,
      config.acquireSeconds + 0.05,
    );
    const cancelled = cancelProceduralMeleeAttack(started.state);
    const completed = advanceProceduralMeleeAttack(cancelled, config, config.recoverSeconds);

    expect(started.state.phase).toBe("windup");
    expect(started.events).toEqual([]);
    expect(completed.events).toEqual([{ attackGeneration: 1, type: "recovered" }]);
    expect(completed.state.contactCount).toBe(0);
  });

  it("exposes continuous anticipation and strike signals", () => {
    const config = createDefaultProceduralMeleeConfig();
    const windup = resolveProceduralMeleeAttackSignals(
      {
        ...createIdleProceduralMeleeAttackState(),
        attackGeneration: 1,
        phase: "windup",
        phaseElapsedSeconds: config.windupSeconds / 2,
      },
      config,
    );
    const strike = resolveProceduralMeleeAttackSignals(
      {
        ...createIdleProceduralMeleeAttackState(),
        attackGeneration: 1,
        phase: "strike",
        phaseElapsedSeconds: config.strikeSeconds / 2,
      },
      config,
    );

    expect(windup.windupProgress).toBeCloseTo(0.5);
    expect(strike.strikeProgress).toBeCloseTo(0.5);
    expect(strike.actionWeight).toBe(1);
  });
});
