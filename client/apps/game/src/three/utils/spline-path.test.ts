import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import {
  buildMovementSpline,
  resolveSplinePosition,
  resolveSplineTangent,
  resolveJourneyProgressUpdate,
  resolveAnticipationScale,
  resolveSettlementOffset,
  resolvePathBankAngle,
  resolveTerrainSpeedMultiplier,
} from "./spline-path";
import { EasingType } from "./easing";

describe("buildMovementSpline", () => {
  it("2-point path degrades to a straight line", () => {
    const start = new Vector3(0, 0, 0);
    const end = new Vector3(10, 0, 0);
    const spline = buildMovementSpline([start, end]);

    // Sample several points along the spline — all should lie on the line between start and end
    const samples = [0, 0.25, 0.5, 0.75, 1.0];
    for (const t of samples) {
      const point = spline.getPointAt(t);
      // Y and Z should remain 0 (on the line)
      expect(point.y).toBeCloseTo(0, 2);
      expect(point.z).toBeCloseTo(0, 2);
      // X should interpolate linearly
      expect(point.x).toBeCloseTo(t * 10, 1);
    }
  });

  it("3+ point path passes near all waypoints (within 0.5 tolerance)", () => {
    const waypoints = [
      new Vector3(0, 0, 0),
      new Vector3(5, 0, 3),
      new Vector3(10, 0, -2),
      new Vector3(15, 0, 1),
    ];
    const spline = buildMovementSpline(waypoints);

    // The spline should pass near each waypoint
    const numSamples = 200;
    for (const wp of waypoints) {
      let minDist = Infinity;
      for (let i = 0; i <= numSamples; i++) {
        const t = i / numSamples;
        const point = spline.getPointAt(t);
        const dist = point.distanceTo(wp);
        if (dist < minDist) minDist = dist;
      }
      expect(minDist).toBeLessThan(0.5);
    }
  });
});

describe("resolveSplinePosition", () => {
  const start = new Vector3(0, 0, 0);
  const mid = new Vector3(5, 0, 3);
  const end = new Vector3(10, 0, 0);

  it("returns start point at t=0", () => {
    const spline = buildMovementSpline([start, mid, end]);
    const pos = resolveSplinePosition(spline, 0, EasingType.Linear);
    expect(pos.x).toBeCloseTo(start.x, 2);
    expect(pos.y).toBeCloseTo(start.y, 2);
    expect(pos.z).toBeCloseTo(start.z, 2);
  });

  it("returns end point at t=1", () => {
    const spline = buildMovementSpline([start, mid, end]);
    const pos = resolveSplinePosition(spline, 1, EasingType.Linear);
    expect(pos.x).toBeCloseTo(end.x, 2);
    expect(pos.y).toBeCloseTo(end.y, 2);
    expect(pos.z).toBeCloseTo(end.z, 2);
  });

  it("eased position (EaseJourney) still hits endpoints exactly at t=0 and t=1", () => {
    const spline = buildMovementSpline([start, mid, end]);

    const posStart = resolveSplinePosition(spline, 0, EasingType.EaseJourney);
    expect(posStart.x).toBeCloseTo(start.x, 2);
    expect(posStart.y).toBeCloseTo(start.y, 2);
    expect(posStart.z).toBeCloseTo(start.z, 2);

    const posEnd = resolveSplinePosition(spline, 1, EasingType.EaseJourney);
    expect(posEnd.x).toBeCloseTo(end.x, 2);
    expect(posEnd.y).toBeCloseTo(end.y, 2);
    expect(posEnd.z).toBeCloseTo(end.z, 2);
  });
});

