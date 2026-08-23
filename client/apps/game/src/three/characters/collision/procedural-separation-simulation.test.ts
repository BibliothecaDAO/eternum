import { describe, expect, it } from "vitest";

import { createProceduralCollisionProfile } from "./procedural-collision-profile";
import { ProceduralSeparationSimulation, type ProceduralSeparationInput } from "./procedural-separation-simulation";

const knight = createProceduralCollisionProfile("knight");
const paladin = createProceduralCollisionProfile("paladin");

describe("procedural anchored separation simulation", () => {
  it("preserves an isolated authoritative anchor", () => {
    const simulation = new ProceduralSeparationSimulation();
    simulation.stepOnce([body(1, 3, -2)]);

    expect(simulation.getBodySnapshot(1)).toMatchObject({
      anchorX: 3,
      anchorZ: -2,
      contactCount: 0,
      offsetX: 0,
      offsetZ: 0,
      positionX: 3,
      positionZ: -2,
    });
  });

  it("separates equal overlapping units reciprocally without changing their anchors", () => {
    const simulation = new ProceduralSeparationSimulation({ solverIterations: 2 });
    simulation.stepOnce([body(1, -0.2, 0), body(2, 0.2, 0)]);
    const left = simulation.getBodySnapshot(1)!;
    const right = simulation.getBodySnapshot(2)!;

    expect(left.anchorX).toBe(-0.2);
    expect(right.anchorX).toBe(0.2);
    expect(left.offsetX).toBeLessThan(0);
    expect(right.offsetX).toBeGreaterThan(0);
    expect(Math.abs(left.offsetX)).toBeCloseTo(Math.abs(right.offsetX), 6);
    expect(left.contactCount).toBeGreaterThan(0);
    expect(right.contactCount).toBeGreaterThan(0);
  });

  it("gives a lighter foot unit more displacement than a mounted unit", () => {
    const simulation = new ProceduralSeparationSimulation();
    simulation.stepOnce([body(1, -0.2, 0, knight), body(2, 0.2, 0, paladin)]);
    const footOffset = Math.abs(simulation.getBodySnapshot(1)!.offsetX);
    const mountedOffset = Math.abs(simulation.getBodySnapshot(2)!.offsetX);

    expect(footOffset).toBeGreaterThan(mountedOffset * 2);
  });

  it("resolves coincident centers deterministically and keeps every value finite", () => {
    const first = runCoincidentScenario([body(4, 0, 0), body(9, 0, 0)]);
    const second = runCoincidentScenario([body(9, 0, 0), body(4, 0, 0)]);

    expect(first).toEqual(second);
    expect(Object.values(first[0]).every((value) => typeof value !== "number" || Number.isFinite(value))).toBe(true);
    expect(Math.hypot(first[0].offsetX, first[0].offsetZ)).toBeGreaterThan(0);
  });

  it("clamps collision displacement to each profile's visual envelope", () => {
    const simulation = new ProceduralSeparationSimulation({ solverIterations: 6 });
    simulation.stepOnce(Array.from({ length: 12 }, (_, index) => body(index + 1, 0, 0)));

    for (const snapshot of simulation.getSnapshots()) {
      expect(Math.hypot(snapshot.offsetX, snapshot.offsetZ)).toBeLessThanOrEqual(knight.maxVisualOffset + 1e-8);
    }
  });

  it("snaps a reconciled anchor jump instead of retaining stale collision velocity", () => {
    const simulation = new ProceduralSeparationSimulation();
    simulation.stepOnce([body(1, -0.2, 0), body(2, 0.2, 0)]);
    expect(Math.abs(simulation.getBodySnapshot(1)!.offsetX)).toBeGreaterThan(0);

    simulation.stepOnce([body(1, 10, 10), body(2, 12, 10)]);

    expect(simulation.getBodySnapshot(1)).toMatchObject({ offsetX: 0, offsetZ: 0, positionX: 10, positionZ: 10 });
  });

  it("removes collision state when an actor leaves the visible presentation set", () => {
    const simulation = new ProceduralSeparationSimulation();
    simulation.stepOnce([body(1, 0, 0), body(2, 0.2, 0)]);
    simulation.stepOnce([body(2, 0.2, 0)]);

    expect(simulation.getBodySnapshot(1)).toBeUndefined();
    expect(simulation.getStats().bodyCount).toBe(1);
  });

  it("bounds dense contact work at the configured pair limit", () => {
    const simulation = new ProceduralSeparationSimulation({ maxPairResolutions: 3, solverIterations: 1 });
    simulation.stepOnce(Array.from({ length: 10 }, (_, index) => body(index + 1, 0, 0)));

    expect(simulation.getStats().resolvedPairCount).toBe(3);
    expect(simulation.getStats().droppedPairCount).toBeGreaterThan(0);
  });

  it("returns displaced actors to their authoritative anchors over time", () => {
    const simulation = new ProceduralSeparationSimulation();
    simulation.stepOnce([body(1, -0.2, 0), body(2, 0.2, 0)]);
    const displaced = Math.abs(simulation.getBodySnapshot(1)!.offsetX);

    for (let step = 0; step < 120; step += 1) simulation.stepOnce([body(1, -2, 0), body(2, 2, 0)]);

    expect(Math.abs(simulation.getBodySnapshot(1)!.offsetX)).toBeLessThan(displaced * 0.05);
  });
});

function body(entityId: number, anchorX: number, anchorZ: number, profile = knight): ProceduralSeparationInput {
  return { anchorX, anchorZ, entityId, profile, yaw: 0 };
}

function runCoincidentScenario(inputs: ProceduralSeparationInput[]) {
  const simulation = new ProceduralSeparationSimulation();
  simulation.stepOnce(inputs);
  return simulation.getSnapshots();
}
