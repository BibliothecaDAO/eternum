import { hash } from "starknet";

export interface ExitFamilySchemaCommitmentInput {
  readonly familyId: number;
  readonly capabilityFamily: string;
  readonly sourceIdentityFields: readonly string[];
  readonly indexKey: readonly string[];
  readonly highWatermark: string;
  readonly stableIds: string;
  readonly deletion: string;
  readonly chunkSize: number;
  readonly splitRule: string;
  readonly maximumPositionsPerGame: number | null;
  readonly operationIds: readonly number[];
  readonly affectedModels: readonly string[];
}

export function computeExitFamilySchemaHash(family: ExitFamilySchemaCommitmentInput): string {
  return exitFamilyPoseidon(
    "EXIT_FAMILY_SCHEMA_V0",
    family.familyId,
    hashExitFamilyString(family.capabilityFamily),
    exitFamilyCountedHash(
      "EXIT_FAMILY_SOURCE_IDENTITY_FIELDS_V0",
      family.sourceIdentityFields.map(hashExitFamilyString),
    ),
    exitFamilyCountedHash("EXIT_FAMILY_INDEX_KEY_V0", family.indexKey.map(hashExitFamilyString)),
    hashExitFamilyString(family.highWatermark),
    hashExitFamilyString(family.stableIds),
    hashExitFamilyString(family.deletion),
    family.chunkSize,
    hashExitFamilyString(family.splitRule),
    family.maximumPositionsPerGame ?? 0,
    exitFamilyCountedHash("EXIT_FAMILY_OPERATION_IDS_V0", family.operationIds.map(String)),
    exitFamilyCountedHash("EXIT_FAMILY_AFFECTED_MODELS_V0", family.affectedModels.map(hashExitFamilyString)),
  );
}

export function computeExitFamilyRegistryHash(familySchemaHashes: readonly string[]): string {
  return exitFamilyCountedHash("EXIT_FAMILY_REGISTRY_V0", familySchemaHashes);
}

export function computeExitSourceProjectionHash(sourceWriteIds: readonly string[]): string {
  return exitFamilyCountedHash("EXIT_SOURCE_WRITE_PROJECTION_V0", sourceWriteIds.map(hashExitFamilyString));
}

export function computeExitFamilySourceProjectionHash(familyId: number, sourceWriteIds: readonly string[]): string {
  return exitFamilyPoseidon(
    "EXIT_FAMILY_SOURCE_WRITE_PROJECTION_V0",
    familyId,
    computeExitSourceProjectionHash(sourceWriteIds),
  );
}

export function computeExitFamilyInventoryHash(input: {
  readonly familyRegistryHash: string;
  readonly familySourceProjectionHashes: readonly string[];
  readonly excludedSourceWriteIds: readonly string[];
}): string {
  return exitFamilyPoseidon(
    "EXIT_FAMILY_INVENTORY_V0",
    input.familyRegistryHash,
    exitFamilyCountedHash("EXIT_FAMILY_SOURCE_WRITE_PROJECTIONS_V0", input.familySourceProjectionHashes),
    computeExitSourceProjectionHash(input.excludedSourceWriteIds),
  );
}

export function hashExitFamilyString(value: string): string {
  return `0x${hash.starknetKeccak(value).toString(16)}`;
}

function exitFamilyPoseidon(domain: string, ...values: Array<string | number>): string {
  return hash.computePoseidonHashOnElements([hash.getSelectorFromName(domain), ...values].map(String));
}

function exitFamilyCountedHash(domain: string, values: readonly string[]): string {
  return exitFamilyPoseidon(domain, values.length, ...values);
}
