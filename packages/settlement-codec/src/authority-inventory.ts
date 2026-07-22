import authorityInventory from "../schema/authority-inventory-v1.json";
import { hash } from "starknet";
import type { AddressAliasRecord, AddressSourceRecord, PrivilegedMutationPathRecord } from "./generated-types";
import {
  authorityCountedHash,
  authorityPoseidon,
  computeAddressInputsCommitment,
  computeAuthoritySchemaCommitment,
  computeAuthoritySchemaCommitments,
  computeDynamicAddressInputsCommitment,
  computeHistoricalStorageLayoutIdentityHash,
  computeMutationPathsCommitment,
  hashAuthorityDomain,
  type SerializedAddressAliasRecord,
  type SerializedAddressSourceRecord,
  type SerializedDynamicAddressInputRecord,
  type SerializedPrivilegedMutationPathRecord,
} from "./authority-commitments";

export enum AddressSourceKind {
  CanonicalJson = 1,
  SourceConfig = 2,
  GeneratedArtifact = 3,
  DeployerDefault = 4,
  EnvironmentOrCli = 5,
  OnchainObservation = 6,
}

export enum AddressAliasDisposition {
  Exact = 1,
  DeprecatedZeroRejected = 2,
  DisabledWriter = 3,
  MigrationOnly = 4,
}

export enum ProductionMutationDisposition {
  CanonicalStructuredOperation = 1,
  HardDisabled = 2,
  ReadOnly = 3,
  MigrationOnlyConsumed = 4,
}

export interface AuthorityAddressSourceRecord {
  readonly chainId: string;
  readonly chainIdFelt: string;
  readonly semanticKey: string;
  readonly semanticKeyHash: string;
  readonly sourceKind: AddressSourceKind;
  readonly sourcePath: string;
  readonly sourcePathHash: string;
  readonly sourceKey: string;
  readonly sourceKeyHash: string;
  readonly value: string;
  readonly isAuthoritative: boolean;
  readonly allowedProfileBitmap: string;
}

export interface AuthorityAddressAliasRecord {
  readonly chainId: string;
  readonly chainIdFelt: string;
  readonly semanticKey: string;
  readonly semanticKeyHash: string;
  readonly sourcePath: string;
  readonly aliasPathHash: string;
  readonly sourceKey: string;
  readonly aliasKeyHash: string;
  readonly disposition: AddressAliasDisposition;
  readonly expectedValue: string;
}

export interface AuthorityDynamicAddressInputRecord {
  readonly semanticKey: "account" | "factory" | "vrfProvider" | "world";
  readonly semanticKeyHash: string;
  readonly sourcePath: string;
  readonly sourcePathHash: string;
  readonly sourceKey: string;
  readonly sourceKeyHash: string;
  readonly inputKind: "environment" | "cli" | "runtime-field";
  readonly inputKindCode: number;
  readonly value: null;
  readonly isAuthoritative: false;
  readonly allowedProfileBitmap: string;
}

export interface AuthorityMutationPathRecord {
  readonly path: string;
  readonly pathHash: string;
  readonly operationKind: number;
  readonly targetSemanticKey: string;
  readonly productionDisposition: ProductionMutationDisposition;
  readonly reviewStatus: "reviewed";
  readonly evidencePath: string;
  readonly replacementPath: string;
  readonly replacementPathHash: string;
  readonly evidenceHash: string;
}

export interface AuthorityMutationCandidate {
  readonly path: string;
  readonly sourcePath: string;
  readonly operation: string;
  readonly pathHash: string;
  readonly operationKind: number;
  readonly targetSemanticKey: string;
}

export interface AuthorityRoleDescriptor {
  readonly name: string;
  readonly roleIndex: number;
  readonly roleId: string;
  readonly adminRoleId: string;
  readonly members: Array<{ readonly memberIndex: number; readonly member: string }>;
  readonly membersHash: string;
}

export interface AuthorityCapabilityDescriptor {
  readonly semanticKey: string;
  readonly capabilityIndex: number;
  readonly capabilityId: string;
  readonly capabilityKind: number;
  readonly selectorName: string;
  readonly selector: string;
  readonly controllerKind: number;
  readonly expectedRouteDescriptorHash: string;
  readonly routeDescriptor: string;
  readonly controller: string;
  readonly routeHash: string;
  readonly enabled: boolean;
}

export interface MmrAuthoritySchema {
  readonly status: string;
  readonly tokenAddress: string;
  readonly tokenClassHash: string;
  readonly localSourceClassHash: string;
  readonly observedClassMatchesLocalStorageLayoutSource: boolean;
  readonly tokenStorageLayoutHash: string;
  readonly roles: AuthorityRoleDescriptor[];
  readonly capabilities: AuthorityCapabilityDescriptor[];
  readonly roleDescriptorsHash: string;
  readonly capabilityDescriptorsHash: string;
  readonly authoritySchemaHash: string;
}

export interface AuthorityInventory {
  readonly schemaVersion: number;
  readonly status: string;
  readonly evidenceComplete: boolean;
  readonly generatedArtifactsCurrent: boolean;
  readonly addressSources: AuthorityAddressSourceRecord[];
  readonly addressSourceRecords: SerializedAddressSourceRecord[];
  readonly addressAliases: AuthorityAddressAliasRecord[];
  readonly addressAliasRecords: SerializedAddressAliasRecord[];
  readonly dynamicAddressInputs: AuthorityDynamicAddressInputRecord[];
  readonly dynamicAddressInputRecords: SerializedDynamicAddressInputRecord[];
  readonly dynamicAddressInputsHash: string;
  readonly authoritativeAddressInputsHash: string;
  readonly privilegedMutationPaths: AuthorityMutationPathRecord[];
  readonly privilegedMutationPathRecords: SerializedPrivilegedMutationPathRecord[];
  readonly privilegedMutationPathsHash: string;
  readonly discoveredMutationPathHashes: string[];
  readonly mutationPolicyPath: string;
  readonly mutationPolicyStatus: string;
  readonly unresolvedMutationCandidates: AuthorityMutationCandidate[];
  readonly unresolvedMutationPathHashes: string[];
  readonly externalAuthorization: AuthorityExternalAuthorization;
  readonly releaseReady: boolean;
  readonly onchainObservations: AuthorityOnchainObservation[];
  readonly authoritySchema: MmrAuthoritySchema;
}