describe("resolveSplineTangent", () => {
  const waypoints = [
    new Vector3(0, 0, 0),
    new Vector3(5, 0, 3),
    new Vector3(10, 0, -2),
    new Vector3(15, 0, 1),
  ];

  it("tangent is non-zero at all sample points", () => {
    const spline = buildMovementSpline(waypoints);
    const samples = [0, 0.25, 0.5, 0.75, 1.0];
    for (const t of samples) {
      const tangent = resolveSplineTangent(spline, t, EasingType.Linear);
      expect(tangent.length()).toBeGreaterThan(0);
    }
  });

  it("tangent direction roughly matches path direction for a straight line", () => {
    const start = new Vector3(0, 0, 0);
    const end = new Vector3(10, 0, 0);
    const spline = buildMovementSpline([start, end]);

    const tangent = resolveSplineTangent(spline, 0.5, EasingType.Linear);
    // For a straight line along X, tangent should point in +X direction
    expect(tangent.x).toBeGreaterThan(0);
    expect(Math.abs(tangent.y)).toBeLessThan(0.1);
    expect(Math.abs(tangent.z)).toBeLessThan(0.1);
  });
});

describe("resolveJourneyProgressUpdate", () => {
  it("advances progress based on totalLength, speed, and deltaTime", () => {
    const result = resolveJourneyProgressUpdate({
      currentProgress: 0.25,
      totalLength: 10,
      speed: 2,
      deltaTime: 0.5,
    });
    // progressStep = (2 * 0.5) / 10 = 0.1
    expect(result.nextProgress).toBeCloseTo(0.35);
    expect(result.isComplete).toBe(false);
  });

  it("completes when progress reaches 1", () => {
    const result = resolveJourneyProgressUpdate({
      currentProgress: 0.95,
      totalLength: 10,
      speed: 2,
      deltaTime: 0.5,
    });
    // progressStep = 0.1, so 0.95 + 0.1 = 1.05 >= 1
    expect(result.nextProgress).toBeGreaterThanOrEqual(1);
    expect(result.isComplete).toBe(true);
  });

  it("handles zero totalLength gracefully", () => {
    const result = resolveJourneyProgressUpdate({
      currentProgress: 0.1,
      totalLength: 0,
      speed: 2,
      deltaTime: 0.5,
    });
    expect(result.nextProgress).toBe(1);
    expect(result.isComplete).toBe(true);
  });

  it("handles negative totalLength gracefully", () => {
    const result = resolveJourneyProgressUpdate({
      currentProgress: 0.1,
      totalLength: -5,
      speed: 2,
      deltaTime: 0.5,
    });
    expect(result.nextProgress).toBe(1);
    expect(result.isComplete).toBe(true);
  });
});

describe("resolveAnticipationScale", () => {
  it("returns squashed scale at timer=0", () => {
    const scale = resolveAnticipationScale(0, 0.15);
    expect(scale.x).toBeCloseTo(1.1);
    expect(scale.y).toBeCloseTo(0.85);
    expect(scale.z).toBeCloseTo(1.1);
  });

  it("returns normal scale at timer=duration", () => {
    const scale = resolveAnticipationScale(0.15, 0.15);
    expect(scale.x).toBeCloseTo(1);
    expect(scale.y).toBeCloseTo(1);
    expect(scale.z).toBeCloseTo(1);
  });

  it("interpolates smoothly between squash and normal", () => {
    const scale = resolveAnticipationScale(0.075, 0.15);
    expect(scale.x).toBeGreaterThan(1);
    expect(scale.x).toBeLessThan(1.1);
    expect(scale.y).toBeGreaterThan(0.85);
    expect(scale.y).toBeLessThan(1);
  });
});

describe("resolveSettlementOffset", () => {
  it("returns 0 offset at timer=0", () => {
    const offset = resolveSettlementOffset(0, 0.25, 0.05);
    expect(offset).toBeCloseTo(0);
  });

  it("returns 0 offset at timer=duration (settled)", () => {
    const offset = resolveSettlementOffset(0.25, 0.25, 0.05);
    expect(offset).toBeCloseTo(0);
  });

  it("peaks somewhere in the middle", () => {
    // Sample several points and find max
    let maxOffset = 0;
    for (let t = 0; t <= 0.25; t += 0.01) {
      const offset = resolveSettlementOffset(t, 0.25, 0.05);
      maxOffset = Math.max(maxOffset, Math.abs(offset));
    }
    expect(maxOffset).toBeGreaterThan(0);
    expect(maxOffset).toBeLessThanOrEqual(0.05);
  });
});

