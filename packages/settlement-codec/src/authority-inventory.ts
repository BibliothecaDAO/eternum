import authorityInventory from "../schema/authority-inventory-v1.json";
import { hash } from "starknet";
import type { AddressAliasRecord, AddressSourceRecord, PrivilegedMutationPathRecord } from "./generated-types";
import {
  authorityCountedHash,
  authorityPoseidon,
  computeAddressInputsCommitment,
  computeAuthoritySchemaCommitment,
  computeAuthoritySchemaCommitments,
  computeMutationPathsCommitment,
  hashAuthorityDomain,
  type SerializedAddressAliasRecord,
  type SerializedAddressSourceRecord,
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
  readonly generatedArtifactsCurrent: boolean;
  readonly addressSources: AuthorityAddressSourceRecord[];
  readonly addressSourceRecords: SerializedAddressSourceRecord[];
  readonly addressAliases: AuthorityAddressAliasRecord[];
  readonly addressAliasRecords: SerializedAddressAliasRecord[];
  readonly authoritativeAddressInputsHash: string;
  readonly privilegedMutationPaths: AuthorityMutationPathRecord[];
  readonly privilegedMutationPathRecords: SerializedPrivilegedMutationPathRecord[];
  readonly privilegedMutationPathsHash: string;
  readonly discoveredMutationPathHashes: string[];
  readonly mutationPolicyPath: string;
  readonly mutationPolicyStatus: string;
  readonly unresolvedMutationCandidates: AuthorityMutationCandidate[];
  readonly unresolvedMutationPathHashes: string[];
  readonly releaseReady: boolean;
  readonly onchainObservations: AuthorityOnchainObservation[];
  readonly authoritySchema: MmrAuthoritySchema;
}

export interface AuthorityOnchainObservation {
  readonly chainId: string;
  readonly semanticKey: string;
  readonly rpcUrl: string;
  readonly blockNumber: number;
  readonly blockHash: string;
  readonly stateRoot: string;
  readonly blockStatus: string;
  readonly contractAddress: string;
  readonly classHash: string;
  readonly classResponseSha256: string;
  readonly localSourceRebuild: {
    readonly sourcePath: string;
    readonly sierraClassHash: string;
    readonly matchesObservedClass: boolean;
  };
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
  validateMutationCoverage(inventory);
  validateRecordProjections(inventory);
  validateCommitments(inventory);
  validateOnchainObservations(inventory);
  validateAuthoritySchema(inventory.authoritySchema);
}

export function validateAuthorityInventoryForRelease(inventory: AuthorityInventory): void {
  validateAuthorityInventory(inventory);
  if (inventory.unresolvedMutationCandidates.length > 0) {
    throw new Error("authority inventory has unresolved privileged mutation paths");
  }
  if (!inventory.authoritySchema.observedClassMatchesLocalStorageLayoutSource) {
    throw new Error("observed MMR class does not match the local storage-layout source");
  }
  if (!inventory.releaseReady) throw new Error("authority inventory is not release ready");
}

export function computeAuthoritativeAddressInputsHash(inventory: AuthorityInventory): string {
  return computeAddressInputsCommitment(inventory.addressSourceRecords, inventory.addressAliasRecords);
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
  const sourceClassMatches = sameFelt(mmrObservation.localSourceRebuild.sierraClassHash, mmrObservation.classHash);
  if (
    sourceClassMatches !== mmrObservation.localSourceRebuild.matchesObservedClass ||
    sourceClassMatches !== inventory.authoritySchema.observedClassMatchesLocalStorageLayoutSource ||
    !sameFelt(mmrObservation.localSourceRebuild.sierraClassHash, inventory.authoritySchema.localSourceClassHash)
  ) {
    throw new Error("MMR local source provenance does not match the authority schema");
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

function validateCommitments(inventory: AuthorityInventory): void {
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
  const expectedReleaseReady =
    inventory.unresolvedMutationCandidates.length === 0 &&
    inventory.authoritySchema.observedClassMatchesLocalStorageLayoutSource;
  if (inventory.releaseReady !== expectedReleaseReady) {
    throw new Error("authority inventory release readiness mismatch");
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