export interface AuthorityExternalAuthorization {
  readonly required: true;
  readonly status: "awaiting-a23-authority-freeze";
  readonly authoritySchemaHash: string;
  readonly approvalRecordHash: null;
}

export interface AuthorityFinalizedTransaction {
  readonly blockNumber: number;
  readonly blockHash: string;
  readonly blockTimestamp: number;
  readonly transactionHash: string;
  readonly sender: string;
  readonly classHash: string;
  readonly executionStatus: string;
  readonly finalityStatus: string;
}

export interface AuthorityDeployedSourceRebuild {
  readonly sourceCommit: string;
  readonly lastPredeclarationCommit: string;
  readonly sourcePath: string;
  readonly sourceGitBlob: string;
  readonly sourceSha256: string;
  readonly manifestPath: string;
  readonly manifestGitBlob: string;
  readonly manifestSha256: string;
  readonly lockfilePath: string;
  readonly lockfileGitBlob: string;
  readonly lockfileSha256: string;
  readonly topLevelStorageDeclarationHash: string;
  readonly storageLayoutIdentityKind: "historical-source-package-class-v1";
  readonly storageLayoutIdentityHash: string;
  readonly toolchain: {
    readonly scarbVersion: string;
    readonly scarbBuildCommit: string;
    readonly cairoVersion: string;
    readonly sierraVersion: string;
  };
  readonly cleanBuilds: Array<{
    readonly buildIndex: number;
    readonly sierraArtifactSha256: string;
    readonly casmArtifactSha256: string;
  }>;
  readonly sierraClassHash: string;
  readonly compiledClassHash: string;
  readonly rpcRepresentableCanonicalSha256: string;
  readonly rpcRepresentableClassExactMatch: boolean;
}

export interface AuthorityOnchainObservation {
  readonly chainId: string;
  readonly rpcChainId: string;
  readonly observationKind: "single-rpc-finalized-state-observation-not-proof";
  readonly semanticKey: string;
  readonly rpcUrl: string;
  readonly blockNumber: number;
  readonly blockHash: string;
  readonly stateRoot: string;
  readonly blockStatus: string;
  readonly contractAddress: string;
  readonly classHash: string;
  readonly classResponseSha256: string;
  readonly declaration: AuthorityFinalizedTransaction & { readonly compiledClassHash: string };
  readonly deployment: AuthorityFinalizedTransaction & {
    readonly transactionVersion: string;
    readonly udc: {
      readonly address: string;
      readonly deployContractSelector: string;
      readonly salt: string;
      readonly unique: string;
    };
    readonly accountCalldata: string[];
    readonly constructorCalldata: string[];
    readonly contractDeployedEvent: {
      readonly fromAddress: string;
      readonly selector: string;
      readonly keys: string[];
      readonly data: string[];
    };
  };
  readonly localSourceRebuild: {
    readonly sourcePath: string;
    readonly sierraClassHash: string;
    readonly matchesObservedClass: boolean;
  };
  readonly deployedSourceRebuild: AuthorityDeployedSourceRebuild;
  readonly deploymentBlockNumber: number;
  readonly roleEventsCompleteFromDeployment: boolean;
  readonly controllers: Array<{
    readonly address: string;
    readonly classHash: string;
    readonly executionEntrypoint: string;
    readonly executionSelector: string;
  }>;
  readonly roles: Array<{
    readonly name: string;
    readonly roleId: string;
    readonly adminRoleId: string;
    readonly members: string[];
  }>;
  readonly mutableEntrypoints: Array<{ readonly name: string; readonly selector: string }>;
}

const DEPLOYED_MMR_PROVENANCE = {
  declaration: {
    blockNumber: 7_052_550,
    blockHash: "0x6285eac3822bb771697915415d52722872a6e9f72562d3333923dd849cb44b8",
    blockTimestamp: 1_771_797_419,
    transactionHash: "0x1c4a82af17119d0136061f01e92050ffdd0cdc982011579f953b405c770124f",
  },
  deployment: {
    blockNumber: 7_052_557,
    blockHash: "0x163e9762e2301954dc5ed0fe9de207e7307ec559d6b02a549d42833c872aa91",
    blockTimestamp: 1_771_797_436,
    transactionHash: "0x24d64ab4a5355ab00a0c8cf39e25a764cd59009fa2cb7b2d68bd4fd38b8b6d7",
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
  },
  sender: "0x6292eefbff50689b0e4d007e6ad17abee996e08e66e62762f0c4bc170738402",
  classHash: "0x1dc09743f158d6e650b1b14e9557806c898274a5423ec9857558cabb2b7c1d8",
  compiledClassHash: "0x742167c3d25ad97497fe17270c90a6cf23d0541f52c464f200b1523cf02b948",
  constructorCalldata: [
    "0x6292eefbff50689b0e4d007e6ad17abee996e08e66e62762f0c4bc170738402",
    "0x7fd490b3ba298e4b94e3c32df832823b102e39ce98cd41076a70b2f82d9326e",
  ],
  sourceCommit: "00bdf7bec3a239a34fc16a4d47e70b91c30cddca",
  lastPredeclarationCommit: "fcaaf36ff8c696a26e3b2f99b29d0c729140ff70",
  sourcePath: "contracts/mmr/src/contract.cairo",
  sourceGitBlob: "081fd7cbe4e6c4ef35b6e5e1c383b1332232dfbc",
  sourceSha256: "456e26c7347d673cd3954db03d5be8a7edc270cbd33ee0793379a2f73f28e286",
  manifestPath: "contracts/mmr/Scarb.toml",
  manifestGitBlob: "5d0f1d10ea7f8e2bb76c53ccba1f701fcb30ec68",
  manifestSha256: "cfed48843010d45e5fcc1151cecb4803bb75623fb4cbfb49d79f0eaaaa938986",
  lockfilePath: "contracts/mmr/Scarb.lock",
  lockfileGitBlob: "f7ad430a7577d4d43da7905271d7893ff033ebb4",
  lockfileSha256: "32cb4d4e7fce00a6d5799b3bdc93663227c991068df8b3cb6a3639de39a22939",
  topLevelStorageDeclarationHash: "0x27cb4147c8f9d0699bfc5c477dfd1fb79beec889a607d1bcc97454bd2ee9fb1",
  storageLayoutIdentityKind: "historical-source-package-class-v1",
  storageLayoutIdentityHash: "0x4a992114f95f83ddff05a6df6dc468b41a9c9cc198cb8eb99f0c4ccace2c7a8",
  toolchain: {
    scarbVersion: "2.13.1",
    scarbBuildCommit: "a76aed717",
    cairoVersion: "2.13.1",
    sierraVersion: "1.7.0",
  },
  sierraArtifactSha256: "ea2dc62d6788dc0200e23636df4d269c65c2933bf8a4a3e307ef7c971dc34c2a",
  casmArtifactSha256: "1fb939a346037e07fbd97e064ef6ad6f50265c0ef7558179267483a564cb0a67",
  rpcRepresentableCanonicalSha256: "8993be37fe3f3670907d61177e4398b66f4817af4f28115dcaea5a7d0d309bf4",
} as const;

