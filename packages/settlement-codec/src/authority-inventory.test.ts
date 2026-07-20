import { describe, expect, test } from "vitest";
import {
  AddressAliasDisposition,
  AddressSourceKind,
  getAuthorityInventory,
  getAddressAliasRecords,
  getAddressSourceRecords,
  getPrivilegedMutationPathRecords,
  computeAuthoritativeAddressInputsHash,
  computeAuthoritySchemaHash,
  computePrivilegedMutationPathsHash,
  validateAuthorityInventory,
  validateAuthorityInventoryForRelease,
  type AuthorityInventory,
} from "./authority-inventory";

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

  test("binds every public mainnet VRF release and CLI input to the canonical provider", () => {
    const inventory = getAuthorityInventory();
    const vrfSources = inventory.addressSources.filter(
      ({ chainId, semanticKey }) => chainId === "mainnet" && semanticKey === "vrfProvider",
    );
    const authority = vrfSources.find(({ isAuthoritative }) => isAuthoritative);

    expect(vrfSources.filter(({ sourceKind }) => sourceKind === AddressSourceKind.EnvironmentOrCli)).toHaveLength(3);
    expect(vrfSources.every(({ value }) => value === authority?.value)).toBe(true);
  });

  test("covers every discovered privileged mutation operation with an explicit review state", () => {
    const inventory = getAuthorityInventory();

    expect(inventory.privilegedMutationPaths.length).toBeGreaterThan(0);
    expect(inventory.discoveredMutationPathHashes).toHaveLength(
      inventory.privilegedMutationPaths.length + inventory.unresolvedMutationCandidates.length,
    );
    expect(inventory.unresolvedMutationPathHashes.length).toBeGreaterThan(0);
    expect(inventory.releaseReady).toBe(false);
    expect(() => validateAuthorityInventory(inventory)).not.toThrow();
    expect(() => validateAuthorityInventoryForRelease(inventory)).toThrow("unresolved privileged mutation paths");
    expect(() => validateAuthorityInventoryForRelease({ ...inventory, unresolvedMutationPathHashes: [] })).toThrow(
      "unresolved mutation path hash projection mismatch",
    );
    expect(() => validateAuthorityInventoryForRelease({ ...inventory, releaseReady: true })).toThrow(
      "authority inventory release readiness mismatch",
    );
    expect(
      [...inventory.privilegedMutationPaths, ...inventory.unresolvedMutationCandidates].map(({ path }) => path),
    ).toContain("config/deployer/clean/config/native-steps.ts#factory-mutation");
  });

  test("publishes reproducible release hashes and a contiguous candidate MMR authority schema", () => {
    const inventory = getAuthorityInventory();

    expect(getAddressSourceRecords()).toHaveLength(inventory.addressSources.length);
    expect(getAddressAliasRecords()).toHaveLength(inventory.addressAliases.length);
    expect(getPrivilegedMutationPathRecords()).toHaveLength(inventory.privilegedMutationPaths.length);
    expect(inventory.addressSourceRecords[0]).toHaveProperty("chain_id");
    expect(inventory.addressAliasRecords[0]).toHaveProperty("alias_path_hash");
    expect(inventory.privilegedMutationPathRecords[0]).toHaveProperty("operation_kind");
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
        addressSources: valid.addressSources.map((record) =>
          record.sourceKind === AddressSourceKind.EnvironmentOrCli
            ? { ...record, value: differentAddress(record.value) }
            : record,
        ),
      },
      "environment/CLI override",
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

  test("binds the candidate authority state to a finalized mainnet observation", () => {
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
    expect(inventory.authoritySchema.observedClassMatchesLocalStorageLayoutSource).toBe(false);
    expect(inventory.authoritySchema.status).toBe("blocked-observed-class-source-mismatch");
    expect(inventory.authoritySchema.roles.find(({ name }) => name === "DEFAULT_ADMIN_ROLE")?.members).toHaveLength(2);
    expect(inventory.authoritySchema.roles.map(({ name }) => name)).toEqual(["DEFAULT_ADMIN_ROLE", "UPGRADER_ROLE"]);
  });
});

function expectInvalid(inventory: AuthorityInventory, message: string): void {
  expect(() => validateAuthorityInventory(inventory)).toThrow(message);
}

function differentAddress(value: string): string {
  return BigInt(value) === 1n ? "0x2" : "0x1";
}