describe("resolvePathBankAngle", () => {
  it("returns 0 bank for a straight path", () => {
    const points = [new Vector3(0, 0, 0), new Vector3(5, 0, 0), new Vector3(10, 0, 0)];
    const spline = buildMovementSpline(points);
    const bank = resolvePathBankAngle(spline, 0.5, 0.15);
    expect(Math.abs(bank)).toBeLessThan(0.01);
  });

  it("returns non-zero bank for a curved path", () => {
    const points = [
      new Vector3(0, 0, 0),
      new Vector3(2, 0, 0),
      new Vector3(3, 0, 2),
      new Vector3(3, 0, 5),
    ];
    const spline = buildMovementSpline(points);
    const bank = resolvePathBankAngle(spline, 0.5, 0.15);
    expect(Math.abs(bank)).toBeGreaterThan(0.001);
  });

  it("never exceeds maxBankRadians", () => {
    const points = [
      new Vector3(0, 0, 0),
      new Vector3(1, 0, 0),
      new Vector3(1, 0, 1),
      new Vector3(0, 0, 1),
    ];
    const spline = buildMovementSpline(points);
    for (let t = 0.05; t <= 0.95; t += 0.05) {
      const bank = resolvePathBankAngle(spline, t, 0.15);
      expect(Math.abs(bank)).toBeLessThanOrEqual(0.15 + 0.001);
    }
  });

  it("produces opposite bank for mirrored curves", () => {
    const leftCurve = [
      new Vector3(0, 0, 0),
      new Vector3(2, 0, 0),
      new Vector3(3, 0, 2),
    ];
    const rightCurve = [
      new Vector3(0, 0, 0),
      new Vector3(2, 0, 0),
      new Vector3(3, 0, -2),
    ];
    const leftSpline = buildMovementSpline(leftCurve);
    const rightSpline = buildMovementSpline(rightCurve);
    const leftBank = resolvePathBankAngle(leftSpline, 0.5, 0.15);
    const rightBank = resolvePathBankAngle(rightSpline, 0.5, 0.15);
    // They should have opposite signs
    expect(leftBank * rightBank).toBeLessThan(0);
  });
});

describe("resolveTerrainSpeedMultiplier", () => {
  it("returns 1.2x for grassland", () => {
    expect(resolveTerrainSpeedMultiplier("Grassland")).toBeCloseTo(1.2);
  });

  it("returns 0.75x for mountain biomes", () => {
    expect(resolveTerrainSpeedMultiplier("Bare")).toBeCloseTo(0.75);
    expect(resolveTerrainSpeedMultiplier("Snow")).toBeCloseTo(0.75);
    expect(resolveTerrainSpeedMultiplier("Tundra")).toBeCloseTo(0.75);
    expect(resolveTerrainSpeedMultiplier("Scorched")).toBeCloseTo(0.75);
  });

  it("returns 0.75x for desert biomes", () => {
    expect(resolveTerrainSpeedMultiplier("SubtropicalDesert")).toBeCloseTo(0.75);
    expect(resolveTerrainSpeedMultiplier("TemperateDesert")).toBeCloseTo(0.75);
  });

  it("returns 1.0x for ocean (boat)", () => {
    expect(resolveTerrainSpeedMultiplier("Ocean")).toBeCloseTo(1.0);
    expect(resolveTerrainSpeedMultiplier("DeepOcean")).toBeCloseTo(1.0);
  });

  it("returns 1.0x for generic biomes", () => {
    expect(resolveTerrainSpeedMultiplier("TemperateDeciduousForest")).toBeCloseTo(1.0);
    expect(resolveTerrainSpeedMultiplier("Beach")).toBeCloseTo(1.0);
  });
});