export function getAuthorityInventory(): AuthorityInventory {
  return structuredClone(authorityInventory) as AuthorityInventory;
}

export function getAddressSourceRecords(): AddressSourceRecord[] {
  return getAuthorityInventory().addressSourceRecords.map((record) => ({
    chain_id: BigInt(record.chain_id),
    semantic_key: BigInt(record.semantic_key),
    source_kind: BigInt(record.source_kind),
    source_path_hash: BigInt(record.source_path_hash),
    source_key_hash: BigInt(record.source_key_hash),
    value: BigInt(record.value),
    is_authoritative: record.is_authoritative,
    allowed_profile_bitmap: BigInt(record.allowed_profile_bitmap),
  }));
}

export function getAddressAliasRecords(): AddressAliasRecord[] {
  return getAuthorityInventory().addressAliasRecords.map((record) => ({
    chain_id: BigInt(record.chain_id),
    semantic_key: BigInt(record.semantic_key),
    alias_path_hash: BigInt(record.alias_path_hash),
    alias_key_hash: BigInt(record.alias_key_hash),
    disposition: BigInt(record.disposition),
    expected_value: BigInt(record.expected_value),
  }));
}

export function getPrivilegedMutationPathRecords(): PrivilegedMutationPathRecord[] {
  return getAuthorityInventory().privilegedMutationPathRecords.map((record) => ({
    path_hash: BigInt(record.path_hash),
    operation_kind: BigInt(record.operation_kind),
    target_semantic_key: BigInt(record.target_semantic_key),
    production_disposition: BigInt(record.production_disposition),
    replacement_path_hash: BigInt(record.replacement_path_hash),
    evidence_hash: BigInt(record.evidence_hash),
  }));
}

export function validateAuthorityInventory(inventory: AuthorityInventory): void {
  validateGeneratedArtifacts(inventory);
  const authorities = indexAuthorities(inventory.addressSources);
  validateAddressSources(inventory.addressSources, inventory.addressAliases, authorities);
  validateAliases(inventory.addressAliases, authorities);
  validateDynamicAddressInputs(inventory.dynamicAddressInputs);
  validateMutationCoverage(inventory);
  validateRecordProjections(inventory);
  validateCommitments(inventory);
  validateOnchainObservations(inventory);
  validateAuthoritySchema(inventory.authoritySchema);
  validateEvidenceAndAuthorization(inventory);
}

export function validateAuthorityInventoryForRelease(inventory: AuthorityInventory): void {
  validateAuthorityInventory(inventory);
  if (inventory.unresolvedMutationCandidates.length > 0) {
    throw new Error("authority inventory has unresolved privileged mutation paths");
  }
  if (!inventory.authoritySchema.observedClassMatchesLocalStorageLayoutSource) {
    throw new Error("observed MMR class does not match the local storage-layout source");
  }
  throw new Error("authority inventory release authorization requires a cryptographically verified A23 artifact");
}

export function computeAuthoritativeAddressInputsHash(inventory: AuthorityInventory): string {
  return computeAddressInputsCommitment(
    inventory.addressSourceRecords,
    inventory.addressAliasRecords,
    inventory.dynamicAddressInputRecords,
  );
}

export function computeDynamicAddressInputsHash(inventory: AuthorityInventory): string {
  return computeDynamicAddressInputsCommitment(inventory.dynamicAddressInputRecords);
}

export function computePrivilegedMutationPathsHash(inventory: AuthorityInventory): string {
  return computeMutationPathsCommitment(inventory.privilegedMutationPathRecords);
}

export function computeAuthoritySchemaHash(schema: MmrAuthoritySchema): string {
  return computeAuthoritySchemaCommitment(schema);
}

