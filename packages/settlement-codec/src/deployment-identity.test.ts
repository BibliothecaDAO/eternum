import { describe, expect, test } from "vitest";
import {
  assertCanonicalShellConstructor,
  buildShellConstructor,
  compileDeploymentAddressRecipe,
  hashDeploymentManifest,
  type DeploymentAddressPlan,
} from "./deployment-identity";
import {
  A18_DEPLOYMENT_PLAN,
  A18_APPROVED_ADDRESS_INPUTS,
  A18_L1_COMPONENT_FIELDS,
  A18_L2_COMPONENT_FIELDS,
  buildA18GenesisInputs,
  buildA18DeploymentIdentityVector,
} from "./deployment-identity-vector";

const PLAN = A18_DEPLOYMENT_PLAN;
const APPROVED = A18_APPROVED_ADDRESS_INPUTS;

describe("A18 deterministic deployment identity", () => {
  test("derives one stable acyclic recipe and every shell address", () => {
    const first = compileDeploymentAddressRecipe(PLAN, APPROVED);
    const second = compileDeploymentAddressRecipe(PLAN, APPROVED);

    expect(first).toEqual(second);
    expect(first.l1Components).toHaveLength(A18_L1_COMPONENT_FIELDS.length);
    expect(first.l2Components).toHaveLength(A18_L2_COMPONENT_FIELDS.length);
    expect(new Set([...first.l1Components, ...first.l2Components].map((component) => component.address)).size).toBe(
      A18_L1_COMPONENT_FIELDS.length + A18_L2_COMPONENT_FIELDS.length,
    );
  });

  test("rejects missing extra duplicate and permuted class bindings", () => {
    expect(() =>
      compileDeploymentAddressRecipe(
        { ...PLAN, l1: { ...PLAN.l1, componentClasses: PLAN.l1.componentClasses.slice(0, 1) } },
        APPROVED,
      ),
    ).toThrow("component class order");
    expect(() =>
      compileDeploymentAddressRecipe(
        {
          ...PLAN,
          l1: {
            ...PLAN.l1,
            componentClasses: [...PLAN.l1.componentClasses, { componentKind: 30n, classHash: 12030n }],
          },
        },
        APPROVED,
      ),
    ).toThrow("component class order");
    expect(() =>
      compileDeploymentAddressRecipe(
        {
          ...PLAN,
          l1: {
            ...PLAN.l1,
            componentClasses: [PLAN.l1.componentClasses[1], PLAN.l1.componentClasses[0]],
          },
        },
        APPROVED,
      ),
    ).toThrow("component class order");
    expect(() =>
      compileDeploymentAddressRecipe({ ...PLAN, l1: { ...PLAN.l1, componentKinds: [1n, 1n] } }, APPROVED),
    ).toThrow("duplicate component kind");
    expect(() =>
      compileDeploymentAddressRecipe(
        {
          ...PLAN,
          l1: {
            ...PLAN.l1,
            componentKinds: PLAN.l1.componentKinds.slice(0, -1),
            componentClasses: PLAN.l1.componentClasses.slice(0, -1),
          },
        },
        APPROVED,
      ),
    ).toThrow("approved ruleset inputs");
  });

  test("pins deployer zero mode and primitive semantics without a fixed-point input", () => {
    expect(() =>
      compileDeploymentAddressRecipe({ ...PLAN, l1: { ...PLAN.l1, deployer: PLAN.l1.deployer + 1n } }, APPROVED),
    ).toThrow("approved ruleset inputs");
    expect(() =>
      compileDeploymentAddressRecipe({ ...PLAN, l1: { ...PLAN.l1, deployFromZero: true } }, APPROVED),
    ).toThrow("approved ruleset inputs");
    expect(() =>
      compileDeploymentAddressRecipe(
        { ...PLAN, l1: { ...PLAN.l1, deploymentPrimitiveHash: PLAN.l1.deploymentPrimitiveHash + 1n } },
        APPROVED,
      ),
    ).toThrow("approved ruleset inputs");
  });

  test("rejects an implicit or zero deployment primitive", () => {
    const missingPrimitive = {
      ...PLAN,
      l1: { ...PLAN.l1, deploymentPrimitiveHash: undefined },
    } as unknown as DeploymentAddressPlan;
    const zeroPrimitive = { ...PLAN, l2: { ...PLAN.l2, deploymentPrimitiveHash: 0n } };

    expect(() => compileDeploymentAddressRecipe(missingPrimitive, APPROVED)).toThrow("deployment primitive");
    expect(() => compileDeploymentAddressRecipe(zeroPrimitive, APPROVED)).toThrow("deployment primitive");
  });

  test("rejects zero deployment identity inputs before address derivation", () => {
    expect(() => compileDeploymentAddressRecipe({ ...PLAN, deploymentId: 0n }, APPROVED)).toThrow("deployment id");
    expect(() => compileDeploymentAddressRecipe({ ...PLAN, predeployedCoordinator: 0n }, APPROVED)).toThrow(
      "predeployed coordinator",
    );
    expect(() => compileDeploymentAddressRecipe({ ...PLAN, l1: { ...PLAN.l1, deployer: 0n } }, APPROVED)).toThrow(
      "deployer",
    );
  });

  test("rejects peer and downstream hash constructor variants", () => {
    const compiled = compileDeploymentAddressRecipe(PLAN, APPROVED);
    const constructor = buildShellConstructor(PLAN.predeployedCoordinator, compiled.recipe, 1n);

    expect(() =>
      assertCanonicalShellConstructor(PLAN.predeployedCoordinator, compiled.recipe, 1n, [...constructor, 77n]),
    ).toThrow("shell constructor");
    expect(() =>
      assertCanonicalShellConstructor(PLAN.predeployedCoordinator, compiled.recipe, 1n, [
        ...constructor,
        compiled.recipeHash,
      ]),
    ).toThrow("shell constructor");
  });

  test("derives genesis before the full manifest and rejects downstream self-inputs", () => {
    const vector = buildA18DeploymentIdentityVector();

    expect(vector.genesisHash).not.toBe(vector.recipeHash);
    expect(vector.manifestHash).not.toBe(vector.genesisHash);
    expect(() => hashDeploymentManifest({ ...vector.manifest, manifest_hash: vector.manifestHash } as never)).toThrow(
      "noncanonical fields",
    );
  });

  test("binds the reproduced complete Katana genesis rather than only the scalar config", () => {
    const vector = buildA18DeploymentIdentityVector();
    const changedRoot = buildA18GenesisInputs(vector.genesisArtifact.stateRoot + 1n);

    expect(vector.genesisArtifact.stateRoot).not.toBe(0n);
    expect(vector.genesisArtifact.configHash).not.toBe(vector.genesisHash);
    expect(vector.genesisArtifact.contractAllocationCount).toBe(BigInt(A18_L2_COMPONENT_FIELDS.length));
    expect(vector.genesisArtifact.storageWriteCount).toBe(97n);
    expect(changedRoot.genesisHash).not.toBe(vector.genesisHash);
  });
});
