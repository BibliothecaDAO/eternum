import { describe, expect, it } from "vitest";

import {
  createWorldFxGymFixture,
  resolveWorldFxGymCount,
  resolveWorldFxGymScenario,
  resolveWorldFxGymSeed,
  resolveWorldFxGymView,
} from "./world-fx-gym-fixture";

describe("world FX gym fixture", () => {
  it("builds deterministic flame and impact layouts", () => {
    const first = createWorldFxGymFixture({ count: 10, scenario: "mixed", seed: 42 });
    const second = createWorldFxGymFixture({ count: 10, scenario: "mixed", seed: 42 });

    expect(first.persistentEmitters).toHaveLength(3);
    expect(first.transientCues).toHaveLength(10);
    expect(first.persistentEmitters).toEqual(second.persistentEmitters);
    expect(first.transientCues).toEqual(second.transientCues);
    expect(first.positions.reduce((sum, position) => sum + position.x, 0)).toBeCloseTo(0);
  });

  it("keeps scenario composition explicit", () => {
    expect(createWorldFxGymFixture({ count: 1, scenario: "flame", seed: 1 }).transientCues).toHaveLength(0);
    expect(createWorldFxGymFixture({ count: 1, scenario: "impact", seed: 1 }).persistentEmitters).toHaveLength(0);
    const auras = createWorldFxGymFixture({ count: 10, scenario: "aura", seed: 1 }).persistentEmitters;
    expect(auras).toHaveLength(10);
    expect(new Set(auras.flatMap((emitter) => (emitter.kind === "aura" ? [emitter.style] : [])))).toEqual(
      new Set(["capture", "healing", "shield"]),
    );
    const realm = createWorldFxGymFixture({ count: 50, scenario: "realm-flame", seed: 1 });
    expect(realm.stageKind).toBe("realm");
    expect(realm.persistentEmitters).toHaveLength(3);
    expect(realm.transientCues).toHaveLength(0);
    const flows = createWorldFxGymFixture({ count: 50, scenario: "resource-flow", seed: 1 });
    expect(flows.stageKind).toBe("resource-map");
    expect(flows.resourceFlows).toHaveLength(4);
    expect(flows.resourceFlows.flatMap((flow) => flow.resources)).toHaveLength(8);
    const stress = createWorldFxGymFixture({ count: 50, scenario: "resource-flow-stress", seed: 1 });
    expect(stress.resourceFlows).toHaveLength(50);
    expect(stress.resourceFlows.flatMap((flow) => flow.resources)).toHaveLength(99);
  });

  it("normalizes route inputs", () => {
    expect(resolveWorldFxGymCount("50")).toBe(50);
    expect(resolveWorldFxGymCount("17")).toBe(10);
    expect(resolveWorldFxGymScenario("flame")).toBe("flame");
    expect(resolveWorldFxGymScenario("realm-flame")).toBe("realm-flame");
    expect(resolveWorldFxGymScenario("unknown")).toBe("mixed");
    expect(resolveWorldFxGymSeed("-1")).toBe(4_294_967_295);
    expect(resolveWorldFxGymSeed("bad")).toBe(20_260_902);
    expect(resolveWorldFxGymView("gameplay")).toBe("gameplay");
    expect(resolveWorldFxGymView("unknown")).toBe("detail");
  });
});