function validateRecordProjections(inventory: AuthorityInventory): void {
  assertProjection(
    inventory.addressSourceRecords,
    inventory.addressSources.map((record) => ({
      chain_id: record.chainIdFelt,
      semantic_key: record.semanticKeyHash,
      source_kind: record.sourceKind,
      source_path_hash: record.sourcePathHash,
      source_key_hash: record.sourceKeyHash,
      value: record.value,
      is_authoritative: record.isAuthoritative,
      allowed_profile_bitmap: record.allowedProfileBitmap,
    })),
    "address source record",
  );
  assertProjection(
    inventory.addressAliasRecords,
    inventory.addressAliases.map((record) => ({
      chain_id: record.chainIdFelt,
      semantic_key: record.semanticKeyHash,
      alias_path_hash: record.aliasPathHash,
      alias_key_hash: record.aliasKeyHash,
      disposition: record.disposition,
      expected_value: record.expectedValue,
    })),
    "address alias record",
  );
  assertProjection(
    inventory.dynamicAddressInputRecords,
    inventory.dynamicAddressInputs.map((record) => ({
      semantic_key: record.semanticKeyHash,
      source_path_hash: record.sourcePathHash,
      source_key_hash: record.sourceKeyHash,
      input_kind: record.inputKindCode,
      is_authoritative: record.isAuthoritative,
      allowed_profile_bitmap: record.allowedProfileBitmap,
    })),
    "dynamic address input record",
  );
  assertProjection(
    inventory.privilegedMutationPathRecords,
    inventory.privilegedMutationPaths.map((record) => ({
      path_hash: record.pathHash,
      operation_kind: record.operationKind,
      target_semantic_key: record.targetSemanticKey,
      production_disposition: record.productionDisposition,
      replacement_path_hash: record.replacementPathHash,
      evidence_hash: record.evidenceHash,
    })),
    "privileged mutation path record",
  );
}

