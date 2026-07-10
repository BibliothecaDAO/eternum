import { createHash } from "node:crypto";

const CANONICAL_RUNTIME_NAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;
const RUNTIME_INSTANCE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const RUNTIME_RESOURCE_HASH_LENGTH = 16;

export interface RuntimeIdentity {
  environmentId: string;
  runtimeKind: "katana" | "torii";
  runtimeName: string;
  runtimeInstanceId: string;
}

export function assertCanonicalRuntimeName(runtimeName: string): void {
  if (CANONICAL_RUNTIME_NAME_PATTERN.test(runtimeName)) {
    return;
  }

  throw new Error(
    `Invalid runtime name "${runtimeName}". Use 1-48 lowercase letters, numbers, or hyphens, with no leading or trailing hyphen.`,
  );
}

export function requireRuntimeInstanceId(runtimeInstanceId: string | undefined): string {
  const value = runtimeInstanceId?.trim();
  if (!value) {
    throw new Error("runtimeInstanceId is required");
  }
  if (!RUNTIME_INSTANCE_ID_PATTERN.test(value)) {
    throw new Error("runtimeInstanceId must be a lowercase RFC 9562 UUID");
  }

  return value;
}

export function buildRuntimeResourceHash(identity: RuntimeIdentity): string {
  return createHash("sha256")
    .update(
      [identity.environmentId, identity.runtimeKind, identity.runtimeName, identity.runtimeInstanceId].join("\u0000"),
    )
    .digest("hex")
    .slice(0, RUNTIME_RESOURCE_HASH_LENGTH);
}

export function deriveChildRuntimeInstanceId(parentRuntimeInstanceId: string, runtimeName: string): string {
  assertCanonicalRuntimeName(runtimeName);
  return deriveDeterministicRuntimeInstanceId([
    "series-child",
    requireRuntimeInstanceId(parentRuntimeInstanceId),
    runtimeName,
  ]);
}

export function deriveDeterministicRuntimeInstanceId(seedParts: string[]): string {
  const normalizedSeed = seedParts.map((part) => part.trim());
  if (normalizedSeed.length === 0 || normalizedSeed.some((part) => !part)) {
    throw new Error("Runtime instance ID seed parts must be non-empty");
  }

  const bytes = Buffer.from(createHash("sha256").update(normalizedSeed.join("\u0000")).digest().subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return formatUuid(bytes.toString("hex"));
}

function formatUuid(hex: string): string {
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)].join("-");
}
