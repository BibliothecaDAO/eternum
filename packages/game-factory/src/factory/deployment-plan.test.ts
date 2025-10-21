import { describe, expect, it } from "vitest";
import { buildDeploymentPlan } from "./deployment-plan";
import { createClassRegistry } from "../config";
import { MissingClassHashError, PlanValidationError } from "../errors";
import type { DeploymentPlan, GameDeploymentPreset } from "../types";

describe("buildDeploymentPlan", () => {
  it("builds a deployment plan from a preset and registry metadata", () => {
    const registry = createClassRegistry();
    const classMetadata = { id: "module.core", classHash: "0xabc" };
    registry.set("sepolia", classMetadata);

    const preset: GameDeploymentPreset = {
      id: "custom",
      metadata: { fromPreset: true },
      modules: [
        {
          id: "core-module",
          classId: "module.core",
          constructor: undefined,
        },
      ],
    };

    const plan = buildDeploymentPlan({
      network: "sepolia",
      registry,
      preset,
      metadata: { extra: "yes" },
    });

    expect(plan).toMatchObject({
      id: "plan:custom",
      network: "sepolia",
      presetId: "custom",
      metadata: { fromPreset: true, extra: "yes" },
    });
    expect(plan.steps).toEqual([
      {
        id: "core-module",
        type: "deploy",
        classId: "module.core",
        contractId: "core-module",
        dependsOn: undefined,
        labels: undefined,
        constructorCalldata: undefined,
        metadata: undefined,
      },
    ]);
  });

  it("throws when required class metadata is missing in the registry", () => {
    const registry = createClassRegistry();
    const preset: GameDeploymentPreset = {
      id: "custom",
      modules: [
        {
          id: "core-module",
          classId: "module.core",
          constructor: undefined,
        },
      ],
    };

    expect(() =>
      buildDeploymentPlan({
        network: "sepolia",
        registry,
        preset,
      }),
    ).toThrowError(MissingClassHashError);
  });

  it("overrides plan network and merges metadata when plan is provided directly", () => {
    const registry = createClassRegistry();
    const explicitPlan: DeploymentPlan = {
      id: "external-plan",
      network: "slot",
      steps: [
        {
          id: "core-module",
          type: "deploy",
        },
      ],
      metadata: { fromPlan: true },
    };

    const plan = buildDeploymentPlan({
      network: "sepolia",
      registry,
      plan: explicitPlan,
      metadata: { extra: "value" },
    });

    expect(plan.network).toBe("sepolia");
    expect(plan.metadata).toEqual({ fromPlan: true, extra: "value" });
  });

  it("rejects deployment plans with duplicate step identifiers", () => {
    const registry = createClassRegistry();
    const invalidPlan: DeploymentPlan = {
      id: "invalid-plan",
      network: "local",
      steps: [
        {
          id: "duplicate",
          type: "deploy",
        },
        {
          id: "duplicate",
          type: "deploy",
        },
      ],
    };

    expect(() =>
      buildDeploymentPlan({
        network: "local",
        registry,
        plan: invalidPlan,
      }),
    ).toThrowError(PlanValidationError);
  });
});