function assertProjection(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label} projection mismatch`);
}

function validateGeneratedArtifacts(inventory: AuthorityInventory): void {
  if (!inventory.generatedArtifactsCurrent) {
    throw new Error("generated artifact address inputs are stale");
  }
}

function validateOnchainObservations(inventory: AuthorityInventory): void {
  for (const observation of inventory.onchainObservations) {
    if (observation.observationKind !== "single-rpc-finalized-state-observation-not-proof") {
      throw new Error(`onchain observation trust boundary mismatch: ${observation.semanticKey}`);
    }
    if (observation.chainId === "mainnet" && !sameFelt(observation.rpcChainId, "0x534e5f4d41494e")) {
      throw new Error(`onchain observation RPC chain mismatch: ${observation.semanticKey}`);
    }
    if (observation.blockStatus !== "ACCEPTED_ON_L1" || !observation.roleEventsCompleteFromDeployment) {
      throw new Error(`onchain observation is not finalized and complete: ${observation.semanticKey}`);
    }
    const source = inventory.addressSources.find(
      (record) =>
        record.chainId === observation.chainId &&
        record.semanticKey === observation.semanticKey &&
        record.sourceKind === AddressSourceKind.OnchainObservation,
    );
    if (!source || !sameFelt(source.value, observation.contractAddress)) {
      throw new Error(`onchain observation source mismatch: ${observation.semanticKey}`);
    }
    for (const entrypoint of observation.mutableEntrypoints) {
      if (!sameFelt(entrypoint.selector, hash.getSelectorFromName(entrypoint.name))) {
        throw new Error(`onchain observation selector mismatch: ${entrypoint.name}`);
      }
    }
  }

  const mmrObservation = inventory.onchainObservations.find(({ semanticKey }) => semanticKey === "mmrToken");
  if (!mmrObservation) throw new Error("missing finalized MMR token observation");
  if (
    !sameFelt(mmrObservation.contractAddress, inventory.authoritySchema.tokenAddress) ||
    !sameFelt(mmrObservation.classHash, inventory.authoritySchema.tokenClassHash)
  ) {
    throw new Error("MMR authority schema does not match the finalized onchain observation");
  }
  validateCurrentLaneSourceRebuild(mmrObservation);
  validateFinalizedMmrTransactions(mmrObservation);
  validateDeployedMmrSourceRebuild(mmrObservation);
  const sourceClassMatches = sameFelt(mmrObservation.deployedSourceRebuild.sierraClassHash, mmrObservation.classHash);
  if (
    sourceClassMatches !== inventory.authoritySchema.observedClassMatchesLocalStorageLayoutSource ||
    !sameFelt(mmrObservation.deployedSourceRebuild.sierraClassHash, inventory.authoritySchema.localSourceClassHash) ||
    !sameFelt(
      mmrObservation.deployedSourceRebuild.storageLayoutIdentityHash,
      inventory.authoritySchema.tokenStorageLayoutHash,
    )
  ) {
    throw new Error("deployed MMR source provenance does not match the authority schema");
  }
  if (inventory.authoritySchema.status !== "provenance-complete-awaiting-a23-freeze") {
    throw new Error("MMR authority schema provenance status mismatch");
  }
  const observedRoles = mmrObservation.roles
    .map(({ name, roleId, adminRoleId, members }) => ({
      name,
      roleId,
      adminRoleId,
      members: members.map((member) => BigInt(member).toString()).sort(compareNumericStrings),
    }))
    .sort(compareRoleIds);
  const schemaRoles = inventory.authoritySchema.roles
    .map(({ name, roleId, adminRoleId, members }) => ({
      name,
      roleId,
      adminRoleId,
      members: members.map(({ member }) => BigInt(member).toString()).sort(compareNumericStrings),
    }))
    .sort(compareRoleIds);
  if (JSON.stringify(observedRoles) !== JSON.stringify(schemaRoles)) {
    throw new Error("MMR authority roles do not match the finalized onchain observation");
  }
  validateObservedAuthorityEntrypoints(mmrObservation, inventory.authoritySchema);
  validateObservedControllerRoutes(mmrObservation, inventory.authoritySchema);
}

function validateCurrentLaneSourceRebuild(observation: AuthorityOnchainObservation): void {
  const currentLaneMatches = sameFelt(observation.localSourceRebuild.sierraClassHash, observation.classHash);
  if (currentLaneMatches !== observation.localSourceRebuild.matchesObservedClass) {
    throw new Error("current MMR package-lane rebuild comparison is stale");
  }
}

function validateFinalizedMmrTransactions(observation: AuthorityOnchainObservation): void {
  validateFinalizedTransaction(observation.declaration, DEPLOYED_MMR_PROVENANCE.declaration, "declaration");
  validateFinalizedTransaction(observation.deployment, DEPLOYED_MMR_PROVENANCE.deployment, "deployment");
  assertExact(observation.declaration.sender, DEPLOYED_MMR_PROVENANCE.sender, "MMR declaration sender");
  assertExact(observation.deployment.sender, DEPLOYED_MMR_PROVENANCE.sender, "MMR deployment sender");
  assertFelt(observation.declaration.classHash, observation.classHash, "MMR declaration class hash");
  assertFelt(observation.deployment.classHash, observation.classHash, "MMR deployment class hash");
  assertFelt(
    observation.declaration.compiledClassHash,
    DEPLOYED_MMR_PROVENANCE.compiledClassHash,
    "MMR declaration compiled class hash",
  );
  validateMmrDeploymentProvenance(observation);
  if (observation.deployment.blockNumber !== observation.deploymentBlockNumber) {
    throw new Error("MMR deployment boundary does not match the finalized deployment");
  }
}

function validateMmrDeploymentProvenance(observation: AuthorityOnchainObservation): void {
  const deployment = observation.deployment;
  const expected = DEPLOYED_MMR_PROVENANCE.deployment;
  assertExact(deployment.transactionVersion, expected.transactionVersion, "MMR deployment transaction version");
  assertExact(deployment.udc, expected.udc, "MMR deployment UDC identity");
  assertExact(deployment.accountCalldata, expected.accountCalldata, "MMR deployment account calldata");
  assertExact(
    deployment.constructorCalldata,
    DEPLOYED_MMR_PROVENANCE.constructorCalldata,
    "MMR deployment constructor calldata",
  );
  assertExact(deployment.contractDeployedEvent, expected.contractDeployedEvent, "MMR ContractDeployed event");
}

function validateFinalizedTransaction(
  transaction: AuthorityFinalizedTransaction,
  expected: {
    readonly blockNumber: number;
    readonly blockHash: string;
    readonly blockTimestamp: number;
    readonly transactionHash: string;
  },
  label: string,
): void {
  assertExact(transaction.blockNumber, expected.blockNumber, `MMR ${label} block number`);
  assertFelt(transaction.blockHash, expected.blockHash, `MMR ${label} block hash`);
  assertExact(transaction.blockTimestamp, expected.blockTimestamp, `MMR ${label} block timestamp`);
  assertFelt(transaction.transactionHash, expected.transactionHash, `MMR ${label} transaction hash`);
  assertExact(transaction.executionStatus, "SUCCEEDED", `MMR ${label} execution status`);
  assertExact(transaction.finalityStatus, "ACCEPTED_ON_L1", `MMR ${label} finality status`);
}

function validateDeployedMmrSourceRebuild(observation: AuthorityOnchainObservation): void {
  const rebuild = observation.deployedSourceRebuild;
  validateDeployedMmrSourceInputs(rebuild);
  validateDeployedMmrToolchain(rebuild);
  validateDeployedMmrCleanBuilds(rebuild);
  assertFelt(rebuild.sierraClassHash, observation.classHash, "deployed MMR Sierra class hash");
  assertFelt(rebuild.compiledClassHash, observation.declaration.compiledClassHash, "deployed MMR compiled class hash");
  assertExact(
    rebuild.rpcRepresentableCanonicalSha256,
    DEPLOYED_MMR_PROVENANCE.rpcRepresentableCanonicalSha256,
    "deployed MMR normalized RPC class hash",
  );
  if (!rebuild.rpcRepresentableClassExactMatch) {
    throw new Error("deployed MMR normalized RPC class does not match the historical rebuild");
  }
  assertExact(
    rebuild.storageLayoutIdentityKind,
    "historical-source-package-class-v1",
    "deployed MMR storage-layout identity kind",
  );
  assertFelt(
    computeHistoricalStorageLayoutIdentityHash(rebuild),
    rebuild.storageLayoutIdentityHash,
    "deployed MMR storage-layout identity",
  );
}

function validateDeployedMmrSourceInputs(rebuild: AuthorityDeployedSourceRebuild): void {
  for (const [actual, expected, label] of [
    [rebuild.sourceCommit, DEPLOYED_MMR_PROVENANCE.sourceCommit, "source commit"],
    [rebuild.lastPredeclarationCommit, DEPLOYED_MMR_PROVENANCE.lastPredeclarationCommit, "predeclaration commit"],
    [rebuild.sourcePath, DEPLOYED_MMR_PROVENANCE.sourcePath, "source path"],
    [rebuild.sourceGitBlob, DEPLOYED_MMR_PROVENANCE.sourceGitBlob, "source Git blob"],
    [rebuild.sourceSha256, DEPLOYED_MMR_PROVENANCE.sourceSha256, "source SHA-256"],
    [rebuild.manifestPath, DEPLOYED_MMR_PROVENANCE.manifestPath, "manifest path"],
    [rebuild.manifestGitBlob, DEPLOYED_MMR_PROVENANCE.manifestGitBlob, "manifest Git blob"],
    [rebuild.manifestSha256, DEPLOYED_MMR_PROVENANCE.manifestSha256, "manifest SHA-256"],
    [rebuild.lockfilePath, DEPLOYED_MMR_PROVENANCE.lockfilePath, "lockfile path"],
    [rebuild.lockfileGitBlob, DEPLOYED_MMR_PROVENANCE.lockfileGitBlob, "lockfile Git blob"],
    [rebuild.lockfileSha256, DEPLOYED_MMR_PROVENANCE.lockfileSha256, "lockfile SHA-256"],
    [
      rebuild.topLevelStorageDeclarationHash,
      DEPLOYED_MMR_PROVENANCE.topLevelStorageDeclarationHash,
      "top-level storage declaration hash",
    ],
    [rebuild.storageLayoutIdentityHash, DEPLOYED_MMR_PROVENANCE.storageLayoutIdentityHash, "storage layout identity"],
  ] as const) {
    assertExact(actual, expected, `deployed MMR ${label}`);
  }
}

function validateDeployedMmrToolchain(rebuild: AuthorityDeployedSourceRebuild): void {
  assertExact(rebuild.toolchain, DEPLOYED_MMR_PROVENANCE.toolchain, "deployed MMR toolchain");
}

function validateDeployedMmrCleanBuilds(rebuild: AuthorityDeployedSourceRebuild): void {
  const expected = [0, 1].map((buildIndex) => ({
    buildIndex,
    sierraArtifactSha256: DEPLOYED_MMR_PROVENANCE.sierraArtifactSha256,
    casmArtifactSha256: DEPLOYED_MMR_PROVENANCE.casmArtifactSha256,
  }));
  assertExact(rebuild.cleanBuilds, expected, "two clean deployed MMR builds");
}

function assertExact(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label} mismatch`);
}

