import { describe, expect, it } from "vitest";

import {
  applyProceduralCharacterBenchmarkConfigPatch,
  createDefaultProceduralCharacterBenchmarkConfig,
  createProceduralCharacterWalkingPerformanceConfig,
} from "./procedural-character-benchmark-config";
import {
  advanceProceduralCharacterBenchmarkSimulation,
  BENCHMARK_FIXED_STEP_SECONDS,
  BENCHMARK_HEX_CELLS,
  BENCHMARK_HEX_COUNT,
  createProceduralCharacterBenchmarkSimulation,
  killProceduralCharacterBenchmarkAgents,
  resolveProceduralCharacterBenchmarkSimulationSnapshot,
} from "./procedural-character-benchmark-simulation";

describe("procedural character benchmark simulation", () => {
  it("normalizes unsafe live-control edits at the benchmark boundary", () => {
    const config = applyProceduralCharacterBenchmarkConfigPatch(createDefaultProceduralCharacterBenchmarkConfig(), {
      actorCount: 500,
      animationUpdateLanes: 10,
      corpseSeconds: -1,
      deathsPerSecond: 50,
      maxActiveRagdolls: 100,
      pixelRatio: 4,
      simulationSpeed: Number.NaN,
    });

    expect(config).toMatchObject({
      actorCount: 100,
      animationUpdateLanes: 4,
      corpseSeconds: 0.5,
      deathsPerSecond: 10,
      maxActiveRagdolls: 20,
      pixelRatio: 1.5,
      simulationSpeed: 0.1,
    });
  });

  it("defines one deterministic 100-unit walking performance profile", () => {
    expect(createProceduralCharacterWalkingPerformanceConfig()).toMatchObject({
      actorCount: 100,
      animationUpdateLanes: 3,
      archerVolleys: false,
      autoRotate: false,
      deathsPerSecond: 0,
      maxActiveRagdolls: 0,
      meleeAttacks: false,
      pixelRatio: 1,
      shadows: false,
      unitMix: "foot",
    });
  });

  it("builds a centered 10 by 10 hex board with valid adjacency", () => {
    expect(BENCHMARK_HEX_CELLS).toHaveLength(100);
    expect(BENCHMARK_HEX_COUNT).toBe(100);
    expect(BENCHMARK_HEX_CELLS.every((cell) => cell.neighbors.length >= 2 && cell.neighbors.length <= 6)).toBe(true);
    expect(BENCHMARK_HEX_CELLS.flatMap((cell) => cell.neighbors).every((index) => index >= 0 && index < 100)).toBe(
      true,
    );
    expect(BENCHMARK_HEX_CELLS.reduce((sum, cell) => sum + cell.x, 0)).toBeCloseTo(0);
    expect(BENCHMARK_HEX_CELLS.reduce((sum, cell) => sum + cell.z, 0)).toBeCloseTo(0);
  });

  it("replays identical movement, deaths, and respawns from one seed", () => {
    const config = applyProceduralCharacterBenchmarkConfigPatch(createDefaultProceduralCharacterBenchmarkConfig(), {
      actorCount: 12,
      corpseSeconds: 0.5,
      deathsPerSecond: 4,
      maxActiveRagdolls: 3,
      seed: 77,
    });
    const first = createProceduralCharacterBenchmarkSimulation(config);
    const second = createProceduralCharacterBenchmarkSimulation(config);

    for (let step = 0; step < 180; step += 1) {
      expect(advanceProceduralCharacterBenchmarkSimulation(first, config, BENCHMARK_FIXED_STEP_SECONDS)).toEqual(
        advanceProceduralCharacterBenchmarkSimulation(second, config, BENCHMARK_FIXED_STEP_SECONDS),
      );
    }

    expect(first).toEqual(second);
    expect(first.totalDeaths).toBeGreaterThan(0);
    expect(first.totalRespawns).toBeGreaterThan(0);
  });

  it("caps a death burst without reducing the total actor population", () => {
    const config = applyProceduralCharacterBenchmarkConfigPatch(createDefaultProceduralCharacterBenchmarkConfig(), {
      actorCount: 100,
      deathsPerSecond: 0,
      maxActiveRagdolls: 8,
    });
    const state = createProceduralCharacterBenchmarkSimulation(config);
    const events = killProceduralCharacterBenchmarkAgents(state, config, 20);
    const snapshot = resolveProceduralCharacterBenchmarkSimulationSnapshot(state);

    expect(events).toHaveLength(8);
    expect(snapshot).toMatchObject({ actorCount: 100, ragdollCount: 8, runningCount: 92, totalDeaths: 8 });
  });
});
