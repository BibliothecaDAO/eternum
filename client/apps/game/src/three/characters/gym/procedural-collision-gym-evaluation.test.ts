import { describe, expect, it } from "vitest";

import { createDefaultProceduralCollisionGymConfig } from "./procedural-collision-gym-config";
import { evaluateProceduralCollisionGym } from "./procedural-collision-gym-evaluation";

const createInput = () => ({
  actorCount: 2,
  contactCount: 1,
  droppedPairCount: 0,
  elapsedSeconds: 3,
  impactCount: 0,
  maximumOffset: 0.12,
  ragdollCount: 0,
});

describe("evaluateProceduralCollisionGym", () => {
  it("passes a bounded head-on contact", () => {
    const config = { ...createDefaultProceduralCollisionGymConfig(), enabled: true };
    expect(evaluateProceduralCollisionGym(config, createInput())).toEqual({ reasons: [], status: "pass" });
  });

  it("requires an arrow defeat to produce an impact and ragdoll", () => {
    const config = {
      ...createDefaultProceduralCollisionGymConfig(),
      enabled: true,
      scenario: "arrow-defeat" as const,
    };
    expect(
      evaluateProceduralCollisionGym(config, {
        ...createInput(),
        elapsedSeconds: 5,
        impactCount: 1,
        ragdollCount: 1,
      }),
    ).toEqual({ reasons: [], status: "pass" });
  });

  it("fails loudly when the solver exceeds its offset or pair budget", () => {
    const config = { ...createDefaultProceduralCollisionGymConfig(), enabled: true };
    const result = evaluateProceduralCollisionGym(config, {
      ...createInput(),
      droppedPairCount: 2,
      maximumOffset: 0.3,
    });
    expect(result.status).toBe("fail");
    expect(result.reasons).toHaveLength(2);
  });
});