function assertFelt(actual: string, expected: string, label: string): void {
  if (!sameFelt(actual, expected)) throw new Error(`${label} mismatch`);
}

function validateObservedAuthorityEntrypoints(
  observation: AuthorityOnchainObservation,
  schema: MmrAuthoritySchema,
): void {
  const economicEntrypoints = new Set(["update_mmr", "update_mmr_batch"]);
  const enabledSelectors = new Set(
    schema.capabilities.filter(({ enabled }) => enabled).map(({ selector }) => BigInt(selector).toString()),
  );
  for (const entrypoint of observation.mutableEntrypoints) {
    if (economicEntrypoints.has(entrypoint.name)) continue;
    if (!enabledSelectors.has(BigInt(entrypoint.selector).toString())) {
      throw new Error(`observed mutable authority entrypoint is absent from the schema: ${entrypoint.name}`);
    }
  }
}

function validateObservedControllerRoutes(observation: AuthorityOnchainObservation, schema: MmrAuthoritySchema): void {
  const controllers = new Map(
    observation.controllers.map((controller) => [BigInt(controller.address).toString(), controller]),
  );
  for (const capability of schema.capabilities.filter(({ enabled }) => enabled)) {
    const controller = controllers.get(BigInt(capability.controller).toString());
    if (!controller) throw new Error(`authority route controller is not observed: ${capability.semanticKey}`);
    const parts = capability.routeDescriptor.split(":");
    if (parts[0] === "account-route-v1") {
      assertRouteFelt(parts[1], controller.address, capability.semanticKey);
      assertRouteFelt(parts[2], controller.classHash, capability.semanticKey);
      assertRouteFelt(parts[3], controller.executionSelector, capability.semanticKey);
      assertRouteFelt(parts[4], observation.contractAddress, capability.semanticKey);
      assertRouteFelt(parts[5], capability.selector, capability.semanticKey);
    } else if (parts[0] === "direct-route-v1") {
      assertRouteFelt(parts[1], controller.address, capability.semanticKey);
      assertRouteFelt(parts[2], observation.contractAddress, capability.semanticKey);
      assertRouteFelt(parts[3], capability.selector, capability.semanticKey);
    } else if (parts[0] === "generic-executor-route-v1") {
      assertRouteFelt(parts[1], controller.address, capability.semanticKey);
      assertRouteFelt(parts[2], controller.classHash, capability.semanticKey);
      assertRouteFelt(parts[3], controller.executionSelector, capability.semanticKey);
    } else {
      throw new Error(`unknown authority route descriptor: ${capability.semanticKey}`);
    }
  }
}

function assertRouteFelt(actual: string | undefined, expected: string, semanticKey: string): void {
  if (actual === undefined || !sameFelt(actual, expected)) {
    throw new Error(`authority route does not match finalized controller topology: ${semanticKey}`);
  }
}

function compareNumericStrings(left: string, right: string): number {
  return BigInt(left) < BigInt(right) ? -1 : BigInt(left) > BigInt(right) ? 1 : 0;
}

function compareRoleIds(left: { roleId: string }, right: { roleId: string }): number {
  return compareNumericStrings(left.roleId, right.roleId);
}

function indexAuthorities(records: AuthorityAddressSourceRecord[]): Map<string, AuthorityAddressSourceRecord> {
  const groups = new Map<string, AuthorityAddressSourceRecord[]>();
  for (const record of records) {
    const key = authorityKey(record.chainId, record.semanticKey);
    const group = groups.get(key) ?? [];
    group.push(record);
    groups.set(key, group);
  }

  const authorities = new Map<string, AuthorityAddressSourceRecord>();
  for (const [key, group] of groups) {
    const canonical = group.filter(({ isAuthoritative }) => isAuthoritative);
    if (canonical.length !== 1) throw new Error(`${key} must have exactly one authority`);
    authorities.set(key, canonical[0]);
  }
  return authorities;
}

function validateAddressSources(
  records: AuthorityAddressSourceRecord[],
  aliases: AuthorityAddressAliasRecord[],
  authorities: Map<string, AuthorityAddressSourceRecord>,
): void {
  for (const record of records) {
    if (record.sourceKind === AddressSourceKind.GeneratedArtifact && record.isAuthoritative) {
      throw new Error("generated artifact cannot be authoritative");
    }
    const authority = authorities.get(authorityKey(record.chainId, record.semanticKey));
    if (!authority || record.isAuthoritative || sameFelt(record.value, authority.value)) continue;
    if (record.sourceKind === AddressSourceKind.OnchainObservation) {
      throw new Error(`live onchain class/address mismatch for ${record.chainId}:${record.semanticKey}`);
    }
    if (record.sourceKind === AddressSourceKind.EnvironmentOrCli) {
      throw new Error(`hidden environment/CLI override for ${record.chainId}:${record.semanticKey}`);
    }
    if (!hasExplicitAlias(aliases, record)) {
      throw new Error(`zero/nonzero conflict for ${record.chainId}:${record.semanticKey} at ${record.sourcePath}`);
    }
  }
}

