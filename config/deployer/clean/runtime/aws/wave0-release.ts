import { readFileSync } from "node:fs";
import { assertProductionReleaseAuthorized, type A23ReleaseAuthorizationVerification } from "../../game-stack";

const WAVE0_DECISION_URL = new URL(
  "../../../../../packages/settlement-codec/schema/wave0-a23-stop-decision-v1.json",
  import.meta.url,
);

export function assertCurrentWave0ReleaseDecision(verification?: A23ReleaseAuthorizationVerification): void {
  const decision = JSON.parse(readFileSync(WAVE0_DECISION_URL, "utf8")) as unknown;
  assertProductionReleaseAuthorized(decision, verification);
}

export function readA23ReleaseAuthorizationVerification(
  environment: Record<string, string | undefined>,
): A23ReleaseAuthorizationVerification | undefined {
  const serializedKeys = environment.A23_RELEASE_AUTHORITY_PUBLIC_KEYS_JSON?.trim();
  const serializedQuorum = environment.A23_RELEASE_SIGNATURE_QUORUM?.trim();
  if (!serializedKeys && !serializedQuorum) return undefined;
  if (!serializedKeys || !serializedQuorum) {
    throw new Error(
      "A23 authorization requires both A23_RELEASE_AUTHORITY_PUBLIC_KEYS_JSON and A23_RELEASE_SIGNATURE_QUORUM",
    );
  }
  const trustedSignerPublicKeys = parseTrustedSignerPublicKeys(serializedKeys);
  const requiredSignatureCount = Number(serializedQuorum);
  if (!Number.isInteger(requiredSignatureCount) || requiredSignatureCount < 1) {
    throw new Error("A23_RELEASE_SIGNATURE_QUORUM must be a positive integer");
  }
  return { requiredSignatureCount, trustedSignerPublicKeys };
}

function parseTrustedSignerPublicKeys(value: string): Record<string, string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("A23_RELEASE_AUTHORITY_PUBLIC_KEYS_JSON must be valid JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("A23_RELEASE_AUTHORITY_PUBLIC_KEYS_JSON must be an object of signer IDs to public keys");
  }
  const entries = Object.entries(parsed);
  if (
    entries.length === 0 ||
    entries.some(([signerId, publicKey]) => !signerId.trim() || typeof publicKey !== "string" || !publicKey.trim())
  ) {
    throw new Error("A23_RELEASE_AUTHORITY_PUBLIC_KEYS_JSON must contain non-empty signer IDs and public keys");
  }
  return Object.fromEntries(entries) as Record<string, string>;
}
