import exitFamilyPolicyJson from "../schema/exit-family-policy-v0.json";
import type { SchemaValue } from "./codec";
import {
  type ExitFamilySourceIdentityPolicy,
  validateExitFamilySourceIdentityCandidateValue,
} from "./exit-family-source-identity";

interface ExitFamilyLayoutPolicy {
  chunking: { chunkSize: number };
  families: Array<{ familyId: number; sourceIdentity: ExitFamilySourceIdentityPolicy }>;
}

declare const EXIT_FAMILY_ID: unique symbol;
export type ExitFamilyId = number & { readonly [EXIT_FAMILY_ID]: true };

export interface ExitFamilyIndexAllocation {
  index: bigint;
  nextHighWatermark: bigint;
}

export interface ExitFamilyPositionState {
  familyId: ExitFamilyId;
  index: bigint;
  generation: bigint;
  tombstoned: boolean;
}

export type ExitFamilyPositionAction = "advance-generation" | "tombstone";

export interface ExitFamilyMigrationChunk {
  familyId: ExitFamilyId;
  chunkIndex: bigint;
  startIndex: bigint;
  positionCount: number;
}

const POLICY = exitFamilyPolicyJson as ExitFamilyLayoutPolicy;
const MAX_U64 = (1n << 64n) - 1n;
const CHUNK_SIZE = BigInt(POLICY.chunking.chunkSize);

export function parseExitFamilyId(value: number): ExitFamilyId {
  if (!Number.isSafeInteger(value) || !POLICY.families.some(({ familyId }) => familyId === value)) {
    throw new Error(`unknown exit family: ${value}`);
  }
  return value as ExitFamilyId;
}

export function allocateExitFamilyIndex(
  familyId: ExitFamilyId,
  currentHighWatermark: bigint,
): ExitFamilyIndexAllocation {
  getFamilyPolicy(familyId);
  assertU64(currentHighWatermark, `family ${familyId} high-watermark`);
  if (currentHighWatermark === MAX_U64) throw new Error(`family ${familyId} u64 index space exhausted`);

  return { index: currentHighWatermark, nextHighWatermark: currentHighWatermark + 1n };
}

export function validateExitFamilySourceIdentityCandidate(
  familyId: ExitFamilyId,
  sourceIdentity: Readonly<Record<string, SchemaValue>>,
): void {
  const identityPolicy = getFamilyPolicy(familyId).sourceIdentity;
  validateExitFamilySourceIdentityCandidateValue(familyId, identityPolicy, sourceIdentity);
}

export function advanceExitFamilyPosition(
  current: Readonly<ExitFamilyPositionState>,
  action: ExitFamilyPositionAction,
): ExitFamilyPositionState {
  getFamilyPolicy(current.familyId);
  assertPositionIndex(current.index);
  assertU64(current.generation, "exit-family position generation");
  if (current.tombstoned) throw new Error("exit-family position is already tombstoned");

  if (action === "tombstone") return { ...current, tombstoned: true };
  if (action === "advance-generation") return advancePositionGeneration(current);
  throw new Error(`unsupported exit-family position action: ${String(action)}`);
}

export function countExitFamilyMigrationChunks(familyId: ExitFamilyId, highWatermark: bigint): bigint {
  getFamilyPolicy(familyId);
  assertU64(highWatermark, `family ${familyId} high-watermark`);
  return (highWatermark + CHUNK_SIZE - 1n) / CHUNK_SIZE;
}

export function resolveExitFamilyMigrationChunk(
  familyId: ExitFamilyId,
  highWatermark: bigint,
  chunkIndex: bigint,
): ExitFamilyMigrationChunk {
  const chunkCount = countExitFamilyMigrationChunks(familyId, highWatermark);
  if (chunkIndex < 0n || chunkIndex >= chunkCount) {
    throw new Error(`family ${familyId} migration chunk is outside its high-watermark`);
  }

  const startIndex = chunkIndex * CHUNK_SIZE;
  const remainingPositions = highWatermark - startIndex;
  return {
    familyId,
    chunkIndex,
    startIndex,
    positionCount: Number(remainingPositions < CHUNK_SIZE ? remainingPositions : CHUNK_SIZE),
  };
}

function advancePositionGeneration(current: Readonly<ExitFamilyPositionState>): ExitFamilyPositionState {
  if (current.generation === MAX_U64) throw new Error("exit-family position generation is exhausted");
  return { ...current, generation: current.generation + 1n };
}

function getFamilyPolicy(familyId: ExitFamilyId): ExitFamilyLayoutPolicy["families"][number] {
  const family = POLICY.families.find((candidate) => candidate.familyId === familyId);
  if (!family) throw new Error(`unknown exit family: ${familyId}`);
  return family;
}

function assertPositionIndex(value: bigint): void {
  assertU64(value, "exit-family position index");
  if (value === MAX_U64) throw new Error("exit-family position index must be below the exclusive u64 high-water limit");
}

function assertU64(value: bigint, label: string): void {
  if (typeof value !== "bigint" || value < 0n || value > MAX_U64) throw new Error(`${label} must be a u64`);
}