function validateDynamicAddressInputs(records: AuthorityDynamicAddressInputRecord[]): void {
  const identities = new Set<string>();
  for (const record of records) {
    const identity = `${record.semanticKey}:${record.sourcePath}:${record.sourceKey}`;
    if (identities.has(identity)) throw new Error(`duplicate dynamic address input: ${identity}`);
    identities.add(identity);
    if (record.value !== null || record.isAuthoritative !== false) {
      throw new Error(`dynamic address input must remain non-authoritative and unresolved: ${identity}`);
    }
    if (record.semanticKeyHash !== hashAuthorityDomain(record.semanticKey)) {
      throw new Error(`dynamic address input semantic identity mismatch: ${identity}`);
    }
    if (
      record.sourcePathHash !== hashAuthorityDomain(record.sourcePath) ||
      record.sourceKeyHash !== hashAuthorityDomain(record.sourceKey)
    ) {
      throw new Error(`dynamic address input source identity mismatch: ${identity}`);
    }
    if (record.inputKindCode !== dynamicAddressInputKindCode(record.inputKind)) {
      throw new Error(`dynamic address input kind mismatch: ${identity}`);
    }
    const profileBitmap = BigInt(record.allowedProfileBitmap);
    if (profileBitmap === 0n || (profileBitmap & ~0x1fn) !== 0n) {
      throw new Error(`dynamic address input profile scope mismatch: ${identity}`);
    }
  }
}

function dynamicAddressInputKindCode(inputKind: AuthorityDynamicAddressInputRecord["inputKind"]): number {
  return { environment: 1, cli: 2, "runtime-field": 3 }[inputKind];
}

function validateCommitments(inventory: AuthorityInventory): void {
  if (!sameFelt(computeDynamicAddressInputsHash(inventory), inventory.dynamicAddressInputsHash)) {
    throw new Error("dynamic address inputs hash mismatch");
  }
  if (!sameFelt(computeAuthoritativeAddressInputsHash(inventory), inventory.authoritativeAddressInputsHash)) {
    throw new Error("authoritative address inputs hash mismatch");
  }
  if (!sameFelt(computePrivilegedMutationPathsHash(inventory), inventory.privilegedMutationPathsHash)) {
    throw new Error("privileged mutation paths hash mismatch");
  }
}

function validateAuthoritySchema(schema: MmrAuthoritySchema): void {
  assertContiguousIndexes(
    schema.roles.map(({ roleIndex }) => roleIndex),
    "role",
  );
  assertContiguousIndexes(
    schema.capabilities.map(({ capabilityIndex }) => capabilityIndex),
    "capability",
  );
  if (new Set(schema.roles.map(({ roleId }) => BigInt(roleId).toString())).size !== schema.roles.length) {
    throw new Error("duplicate authority role");
  }
  if (
    new Set(schema.capabilities.map(({ capabilityId }) => BigInt(capabilityId).toString())).size !==
    schema.capabilities.length
  ) {
    throw new Error("duplicate authority capability");
  }
  if (!isSortedByFelt(schema.roles.map(({ roleId }) => roleId))) {
    throw new Error("authority roles must be sorted by role id");
  }
  for (const role of schema.roles) {
    assertContiguousIndexes(
      role.members.map(({ memberIndex }) => memberIndex),
      `${role.name} member`,
    );
    const memberAddresses = role.members.map(({ member }) => member);
    if (
      !isSortedByFelt(memberAddresses) ||
      new Set(memberAddresses.map((member) => BigInt(member).toString())).size !== role.members.length
    ) {
      throw new Error(`authority role members must be unique and sorted: ${role.name}`);
    }
    const expectedMembersHash = authorityCountedHash(
      "LEGACY_MMR_AUTHORITY_MEMBERS_V1",
      role.members.map(({ memberIndex, member }) =>
        authorityPoseidon("LEGACY_MMR_AUTHORITY_MEMBER_V1", memberIndex, member),
      ),
    );
    if (!sameFelt(role.membersHash, expectedMembersHash)) {
      throw new Error(`authority role members hash mismatch: ${role.name}`);
    }
  }
  if (!capabilitiesAreSorted(schema.capabilities)) {
    throw new Error("authority capabilities must be sorted by kind, selector, and id");
  }
  const commitments = computeAuthoritySchemaCommitments(schema);
  if (!sameFelt(commitments.roleDescriptorsHash, schema.roleDescriptorsHash)) {
    throw new Error("authority role descriptors hash mismatch");
  }
  if (!sameFelt(commitments.capabilityDescriptorsHash, schema.capabilityDescriptorsHash)) {
    throw new Error("authority capability descriptors hash mismatch");
  }
  if (!sameFelt(commitments.authoritySchemaHash, schema.authoritySchemaHash)) {
    throw new Error("authority schema hash mismatch");
  }
  for (const capability of schema.capabilities) {
    if (capability.capabilityKind < 1 || capability.capabilityKind > 6) {
      throw new Error(`unknown authority capability kind ${capability.capabilityKind}`);
    }
    if (!sameFelt(capability.selector, hash.getSelectorFromName(capability.selectorName))) {
      throw new Error(`authority capability selector mismatch: ${capability.semanticKey}`);
    }
    const expectedCapabilityId = authorityPoseidon(
      "LEGACY_MMR_AUTHORITY_CAPABILITY_ID_V1",
      hash.getSelectorFromName(capability.semanticKey),
      capability.controllerKind,
      capability.expectedRouteDescriptorHash,
    );
    if (!sameFelt(capability.capabilityId, expectedCapabilityId)) {
      throw new Error(`authority capability id mismatch: ${capability.semanticKey}`);
    }
    const expectedRouteDescriptorHash = hashAuthorityDomain(
      capability.routeDescriptor || `disabled:${capability.semanticKey}`,
    );
    if (!sameFelt(capability.expectedRouteDescriptorHash, expectedRouteDescriptorHash)) {
      throw new Error(`authority capability route descriptor mismatch: ${capability.semanticKey}`);
    }
    if (
      capability.enabled &&
      (sameFelt(capability.controller, "0x0") ||
        sameFelt(capability.routeHash, "0x0") ||
        !sameFelt(capability.routeHash, capability.expectedRouteDescriptorHash))
    ) {
      throw new Error(`enabled capability lacks controller or route: ${capability.semanticKey}`);
    }
    if (!capability.enabled && (!sameFelt(capability.controller, "0x0") || !sameFelt(capability.routeHash, "0x0"))) {
      throw new Error(`disabled capability exposes controller or route: ${capability.semanticKey}`);
    }
  }
}

