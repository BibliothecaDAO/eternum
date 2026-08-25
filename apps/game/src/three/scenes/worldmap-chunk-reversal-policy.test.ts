import { describe, expect, it } from "vitest";
import { resolveChunkReversalRefreshDecision } from "./worldmap-chunk-reversal-policy";

describe("resolveChunkReversalRefreshDecision", () => {
  it("keeps movement vector null when there is no previous switch position", () => {
    const result = resolveChunkReversalRefreshDecision({
      previousSwitchPosition: null,
      nextSwitchPosition: { x: 10, z: 0 },
      previousMovementVector: null,
      minMovementDistance: 0.001,
    });

    expect(result.shouldForceRefresh).toBe(false);
    expect(result.nextMovementVector).toBeNull();
  });

  it("forces refresh when direction reverses", () => {
    const result = resolveChunkReversalRefreshDecision({
      previousSwitchPosition: { x: 10, z: 0 },
      nextSwitchPosition: { x: 0, z: 0 },
      previousMovementVector: { x: 10, z: 0 },
      minMovementDistance: 0.001,
    });

    expect(result.shouldForceRefresh).toBe(true);
    expect(result.nextMovementVector).toEqual({ x: -10, z: 0 });
  });

  it("does not force refresh for orthogonal movement", () => {
    const result = resolveChunkReversalRefreshDecision({
      previousSwitchPosition: { x: 10, z: 0 },
      nextSwitchPosition: { x: 10, z: 8 },
      previousMovementVector: { x: 10, z: 0 },
      minMovementDistance: 0.001,
    });

    expect(result.shouldForceRefresh).toBe(false);
    expect(result.nextMovementVector).toEqual({ x: 0, z: 8 });
  });

  it("ignores sub-threshold movement jitter", () => {
    const result = resolveChunkReversalRefreshDecision({
      previousSwitchPosition: { x: 10, z: 0 },
      nextSwitchPosition: { x: 10.0001, z: 0 },
      previousMovementVector: { x: 10, z: 0 },
      minMovementDistance: 0.01,
    });

    expect(result.shouldForceRefresh).toBe(false);
    expect(result.nextMovementVector).toEqual({ x: 10, z: 0 });
  });

  it("stays origin-independent across first and second movement decisions", () => {
    const firstMovement = resolveChunkReversalRefreshDecision({
      previousSwitchPosition: null,
      nextSwitchPosition: { x: 110, z: 50 },
      previousMovementVector: null,
      minMovementDistance: 0.001,
    });

    const secondMovement = resolveChunkReversalRefreshDecision({
      previousSwitchPosition: { x: 110, z: 50 },
      nextSwitchPosition: { x: 100, z: 50 },
      previousMovementVector: firstMovement.nextMovementVector,
      minMovementDistance: 0.001,
    });

    expect(firstMovement.nextMovementVector).toBeNull();
    expect(secondMovement.shouldForceRefresh).toBe(false);
    expect(secondMovement.nextMovementVector).toEqual({ x: -10, z: 0 });
  });
});
