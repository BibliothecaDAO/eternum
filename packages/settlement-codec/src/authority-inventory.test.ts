import { describe, expect, test } from "vitest";
import {
  AddressAliasDisposition,
  AddressSourceKind,
  ProductionMutationDisposition,
  getAuthorityInventory,
  getAddressAliasRecords,
  getAddressSourceRecords,
  getPrivilegedMutationPathRecords,
  computeAuthoritativeAddressInputsHash,
  computeAuthoritySchemaHash,
  computeDynamicAddressInputsHash,
  computePrivilegedMutationPathsHash,
  validateAuthorityInventory,
  validateAuthorityInventoryForRelease,
  type AuthorityInventory,
  type AuthorityOnchainObservation,
} from "./authority-inventory";
import { hashAuthorityDomain } from "./authority-commitments";

describe("A20 authority inventory", () => {
  test("publishes one semantic authority for the mainnet loot chest and rejects its deprecated zero alias", () => {
    const inventory = getAuthorityInventory();
    const canonical = inventory.addressSources.filter(
      (record) => record.chainId === "mainnet" && record.semanticKey === "lootChests" && record.isAuthoritative,
    );
    const deprecatedAlias = inventory.addressAliases.find(
      (record) =>
        record.chainId === "mainnet" &&
        record.semanticKey === "lootChests" &&
        record.sourceKey === "Collectibles: Realms: Loot Chest",
    );

    expect(canonical).toHaveLength(1);
    expect(BigInt(canonical[0].value)).toBeGreaterThan(0n);
    expect(deprecatedAlias).toMatchObject({
      disposition: AddressAliasDisposition.DeprecatedZeroRejected,
      expectedValue: "0x0",
    });
  });

  test("reconciles generated config and package-local cosmetics claim output without granting either authority", () => {
    const inventory = getAuthorityInventory();
    const generated = inventory.addressSources.filter(
      (record) => record.sourceKind === AddressSourceKind.GeneratedArtifact,
    );
    const cosmeticsClaimAlias = inventory.addressAliases.find(
      (record) => record.sourceKey === "cosmetics_claim" && record.semanticKey === "cosmeticsClaim",
    );

    expect(generated.length).toBeGreaterThan(0);
    expect(generated.every((record) => !record.isAuthoritative)).toBe(true);
    expect(cosmeticsClaimAlias).toMatchObject({
      disposition: AddressAliasDisposition.MigrationOnly,
    });
  });

  test("binds clean factory defaults to the selected chain authority", () => {
    const inventory = getAuthorityInventory();
    const mainnetFactory = inventory.addressSources.filter(
      (record) => record.chainId === "mainnet" && record.semanticKey === "factory",
    );

    expect(mainnetFactory.filter((record) => record.isAuthoritative)).toHaveLength(1);
    expect(mainnetFactory.find((record) => record.sourceKind === AddressSourceKind.DeployerDefault)?.value).toBe(
      mainnetFactory.find((record) => record.isAuthoritative)?.value,
    );
  });

  test("binds concrete VRF releases to the canonical provider and leaves runtime inputs unresolved", () => {
    const inventory = getAuthorityInventory();
    const vrfSources = inventory.addressSources.filter(
      ({ chainId, semanticKey }) => chainId === "mainnet" && semanticKey === "vrfProvider",
    );
    const authority = vrfSources.find(({ isAuthoritative }) => isAuthoritative);
    const dynamicKeys = inventory.dynamicAddressInputs
      .filter(
        ({ sourcePath, semanticKey }) =>
          sourcePath === "config/deployer/clean/cli/launch-request.ts" && semanticKey === "vrfProvider",
      )
      .map(({ sourceKey }) => sourceKey);

    expect(vrfSources.every(({ value }) => value === authority?.value)).toBe(true);
    expect(dynamicKeys).toEqual(
      expect.arrayContaining(["vrfProviderAddress", "VRF_PROVIDER_ADDRESS", "VITE_PUBLIC_VRF_PROVIDER_ADDRESS"]),
    );
  });

  test("discovers every source-config address use, including Blitz and Eternum chain overlays", () => {
    const inventory = getAuthorityInventory();
    const mainnetSourceUses = inventory.addressSources
      .filter(({ chainId, sourceKind }) => chainId === "mainnet" && sourceKind === AddressSourceKind.SourceConfig)
      .map(({ sourcePath, semanticKey }) => `${sourcePath}:${semanticKey}`);

    expect(mainnetSourceUses).toEqual(
      expect.arrayContaining([
        "config/source/blitz/addresses.ts:lootChests",
        "config/source/blitz/chains.ts:mmrToken",
        "config/source/blitz/chains.ts:strk",
        "config/source/eternum/chains.ts:lords",
        "config/source/eternum/chains.ts:villagePass",
      ]),
    );
  });

  test("commits workflow and runtime-provided addresses without inventing concrete values", () => {
    const inventory = getAuthorityInventory();
    const inputs = inventory.dynamicAddressInputs;

    expect(inputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          semanticKey: "factory",
          sourcePath: ".github/workflows/game-launch.yml",
          sourceKey: "GAME_LAUNCH_FACTORY_ADDRESS",
        }),
        expect.objectContaining({
          semanticKey: "account",
          sourcePath: ".github/workflows/game-launch.yml",
          sourceKey: "GAME_LAUNCH_ACCOUNT_ADDRESS",
        }),
        expect.objectContaining({
          semanticKey: "vrfProvider",
          sourcePath: ".github/workflows/game-launch.yml",
          sourceKey: "GAME_LAUNCH_VRF_PROVIDER_ADDRESS",
        }),
        expect.objectContaining({
          semanticKey: "world",
          sourcePath: "config/deployer/clean/runtime/aws/task-definition.ts",
          sourceKey: "request.worldAddress",
        }),
        expect.objectContaining({
          semanticKey: "world",
          sourcePath: "scripts/recover-aws-runtime-from-registry.mjs",
          sourceKey: "runtime.worldAddress",
        }),
      ]),
    );
    expect(inputs.every(({ value, isAuthoritative }) => value === null && isAuthoritative === false)).toBe(true);
    expect(computeDynamicAddressInputsHash(inventory)).toBe(inventory.dynamicAddressInputsHash);
  });

  test("covers every discovered privileged mutation operation with an explicit review state", () => {
    const inventory = getAuthorityInventory();

    expect(inventory.privilegedMutationPaths.length).toBeGreaterThan(0);
    expect(inventory.discoveredMutationPathHashes).toHaveLength(inventory.privilegedMutationPaths.length);
    expect(inventory.unresolvedMutationCandidates).toEqual([]);
    expect(inventory.unresolvedMutationPathHashes).toEqual([]);
    expect(inventory.releaseReady).toBe(false);
    expect(() => validateAuthorityInventory(inventory)).not.toThrow();
    expect(() => validateAuthorityInventoryForRelease(inventory)).toThrow(
      "authority inventory release authorization requires a cryptographically verified A23 artifact",
    );
    expect(() => validateAuthorityInventoryForRelease({ ...inventory, releaseReady: true })).toThrow(
      "authority inventory release readiness mismatch",
    );
    expect(inventory.privilegedMutationPaths.map(({ path }) => path)).toContain(
      "config/deployer/clean/config/native-steps.ts#factory-mutation",
    );
    expect(inventory.privilegedMutationPaths).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "packages/provider/src/index.ts#factory-mutation",
          productionDisposition: ProductionMutationDisposition.CanonicalStructuredOperation,
        }),
        expect.objectContaining({
          path: "packages/provider/src/index.ts#role-mutation",
          productionDisposition: ProductionMutationDisposition.CanonicalStructuredOperation,
        }),
        expect.objectContaining({
          path: "client/apps/game/src/ui/features/admin/pages/factory.tsx#factory-mutation",
          productionDisposition: ProductionMutationDisposition.MigrationOnlyConsumed,
        }),
        expect.objectContaining({
          path: "scripts/recover-aws-runtime-from-registry.mjs#deploy",
          productionDisposition: ProductionMutationDisposition.ReadOnly,
        }),
      ]),
    );
    expect(
      inventory.privilegedMutationPaths.filter(
        ({ productionDisposition }) => productionDisposition === ProductionMutationDisposition.HardDisabled,
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "contracts/game/ext/scripts/slot.sh#deploy" }),
        expect.objectContaining({ path: "contracts/marketplace/ext/scripts/slot.sh#deploy" }),
      ]),
    );
  });

  test("rejects a synthetic A23 authorization status, approval hash, and release-ready claim", () => {
    const inventory = getAuthorityInventory();
    const forgedAuthorization = {
      ...inventory,
      externalAuthorization: {
        ...inventory.externalAuthorization,
        status: "authorized-a23-authority-freeze",
        approvalRecordHash: "0x1",
      },
      releaseReady: true,
    } as unknown as AuthorityInventory;

    expect(() => validateAuthorityInventory(forgedAuthorization)).toThrow(
      "authority schema authorization must remain pending until a cryptographically verified A23 artifact is wired",
    );
    expect(() => validateAuthorityInventoryForRelease(forgedAuthorization)).toThrow(
      "authority schema authorization must remain pending until a cryptographically verified A23 artifact is wired",
    );
  });

  test("publishes reproducible release hashes and a contiguous candidate MMR authority schema", () => {
    const inventory = getAuthorityInventory();

    expect(getAddressSourceRecords()).toHaveLength(inventory.addressSources.length);
    expect(getAddressAliasRecords()).toHaveLength(inventory.addressAliases.length);
    expect(getPrivilegedMutationPathRecords()).toHaveLength(inventory.privilegedMutationPaths.length);
    expect(inventory.addressSourceRecords[0]).toHaveProperty("chain_id");
    expect(inventory.addressAliasRecords[0]).toHaveProperty("alias_path_hash");
    expect(inventory.privilegedMutationPathRecords[0]).toHaveProperty("operation_kind");
    expect(inventory.dynamicAddressInputRecords).toHaveLength(inventory.dynamicAddressInputs.length);
    expect(computeAuthoritativeAddressInputsHash(inventory)).toBe(inventory.authoritativeAddressInputsHash);
    expect(computePrivilegedMutationPathsHash(inventory)).toBe(inventory.privilegedMutationPathsHash);
    expect(computeAuthoritySchemaHash(inventory.authoritySchema)).toBe(inventory.authoritySchema.authoritySchemaHash);
    expect(BigInt(inventory.authoritySchema.authoritySchemaHash)).toBeGreaterThan(0n);
    expect(inventory.authoritySchema.roles.map(({ roleIndex }) => roleIndex)).toEqual(
      inventory.authoritySchema.roles.map((_, index) => index),
    );
    expect(inventory.authoritySchema.capabilities.map(({ capabilityIndex }) => capabilityIndex)).toEqual(
      inventory.authoritySchema.capabilities.map((_, index) => index),
    );
  });

  test("rejects a live onchain observation that differs from its canonical address", () => {
    const inventory = getAuthorityInventory();
    const liveIndex = inventory.addressSources.findIndex(
      ({ sourceKind }) => sourceKind === AddressSourceKind.OnchainObservation,
    );
    expect(liveIndex).toBeGreaterThanOrEqual(0);

    inventory.addressSources[liveIndex] = {
      ...inventory.addressSources[liveIndex],
      value: differentAddress(inventory.addressSources[liveIndex].value),
    };

    expectInvalid(inventory, "live onchain class/address mismatch");
  });

  test("rejects duplicate authority, unknown aliases, hidden overrides, stale output, and uncovered mutation paths", () => {
    const valid = getAuthorityInventory();
    const canonical = valid.addressSources.find((record) => record.isAuthoritative)!;

    expectInvalid(
      {
        ...valid,
        addressSources: [...valid.addressSources, { ...canonical, sourcePath: "duplicate-authority.json" }],
      },
      "exactly one authority",
    );
    expectInvalid(
      {
        ...valid,
        addressAliases: [
          ...valid.addressAliases,
          {
            chainId: "mainnet",
            semanticKey: "unknown",
            sourcePath: "unknown.json",
            sourceKey: "unknown",
            disposition: AddressAliasDisposition.Exact,
            expectedValue: "0x1",
            aliasPathHash: "0x1",
            aliasKeyHash: "0x1",
          },
        ],
      },
      "unknown alias",
    );
    expectInvalid(
      {
        ...valid,
        dynamicAddressInputs: valid.dynamicAddressInputs.map((record, index) =>
          index === 0 ? { ...record, value: "0x1" as never } : record,
        ),
      },
      "dynamic address input must remain non-authoritative and unresolved",
    );
    expectInvalid({ ...valid, generatedArtifactsCurrent: false }, "generated artifact");
    expectInvalid(
      { ...valid, discoveredMutationPathHashes: [...valid.discoveredMutationPathHashes, "0x123"] },
      "uncovered",
    );
  });

  test("rejects exact wire records that diverge from their annotated projections", () => {
    const valid = getAuthorityInventory();

    expectInvalid(
      {
        ...valid,
        addressSourceRecords: valid.addressSourceRecords.map((record, index) =>
          index === 0 ? { ...record, source_kind: record.source_kind + 1 } : record,
        ),
      },
      "address source record projection mismatch",
    );
    expectInvalid(
      {
        ...valid,
        dynamicAddressInputs: [
          ...valid.dynamicAddressInputs,
          {
            ...valid.dynamicAddressInputs[0],
            sourcePath: "future/runtime/new-address-input.ts",
            sourcePathHash: hashAuthorityDomain("future/runtime/new-address-input.ts"),
          },
        ],
      },
      "dynamic address input record projection mismatch",
    );
  });

  test("rejects a published intermediate authority commitment that diverges from the shared codec", () => {
    const valid = getAuthorityInventory();

    expectInvalid(
      {
        ...valid,
        authoritySchema: { ...valid.authoritySchema, roleDescriptorsHash: "0x1" },
      },
      "authority role descriptors hash mismatch",
    );
  });

  test("binds the provenance-complete authority state to a finalized mainnet observation", () => {
    const inventory = getAuthorityInventory();
    const observation = inventory.onchainObservations.find(({ semanticKey }) => semanticKey === "mmrToken");

    expect(observation).toMatchObject({
      chainId: "mainnet",
      blockNumber: 12_050_000,
      blockStatus: "ACCEPTED_ON_L1",
      contractAddress: inventory.authoritySchema.tokenAddress,
      classHash: inventory.authoritySchema.tokenClassHash,
    });
    expect(observation?.roleEventsCompleteFromDeployment).toBe(true);
    expect(inventory.authoritySchema.observedClassMatchesLocalStorageLayoutSource).toBe(true);
    expect(inventory.authoritySchema.status).toBe("provenance-complete-awaiting-a23-freeze");
    expect(inventory.authoritySchema.roles.find(({ name }) => name === "DEFAULT_ADMIN_ROLE")?.members).toHaveLength(2);
    expect(inventory.authoritySchema.roles.map(({ name }) => name)).toEqual(["DEFAULT_ADMIN_ROLE", "UPGRADER_ROLE"]);
  });

  test("binds the exact historical MMR build and finalized declaration without claiming A23 authorization", () => {
    const inventory = getAuthorityInventory();
    const observation = inventory.onchainObservations.find(({ semanticKey }) => semanticKey === "mmrToken");

    expect(inventory).toMatchObject({
      status: "a20-evidence-complete-awaiting-a23-freeze",
      evidenceComplete: true,
      releaseReady: false,
      externalAuthorization: {
        required: true,
        status: "awaiting-a23-authority-freeze",
        authoritySchemaHash: inventory.authoritySchema.authoritySchemaHash,
      },
    });
    expect(observation).toMatchObject({
      declaration: {
        blockNumber: 7_052_550,
        blockHash: "0x6285eac3822bb771697915415d52722872a6e9f72562d3333923dd849cb44b8",
        transactionHash: "0x1c4a82af17119d0136061f01e92050ffdd0cdc982011579f953b405c770124f",
        classHash: "0x1dc09743f158d6e650b1b14e9557806c898274a5423ec9857558cabb2b7c1d8",
        compiledClassHash: "0x742167c3d25ad97497fe17270c90a6cf23d0541f52c464f200b1523cf02b948",
        executionStatus: "SUCCEEDED",
        finalityStatus: "ACCEPTED_ON_L1",
      },
      deployment: {
        blockNumber: 7_052_557,
        blockHash: "0x163e9762e2301954dc5ed0fe9de207e7307ec559d6b02a549d42833c872aa91",
        transactionHash: "0x24d64ab4a5355ab00a0c8cf39e25a764cd59009fa2cb7b2d68bd4fd38b8b6d7",
        classHash: "0x1dc09743f158d6e650b1b14e9557806c898274a5423ec9857558cabb2b7c1d8",
        transactionVersion: "0x3",
        udc: {
          address: "0x41a78e741e5af2fec34b695679bc6891742439f7afb8484ecd7766661ad02bf",
          deployContractSelector: "0x1987cbd17808b9a23693d4de7e246a443cfe37e6e7fbaeabd7d7e6532b07c3d",
          salt: "0x71f9f9da9b5f8122adf140396ff17244b0d82371906208dcda5bc454a526258",
          unique: "0x1",
        },
        accountCalldata: [
          "0x1",
          "0x41a78e741e5af2fec34b695679bc6891742439f7afb8484ecd7766661ad02bf",
          "0x1987cbd17808b9a23693d4de7e246a443cfe37e6e7fbaeabd7d7e6532b07c3d",
          "0x6",
          "0x1dc09743f158d6e650b1b14e9557806c898274a5423ec9857558cabb2b7c1d8",
          "0x71f9f9da9b5f8122adf140396ff17244b0d82371906208dcda5bc454a526258",
          "0x1",
          "0x2",
          "0x6292eefbff50689b0e4d007e6ad17abee996e08e66e62762f0c4bc170738402",
          "0x7fd490b3ba298e4b94e3c32df832823b102e39ce98cd41076a70b2f82d9326e",
        ],
        contractDeployedEvent: {
          fromAddress: "0x41a78e741e5af2fec34b695679bc6891742439f7afb8484ecd7766661ad02bf",
          selector: "0x26b160f10156dea0639bec90696772c640b9706a47f5b8c52ea1abe5858b34d",
          keys: ["0x26b160f10156dea0639bec90696772c640b9706a47f5b8c52ea1abe5858b34d"],
          data: [
            "0xd5a3c8c5ebcacf3279aafd2de3eb0c4736afc11be6f41c84880080fa7a1aaf",
            "0x6292eefbff50689b0e4d007e6ad17abee996e08e66e62762f0c4bc170738402",
            "0x1",
            "0x1dc09743f158d6e650b1b14e9557806c898274a5423ec9857558cabb2b7c1d8",
            "0x2",
            "0x6292eefbff50689b0e4d007e6ad17abee996e08e66e62762f0c4bc170738402",
            "0x7fd490b3ba298e4b94e3c32df832823b102e39ce98cd41076a70b2f82d9326e",
            "0x71f9f9da9b5f8122adf140396ff17244b0d82371906208dcda5bc454a526258",
          ],
        },
        executionStatus: "SUCCEEDED",
        finalityStatus: "ACCEPTED_ON_L1",
      },
      deployedSourceRebuild: {
        sourceCommit: "00bdf7bec3a239a34fc16a4d47e70b91c30cddca",
        sourceGitBlob: "081fd7cbe4e6c4ef35b6e5e1c383b1332232dfbc",
        sourceSha256: "456e26c7347d673cd3954db03d5be8a7edc270cbd33ee0793379a2f73f28e286",
        manifestGitBlob: "5d0f1d10ea7f8e2bb76c53ccba1f701fcb30ec68",
        manifestSha256: "cfed48843010d45e5fcc1151cecb4803bb75623fb4cbfb49d79f0eaaaa938986",
        lockfileGitBlob: "f7ad430a7577d4d43da7905271d7893ff033ebb4",
        lockfileSha256: "32cb4d4e7fce00a6d5799b3bdc93663227c991068df8b3cb6a3639de39a22939",
        toolchain: {
          scarbVersion: "2.13.1",
          scarbBuildCommit: "a76aed717",
          cairoVersion: "2.13.1",
          sierraVersion: "1.7.0",
        },
        cleanBuilds: [
          {
            buildIndex: 0,
            sierraArtifactSha256: "ea2dc62d6788dc0200e23636df4d269c65c2933bf8a4a3e307ef7c971dc34c2a",
            casmArtifactSha256: "1fb939a346037e07fbd97e064ef6ad6f50265c0ef7558179267483a564cb0a67",
          },
          {
            buildIndex: 1,
            sierraArtifactSha256: "ea2dc62d6788dc0200e23636df4d269c65c2933bf8a4a3e307ef7c971dc34c2a",
            casmArtifactSha256: "1fb939a346037e07fbd97e064ef6ad6f50265c0ef7558179267483a564cb0a67",
          },
        ],
        sierraClassHash: "0x1dc09743f158d6e650b1b14e9557806c898274a5423ec9857558cabb2b7c1d8",
        compiledClassHash: "0x742167c3d25ad97497fe17270c90a6cf23d0541f52c464f200b1523cf02b948",
        rpcRepresentableCanonicalSha256: "8993be37fe3f3670907d61177e4398b66f4817af4f28115dcaea5a7d0d309bf4",
        rpcRepresentableClassExactMatch: true,
      },
    });
    expect(inventory.authoritySchema).toMatchObject({
      status: "provenance-complete-awaiting-a23-freeze",
      localSourceClassHash: observation?.classHash,
      observedClassMatchesLocalStorageLayoutSource: true,
    });
    expect(() => validateAuthorityInventoryForRelease(inventory)).toThrow(
      "authority inventory release authorization requires a cryptographically verified A23 artifact",
    );
  });

  test("rejects drift in historical build provenance and finalized transaction evidence", () => {
    const cases: Array<{
      label: string;
      expectedError: string;
      transform: (observation: AuthorityOnchainObservation) => AuthorityOnchainObservation;
    }> = [
      {
        label: "source commit",
        expectedError: "deployed MMR source commit mismatch",
        transform: (observation) => ({
          ...observation,
          deployedSourceRebuild: { ...observation.deployedSourceRebuild, sourceCommit: "0".repeat(40) },
        }),
      },
      {
        label: "RPC observation trust boundary",
        expectedError: "onchain observation trust boundary mismatch",
        transform: (observation) => ({
          ...observation,
          observationKind: "multi-provider-proof" as never,
        }),
      },
      {
        label: "RPC chain identity",
        expectedError: "onchain observation RPC chain mismatch",
        transform: (observation) => ({ ...observation, rpcChainId: "0x1" }),
      },
      {
        label: "lockfile SHA-256",
        expectedError: "deployed MMR lockfile SHA-256 mismatch",
        transform: (observation) => ({
          ...observation,
          deployedSourceRebuild: { ...observation.deployedSourceRebuild, lockfileSha256: "0".repeat(64) },
        }),
      },
      {
        label: "historical storage layout identity",
        expectedError: "deployed MMR storage layout identity mismatch",
        transform: (observation) => ({
          ...observation,
          deployedSourceRebuild: {
            ...observation.deployedSourceRebuild,
            storageLayoutIdentityHash: "0x1",
          },
        }),
      },
      {
        label: "second clean build",
        expectedError: "two clean deployed MMR builds mismatch",
        transform: (observation) => ({
          ...observation,
          deployedSourceRebuild: {
            ...observation.deployedSourceRebuild,
            cleanBuilds: observation.deployedSourceRebuild.cleanBuilds.map((build) =>
              build.buildIndex === 1 ? { ...build, casmArtifactSha256: "0".repeat(64) } : build,
            ),
          },
        }),
      },
      {
        label: "normalized RPC class",
        expectedError: "deployed MMR normalized RPC class does not match",
        transform: (observation) => ({
          ...observation,
          deployedSourceRebuild: {
            ...observation.deployedSourceRebuild,
            rpcRepresentableClassExactMatch: false,
          },
        }),
      },
      {
        label: "declaration finality",
        expectedError: "MMR declaration finality status mismatch",
        transform: (observation) => ({
          ...observation,
          declaration: { ...observation.declaration, finalityStatus: "RECEIVED" },
        }),
      },
      {
        label: "deployment finality",
        expectedError: "MMR deployment finality status mismatch",
        transform: (observation) => ({
          ...observation,
          deployment: { ...observation.deployment, finalityStatus: "RECEIVED" },
        }),
      },
      {
        label: "deployment UDC identity",
        expectedError: "MMR deployment UDC identity mismatch",
        transform: (observation) => ({
          ...observation,
          deployment: {
            ...observation.deployment,
            udc: { ...observation.deployment.udc, salt: "0x1" },
          },
        }),
      },
      {
        label: "deployment account calldata",
        expectedError: "MMR deployment account calldata mismatch",
        transform: (observation) => ({
          ...observation,
          deployment: {
            ...observation.deployment,
            accountCalldata: observation.deployment.accountCalldata.map((felt, index) => (index === 1 ? "0x1" : felt)),
          },
        }),
      },
      {
        label: "ContractDeployed event",
        expectedError: "MMR ContractDeployed event mismatch",
        transform: (observation) => ({
          ...observation,
          deployment: {
            ...observation.deployment,
            contractDeployedEvent: {
              ...observation.deployment.contractDeployedEvent,
              fromAddress: "0x1",
            },
          },
        }),
      },
    ];

    for (const { label, expectedError, transform } of cases) {
      expect(
        () => validateAuthorityInventory(transformMmrObservation(getAuthorityInventory(), transform)),
        label,
      ).toThrow(expectedError);
    }
  }, 15_000);
});

function expectInvalid(inventory: AuthorityInventory, message: string): void {
  expect(() => validateAuthorityInventory(inventory)).toThrow(message);
}

function differentAddress(value: string): string {
  return BigInt(value) === 1n ? "0x2" : "0x1";
}

function transformMmrObservation(
  inventory: AuthorityInventory,
  transform: (observation: AuthorityOnchainObservation) => AuthorityOnchainObservation,
): AuthorityInventory {
  return {
    ...inventory,
    onchainObservations: inventory.onchainObservations.map((observation) =>
      observation.semanticKey === "mmrToken" ? transform(observation) : observation,
    ),
  };
}