function isSortedByFelt(values: string[]): boolean {
  return values.every((value, index) => index === 0 || BigInt(values[index - 1]) < BigInt(value));
}

function capabilitiesAreSorted(capabilities: AuthorityCapabilityDescriptor[]): boolean {
  return capabilities.every((capability, index) => {
    if (index === 0) return true;
    const previous = capabilities[index - 1];
    return (
      previous.capabilityKind < capability.capabilityKind ||
      (previous.capabilityKind === capability.capabilityKind &&
        BigInt(previous.selector) < BigInt(capability.selector)) ||
      (previous.capabilityKind === capability.capabilityKind &&
        BigInt(previous.selector) === BigInt(capability.selector) &&
        BigInt(previous.capabilityId) < BigInt(capability.capabilityId))
    );
  });
}

function assertContiguousIndexes(indexes: number[], label: string): void {
  if (indexes.some((index, position) => index !== position)) {
    throw new Error(`${label} indexes must be contiguous`);
  }
}

function validateAliases(
  aliases: AuthorityAddressAliasRecord[],
  authorities: Map<string, AuthorityAddressSourceRecord>,
): void {
  for (const alias of aliases) {
    const authority = authorities.get(authorityKey(alias.chainId, alias.semanticKey));
    if (!authority) throw new Error(`unknown alias ${alias.sourcePath}:${alias.sourceKey}`);
    if (alias.disposition === AddressAliasDisposition.Exact && !sameFelt(alias.expectedValue, authority.value)) {
      throw new Error(`exact alias mismatch for ${alias.chainId}:${alias.semanticKey}`);
    }
    if (
      alias.disposition === AddressAliasDisposition.DeprecatedZeroRejected &&
      (!sameFelt(alias.expectedValue, "0x0") || sameFelt(authority.value, "0x0"))
    ) {
      throw new Error(`invalid deprecated-zero alias for ${alias.chainId}:${alias.semanticKey}`);
    }
  }
}

function validateMutationCoverage(inventory: AuthorityInventory): void {
  const reviewed = new Set(inventory.privilegedMutationPaths.map(({ pathHash }) => pathHash));
  const unresolved = new Set(inventory.unresolvedMutationCandidates.map(({ pathHash }) => pathHash));
  const covered = new Set([...reviewed, ...unresolved]);
  for (const pathHash of inventory.discoveredMutationPathHashes) {
    if (!covered.has(pathHash)) throw new Error(`uncovered privileged mutation path ${pathHash}`);
  }
  if (covered.size !== inventory.discoveredMutationPathHashes.length) {
    throw new Error("duplicate or extraneous privileged mutation review path");
  }
  const expectedUnresolvedHashes = inventory.unresolvedMutationCandidates
    .map(({ pathHash }) => pathHash)
    .sort(compareFeltStrings);
  const publishedUnresolvedHashes = [...inventory.unresolvedMutationPathHashes].sort(compareFeltStrings);
  if (JSON.stringify(expectedUnresolvedHashes) !== JSON.stringify(publishedUnresolvedHashes)) {
    throw new Error("unresolved mutation path hash projection mismatch");
  }
  for (const record of inventory.privilegedMutationPaths) {
    if (
      record.productionDisposition !== ProductionMutationDisposition.CanonicalStructuredOperation &&
      sameFelt(record.evidenceHash, "0x0")
    ) {
      throw new Error(`mutation path lacks production evidence: ${record.path}`);
    }
  }
}

function validateEvidenceAndAuthorization(inventory: AuthorityInventory): void {
  const expectedEvidenceComplete =
    inventory.unresolvedMutationCandidates.length === 0 &&
    inventory.authoritySchema.observedClassMatchesLocalStorageLayoutSource;
  if (inventory.evidenceComplete !== expectedEvidenceComplete) {
    throw new Error("authority inventory evidence-completion mismatch");
  }
  const expectedStatus = expectedEvidenceComplete
    ? "a20-evidence-complete-awaiting-a23-freeze"
    : "mutation-review-complete-observed-class-source-blocked";
  if (inventory.status !== expectedStatus) throw new Error("authority inventory status mismatch");

  const authorization = inventory.externalAuthorization;
  if (
    !authorization.required ||
    !sameFelt(authorization.authoritySchemaHash, inventory.authoritySchema.authoritySchemaHash)
  ) {
    throw new Error("authority schema external-authorization binding mismatch");
  }
  if (authorization.status !== "awaiting-a23-authority-freeze" || authorization.approvalRecordHash !== null) {
    throw new Error(
      "authority schema authorization must remain pending until a cryptographically verified A23 artifact is wired",
    );
  }
  if (inventory.releaseReady) throw new Error("authority inventory release readiness mismatch");
}

function compareFeltStrings(left: string, right: string): number {
  return BigInt(left) < BigInt(right) ? -1 : BigInt(left) > BigInt(right) ? 1 : 0;
}

function hasExplicitAlias(aliases: AuthorityAddressAliasRecord[], source: AuthorityAddressSourceRecord): boolean {
  return aliases.some(
    (alias) =>
      alias.chainId === source.chainId &&
      alias.semanticKey === source.semanticKey &&
      alias.sourcePath === source.sourcePath &&
      alias.sourceKey === source.sourceKey,
  );
}

function authorityKey(chainId: string, semanticKey: string): string {
  return `${chainId}:${semanticKey}`;
}

function sameFelt(left: string, right: string): boolean {
  return BigInt(left) === BigInt(right);
}
