import { describe, expect, it } from "vitest";
import {
  resolveMovementProgressUpdate,
  resolveRotationUpdate,
  shouldSwitchModelForPosition,
} from "./army-model-behavior-policy";

describe("resolveRotationUpdate", () => {
  it("rotates toward target over delta time", () => {
    const next = resolveRotationUpdate({
      currentRotation: 0,
      targetRotation: Math.PI / 2,
      rotationSpeed: 5,
      deltaTime: 0.1,
    });

    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThan(Math.PI / 2);
  });

  it("takes the shortest arc around wrap boundaries", () => {
    const next = resolveRotationUpdate({
      currentRotation: Math.PI - 0.1,
      targetRotation: -Math.PI + 0.1,
      rotationSpeed: 5,
      deltaTime: 0.1,
    });

    expect(next).toBeGreaterThan(Math.PI - 0.1);
  });
});

describe("resolveMovementProgressUpdate", () => {
  it("advances progress based on distance, speed, and delta time", () => {
    const step = resolveMovementProgressUpdate({
      progress: 0.25,
      distance: 5,
      movementSpeed: 1.25,
      deltaTime: 0.5,
    });

    expect(step.nextProgress).toBeCloseTo(0.375);
    expect(step.shouldCompletePath).toBe(false);
  });

  it("marks completion when progress reaches path end", () => {
    const step = resolveMovementProgressUpdate({
      progress: 0.95,
      distance: 1,
      movementSpeed: 1,
      deltaTime: 0.1,
    });

    expect(step.nextProgress).toBeGreaterThanOrEqual(1);
    expect(step.shouldCompletePath).toBe(true);
  });

  it("completes immediately for zero or invalid travel distance", () => {
    const step = resolveMovementProgressUpdate({
      progress: 0.1,
      distance: 0,
      movementSpeed: 1.25,
      deltaTime: 0.5,
    });

    expect(step.nextProgress).toBe(1);
    expect(step.shouldCompletePath).toBe(true);
  });
});

describe("shouldSwitchModelForPosition", () => {
  it("switches model only when resolved model differs from current", () => {
    expect(shouldSwitchModelForPosition({ currentModel: "boat", resolvedModel: "knight1" })).toBe(true);
    expect(shouldSwitchModelForPosition({ currentModel: "boat", resolvedModel: "boat" })).toBe(false);
  });
});
