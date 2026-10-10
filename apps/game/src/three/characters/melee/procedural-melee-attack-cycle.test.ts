import { describe, expect, it } from "vitest";

import { applyProceduralMeleeConfigPatch, createDefaultProceduralMeleeConfig } from "./procedural-melee-config";
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
    let state = startProceduralMeleeAttack(createIdleProceduralMeleeAttackState(), config, 0);
    const events: string[] = [];

    for (let step = 0; step < 300 && state.phase !== "idle"; step += 1) {
      const advanced = advanceProceduralMeleeAttack(state, config, 0, 1 / 120);
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
      startProceduralMeleeAttack(createIdleProceduralMeleeAttackState(), config, 0),
      config,
      0,
      config.acquireSeconds + 0.05,
    );
    const cancelled = cancelProceduralMeleeAttack(started.state);
    const completed = advanceProceduralMeleeAttack(cancelled, config, 0, config.recoverSeconds);

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

  it("makes a weapon's attacks in turn by seed and generation, or the one the config names", () => {
    const idle = createIdleProceduralMeleeAttackState();
    const knight = applyProceduralMeleeConfigPatch(createDefaultProceduralMeleeConfig("knight"), {
      offhandId: "t1-knight-default-shield",
      weaponId: "t1-knight-default-sword",
    });
    const attacksOf = (seed: number) => {
      const first = startProceduralMeleeAttack(idle, knight, seed);
      const second = startProceduralMeleeAttack({ ...first, phase: "idle" }, knight, seed);
      return [first.variant, second.variant];
    };

    expect(idle.variant).toBeUndefined();
    expect(startProceduralMeleeAttack(idle, createDefaultProceduralMeleeConfig("paladin"), 7).variant).toBe("smash");
    expect(new Set(attacksOf(0))).toEqual(new Set(["cut", "chop"]));
    expect(attacksOf(1)).toEqual([...attacksOf(0)].reverse());
    const chop = applyProceduralMeleeConfigPatch(knight, { attackVariant: "chop" });
    expect(startProceduralMeleeAttack(idle, chop, 0).variant).toBe("chop");
    expect(startProceduralMeleeAttack(idle, chop, 1).variant).toBe("chop");
    expect(() => applyProceduralMeleeConfigPatch(knight, { attackVariant: "thrust" })).toThrow(
      "t1-knight-default-sword makes no thrust attack",
    );
    expect(applyProceduralMeleeConfigPatch(chop, { weaponId: "iron-longsword" }).attackVariant).toBe("auto");
  });
});
