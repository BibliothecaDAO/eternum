import { describe, it, expect } from "vitest";
import { checkPulse } from "../../../src/automation/pulse.js";
import type { RealmState } from "../../../src/automation/runner.js";

function makeState(overrides: Partial<RealmState> = {}): RealmState {
  return {
    biome: 11, // Grassland → Paladin path
    level: 1, // City
    buildingCounts: new Map(),
    ...overrides,
  };
}

describe("essence pulse — no buildings yet", () => {
  it("looks ahead to first essence milestone even before foundation is built", () => {
    // Foundation steps don't need essence, but PaladinT2 does.
    // The pulse looks ahead so the agent can start planning early.
    const pulse = checkPulse(0, 500, makeState());
    expect(pulse.essence.milestone).not.toBeNull();
    expect(pulse.essence.milestone!.label).toBe("PaladinT2");
    expect(pulse.essence.milestone!.cost).toBe(600);
    expect(pulse.essence.shortfall).toBe(600);
  });
});

describe("essence pulse — approaching T2", () => {
  it("reports shortfall when essence is insufficient for PaladinT2", () => {
    // All foundation + PaladinT1 + WorkersHut built, next is GoldMine (no essence)
    // then PaladinT2 (600 essence)
    const state = makeState({
      buildingCounts: new Map([
        [37, 1], // Wheat
        [1, 2], // 2x WorkersHut
        [4, 1], // Coal
        [6, 1], // Copper
        [5, 1], // Wood
        [34, 1], // PaladinT1
        [9, 1], // GoldMine — built
      ]),
    });

    const pulse = checkPulse(200, 500, state);
    expect(pulse.essence.milestone).not.toBeNull();
    expect(pulse.essence.milestone!.label).toBe("PaladinT2");
    expect(pulse.essence.milestone!.cost).toBe(600);
    expect(pulse.essence.shortfall).toBe(400);
    expect(pulse.essence.sufficient).toBe(false);
    expect(pulse.briefing).toContain("short 400");
    expect(pulse.briefing).toContain("Capture a Fragment Mine");
  });

  it("reports sufficient when essence covers PaladinT2", () => {
    const state = makeState({
      buildingCounts: new Map([
        [37, 1],
        [1, 2],
        [4, 1],
        [6, 1],
        [5, 1],
        [34, 1],
        [9, 1],
      ]),
    });

    const pulse = checkPulse(600, 500, state);
    expect(pulse.essence.sufficient).toBe(true);
    expect(pulse.essence.shortfall).toBe(0);
    expect(pulse.briefing).toContain("sufficient");
    expect(pulse.briefing).not.toContain("Capture");
  });
});

describe("essence pulse — T3 milestone", () => {
  it("finds DragonhideTannery after PaladinT2 is built", () => {
    const state = makeState({
      buildingCounts: new Map([
        [37, 1],
        [1, 2],
        [4, 1],
        [6, 1],
        [5, 1],
        [34, 1],
        [9, 1],
        [35, 2], // 2x PaladinT2 built (both Kingdom-phase copies)
      ]),
    });

    const pulse = checkPulse(100, 500, state);
    expect(pulse.essence.milestone!.label).toBe("DragonhideTannery");
    expect(pulse.essence.milestone!.cost).toBe(600);
    expect(pulse.essence.shortfall).toBe(500);
  });

  it("finds PaladinT3 after DragonhideTannery is built", () => {
    const state = makeState({
      buildingCounts: new Map([
        [37, 1],
        [1, 2],
        [4, 1],
        [6, 1],
        [5, 1],
        [34, 1],
        [9, 1],
        [35, 2], // 2x PaladinT2 (both Kingdom-phase copies)
        [24, 1], // Dragonhide
      ]),
    });

    const pulse = checkPulse(800, 500, state);
    expect(pulse.essence.milestone!.label).toBe("PaladinT3");
    expect(pulse.essence.milestone!.cost).toBe(1200);
    expect(pulse.essence.shortfall).toBe(400);
  });
});

describe("essence pulse — Knight path", () => {
  it("finds KnightT2 milestone for forest biome", () => {
    const state = makeState({
      biome: 12, // Forest → Knight path
      buildingCounts: new Map([
        [37, 1],
        [1, 2],
        [4, 1],
        [6, 1],
        [5, 1],
        [28, 1], // KnightT1
        [13, 1], // ColdIron
      ]),
    });

    const pulse = checkPulse(300, 500, state);
    expect(pulse.essence.milestone!.label).toBe("KnightT2");
    expect(pulse.essence.milestone!.cost).toBe(600);
  });
});

describe("wheat pulse", () => {
  it("reports low wheat when few moves remaining", () => {
    const pulse = checkPulse(500, 100, makeState());
    expect(pulse.wheat.low).toBe(true);
    expect(pulse.wheat.movesRemaining).toBe(5);
    expect(pulse.briefing).toContain("LOW");
    expect(pulse.briefing).toContain("Prioritize food");
  });

  it("reports healthy wheat when plenty of moves", () => {
    const pulse = checkPulse(500, 500, makeState());
    expect(pulse.wheat.low).toBe(false);
    expect(pulse.wheat.movesRemaining).toBe(25);
    expect(pulse.briefing).not.toContain("LOW");
  });

  it("reports zero moves when no wheat", () => {
    const pulse = checkPulse(500, 0, makeState());
    expect(pulse.wheat.low).toBe(true);
    expect(pulse.wheat.movesRemaining).toBe(0);
  });
});

describe("briefing format", () => {
  it("combines essence and wheat into readable briefing", () => {
    const state = makeState({
      buildingCounts: new Map([
        [37, 1],
        [1, 2],
        [4, 1],
        [6, 1],
        [5, 1],
        [34, 1],
        [9, 1],
      ]),
    });

    const pulse = checkPulse(200, 150, state);
    const lines = pulse.briefing.split("\n");

    // Should have essence status, action, wheat status, action
    expect(lines.length).toBe(4);
    expect(lines[0]).toContain("Essence:");
    expect(lines[1]).toContain("Action:");
    expect(lines[2]).toContain("Wheat:");
    expect(lines[3]).toContain("Action:");
  });
});
