import { describe, expect, test } from "vitest";
import {
  A18_APPROVED_ADDRESS_INPUTS,
  A18_DEPLOYMENT_PLAN,
  A18_RELEASE_IDENTITY,
  buildA18DeploymentIdentityVector,
  compileDeploymentAddressRecipe,
  type DeploymentAddressPlan,
} from "@bibliothecadao/settlement-codec";
import {
  deriveDeploymentShellPlan,
  deriveResolvedDeploymentIdentity,
  type DeploymentRulesetResolver,
  type PinnedDeploymentReleaseIdentity,
} from "../settlement/deployment-identity";

const PLAN = A18_DEPLOYMENT_PLAN;
const APPROVED = A18_APPROVED_ADDRESS_INPUTS;
const APPROVED_RULESETS = rulesetResolver(A18_RELEASE_IDENTITY);

describe("A18 deployer parity", () => {
  test("keeps public deployment fixtures immutable", () => {
    const vector = buildA18DeploymentIdentityVector();

    expect(() => {
      (A18_APPROVED_ADDRESS_INPUTS.l1.componentKinds as bigint[])[0] = 999n;
    }).toThrow(TypeError);
    expect(() => {
      (vector.plan.l2.componentClasses as { componentKind: bigint; classHash: bigint }[])[0].classHash = 999n;
    }).toThrow(TypeError);

    expect(A18_APPROVED_ADDRESS_INPUTS.l1.componentKinds[0]).toBe(1n);
    expect(buildA18DeploymentIdentityVector().plan.l2.componentClasses[0].classHash).toBe(
      vector.plan.l2.componentClasses[0].classHash,
    );
  });

  test("independently reproduces the codec recipe and every address", () => {
    const codec = compileDeploymentAddressRecipe(PLAN, APPROVED);
    const deployer = deriveDeploymentShellPlan(PLAN, APPROVED);

    expect(deployer.recipe).toEqual(codec.recipe);
    expect(deployer.recipeHash).toBe(codec.recipeHash);
    expect(deployer.l1Components).toEqual(codec.l1Components);
    expect(deployer.l2Components).toEqual(codec.l2Components);
  });

  test("rejects implicit deployment primitive defaults", () => {
    const missingPrimitive = {
      ...PLAN,
      l1: { ...PLAN.l1, deploymentPrimitiveHash: undefined },
    } as unknown as DeploymentAddressPlan;

    expect(() => deriveDeploymentShellPlan(missingPrimitive, APPROVED)).toThrow("deployment primitive");
  });

  test("derives and validates the complete genesis manifest and seal chain", () => {
    const vector = buildA18DeploymentIdentityVector();
    const { genesis_hash: _, ...manifestWithoutGenesis } = vector.manifest;
    const resolved = deriveResolvedDeploymentIdentity(
      PLAN,
      APPROVED_RULESETS,
      vector.genesisConfig,
      vector.genesisArtifact,
      vector.genesisArtifact.stateRoot,
      manifestWithoutGenesis,
    );

    expect(resolved.genesisHash).toBe(vector.genesisHash);
    expect(resolved.manifest).toEqual(vector.manifest);
    expect(resolved.manifestHash).toBe(vector.manifestHash);
    expect(resolved.seal).toEqual(vector.seal);
  });

  test("rejects caller-supplied resolved addresses and constructor-cycle fields", () => {
    const vector = buildA18DeploymentIdentityVector();
    const { genesis_hash: _, ...manifestWithoutGenesis } = vector.manifest;
    const wrongManifest = { ...manifestWithoutGenesis, root_inbox: manifestWithoutGenesis.root_inbox + 1n };
    const cyclicPlan = { ...PLAN, manifestHash: vector.manifestHash } as unknown as DeploymentAddressPlan;

    expect(() =>
      deriveResolvedDeploymentIdentity(
        PLAN,
        APPROVED_RULESETS,
        vector.genesisConfig,
        vector.genesisArtifact,
        vector.genesisArtifact.stateRoot,
        wrongManifest,
      ),
    ).toThrow("deterministic deployment identity");
    expect(() => deriveDeploymentShellPlan(cyclicPlan, APPROVED)).toThrow("noncanonical fields");
  });

  test("rejects a release identity that does not match the pinned ruleset", () => {
    const vector = buildA18DeploymentIdentityVector();
    const { genesis_hash: _, ...manifestWithoutGenesis } = vector.manifest;
    const wrongRelease = { ...A18_RELEASE_IDENTITY, releaseBundleHash: A18_RELEASE_IDENTITY.releaseBundleHash + 1n };

    expect(() =>
      deriveResolvedDeploymentIdentity(
        PLAN,
        rulesetResolver(wrongRelease),
        vector.genesisConfig,
        vector.genesisArtifact,
        vector.genesisArtifact.stateRoot,
        manifestWithoutGenesis,
      ),
    ).toThrow("genesis release");
  });

  test("rejects Katana root, inventory, schema, and config sidecar rewrites", () => {
    const vector = buildA18DeploymentIdentityVector();
    const { genesis_hash: _, ...manifestWithoutGenesis } = vector.manifest;
    const derive = (
      artifact: typeof vector.genesisArtifact,
      manifest: typeof manifestWithoutGenesis = manifestWithoutGenesis,
    ) =>
      deriveResolvedDeploymentIdentity(
        PLAN,
        APPROVED_RULESETS,
        vector.genesisConfig,
        artifact,
        vector.genesisArtifact.stateRoot,
        manifest,
      );

    expect(() => derive({ ...vector.genesisArtifact, stateRoot: vector.genesisArtifact.stateRoot + 1n })).toThrow(
      "Katana genesis",
    );
    expect(() =>
      derive({ ...vector.genesisArtifact, storageWritesHash: vector.genesisArtifact.storageWritesHash + 1n }),
    ).toThrow("Katana genesis storage");
    expect(() =>
      derive(vector.genesisArtifact, {
        ...manifestWithoutGenesis,
        schema_bundle_hash: manifestWithoutGenesis.schema_bundle_hash + 1n,
      }),
    ).toThrow("manifest schema bundle");
    expect(() =>
      derive(vector.genesisArtifact, {
        ...manifestWithoutGenesis,
        config_snapshot_hash: manifestWithoutGenesis.config_snapshot_hash + 1n,
      }),
    ).toThrow("manifest config snapshot");
  });
});

function rulesetResolver(releaseIdentity: PinnedDeploymentReleaseIdentity): DeploymentRulesetResolver {
  return {
    resolveDeploymentProfile(rulesetId) {
      if (rulesetId !== A18_RELEASE_IDENTITY.rulesetId) return undefined;
      return { addressInputs: APPROVED, releaseIdentity };
    },
  };
}
