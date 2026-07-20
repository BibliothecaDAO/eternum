import { hash } from "starknet";

export interface SerializedAddressSourceRecord {
  readonly chain_id: string;
  readonly semantic_key: string;
  readonly source_kind: number;
  readonly source_path_hash: string;
  readonly source_key_hash: string;
  readonly value: string;
  readonly is_authoritative: boolean;
  readonly allowed_profile_bitmap: string;
}

export interface SerializedAddressAliasRecord {
  readonly chain_id: string;
  readonly semantic_key: string;
  readonly alias_path_hash: string;
  readonly alias_key_hash: string;
  readonly disposition: number;
  readonly expected_value: string;
}

export interface SerializedPrivilegedMutationPathRecord {
  readonly path_hash: string;
  readonly operation_kind: number;
  readonly target_semantic_key: string;
  readonly production_disposition: number;
  readonly replacement_path_hash: string;
  readonly evidence_hash: string;
}

export interface AuthoritySchemaCommitmentInput {
  readonly tokenStorageLayoutHash: string;
  readonly roles: ReadonlyArray<{
    readonly roleIndex: number;
    readonly roleId: string;
    readonly adminRoleId: string;
  }>;
  readonly capabilities: ReadonlyArray<{
    readonly capabilityIndex: number;
    readonly capabilityId: string;
    readonly capabilityKind: number;
    readonly selector: string;
  }>;
}

export function computeAddressInputsCommitment(
  sources: readonly SerializedAddressSourceRecord[],
  aliases: readonly SerializedAddressAliasRecord[],
): string {
  const sourceHash = authorityCountedHash(
    "ADDRESS_SOURCE_RECORDS_V1",
    sources.map((record) =>
      authorityPoseidon(
        "ADDRESS_SOURCE_RECORD_V1",
        record.chain_id,
        record.semantic_key,
        record.source_kind,
        record.source_path_hash,
        record.source_key_hash,
        record.value,
        record.is_authoritative ? 1 : 0,
        ...serializeU256(record.allowed_profile_bitmap),
      ),
    ),
  );
  const aliasHash = authorityCountedHash(
    "ADDRESS_ALIAS_RECORDS_V1",
    aliases.map((record) =>
      authorityPoseidon(
        "ADDRESS_ALIAS_RECORD_V1",
        record.chain_id,
        record.semantic_key,
        record.alias_path_hash,
        record.alias_key_hash,
        record.disposition,
        record.expected_value,
      ),
    ),
  );
  return authorityPoseidon("AUTHORITATIVE_ADDRESS_INPUTS_V1", sourceHash, aliasHash);
}

export function computeMutationPathsCommitment(records: readonly SerializedPrivilegedMutationPathRecord[]): string {
  return authorityCountedHash(
    "PRIVILEGED_MUTATION_PATHS_V1",
    records.map((record) =>
      authorityPoseidon(
        "PRIVILEGED_MUTATION_PATH_V1",
        record.path_hash,
        record.operation_kind,
        record.target_semantic_key,
        record.production_disposition,
        record.replacement_path_hash,
        record.evidence_hash,
      ),
    ),
  );
}

export interface AuthoritySchemaCommitments {
  readonly roleDescriptorsHash: string;
  readonly capabilityDescriptorsHash: string;
  readonly authoritySchemaHash: string;
}

export function computeAuthoritySchemaCommitments(schema: AuthoritySchemaCommitmentInput): AuthoritySchemaCommitments {
  const roleDescriptorsHash = authorityCountedHash(
    "LEGACY_MMR_AUTHORITY_ROLE_SCHEMAS_V1",
    schema.roles.map(({ roleIndex, roleId, adminRoleId }) =>
      authorityPoseidon("LEGACY_MMR_AUTHORITY_ROLE_SCHEMA_V1", roleIndex, roleId, adminRoleId),
    ),
  );
  const capabilityDescriptorsHash = authorityCountedHash(
    "LEGACY_MMR_AUTHORITY_CAPABILITY_SCHEMAS_V1",
    schema.capabilities.map(({ capabilityIndex, capabilityId, capabilityKind, selector }) =>
      authorityPoseidon(
        "LEGACY_MMR_AUTHORITY_CAPABILITY_SCHEMA_V1",
        capabilityIndex,
        capabilityId,
        capabilityKind,
        selector,
      ),
    ),
  );
  return {
    roleDescriptorsHash,
    capabilityDescriptorsHash,
    authoritySchemaHash: authorityPoseidon(
      "LEGACY_MMR_TOKEN_AUTHORITY_SCHEMA_V1",
      schema.tokenStorageLayoutHash,
      roleDescriptorsHash,
      capabilityDescriptorsHash,
    ),
  };
}

export function computeAuthoritySchemaCommitment(schema: AuthoritySchemaCommitmentInput): string {
  return computeAuthoritySchemaCommitments(schema).authoritySchemaHash;
}

export function hashAuthorityDomain(value: string): string {
  return `0x${hash.starknetKeccak(value).toString(16)}`;
}

export function authorityPoseidon(domain: string, ...values: Array<string | number>): string {
  return hash.computePoseidonHashOnElements([hash.getSelectorFromName(domain), ...values].map(String));
}

export function authorityCountedHash(domain: string, values: readonly string[]): string {
  return authorityPoseidon(domain, values.length, ...values);
}

function serializeU256(value: string): [string, string] {
  const numeric = BigInt(value);
  const mask = (1n << 128n) - 1n;
  return [`0x${(numeric & mask).toString(16)}`, `0x${(numeric >> 128n).toString(16)}`];
}
