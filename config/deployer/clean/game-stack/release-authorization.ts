import { createHash, createPublicKey, verify } from "node:crypto";
import { assertCompleteA23GoDecision, type A23GoDecision } from "./a23-decision.mjs";

const A23_AUTHORIZATION_DOMAIN = "ETERNUM_A23_PRODUCTION_PROGRAM_AUTHORIZATION_V1";

export interface A23ReleaseAuthorizationVerification {
  requiredSignatureCount: number;
  trustedSignerPublicKeys: Record<string, string>;
}

interface A23ReleaseSignature {
  signerId: string;
  scheme: "ed25519";
  signatureBase64: string;
}

export function assertProductionReleaseAuthorized(
  value: unknown,
  verification?: A23ReleaseAuthorizationVerification,
): void {
  assertA23ProgramStartAuthorized(value, verification);
  throw new Error(
    "Production activation remains blocked until B-F completion, real-TEE and recovery evidence, audits, and release-candidate approval are independently authorized",
  );
}

export function assertA23ProgramStartAuthorized(
  value: unknown,
  verification?: A23ReleaseAuthorizationVerification,
): void {
  const decision = asA23GoDecision(value);
  const policy = requireVerificationPolicy(verification);
  const signatures = readReleaseSignatures(decision.authorization.signatures);
  assertUniqueSignerIdentities(signatures);
  const message = buildA23ProgramAuthorizationMessage(decision);
  const validSignerCount = countTrustedValidSigners(signatures, message, policy.trustedSignerPublicKeys);
  if (validSignerCount < policy.requiredSignatureCount) {
    throw new Error("A23 authorization does not satisfy the configured signature quorum");
  }
}

export function buildA23ProgramAuthorizationMessage(value: unknown): Uint8Array {
  const decision = asA23GoDecision(value);
  const signingPayload = omitAuthorizationSignatures(decision);
  const digest = createHash("sha256").update(canonicalJson(signingPayload)).digest("hex");
  return new TextEncoder().encode(`${A23_AUTHORIZATION_DOMAIN}\n${digest}`);
}

export function assertA23ReleaseAuthorizationVerification(verification: A23ReleaseAuthorizationVerification): void {
  requireVerificationPolicy(verification);
}

function requireVerificationPolicy(
  verification: A23ReleaseAuthorizationVerification | undefined,
): A23ReleaseAuthorizationVerification {
  if (!verification) {
    throw new Error("Production launch requires a cryptographically verified A23 authorization artifact");
  }
  if (!Number.isInteger(verification.requiredSignatureCount) || verification.requiredSignatureCount < 1) {
    throw new Error("A23 authorization requires a positive signature quorum");
  }
  const fingerprints = trustedPublicKeyFingerprints(verification.trustedSignerPublicKeys);
  if (verification.requiredSignatureCount > fingerprints.size) {
    throw new Error("A23 authorization quorum exceeds the number of distinct trusted public keys");
  }
  return verification;
}

function trustedPublicKeyFingerprints(trustedSignerPublicKeys: Record<string, string>): Set<string> {
  const fingerprints = new Set<string>();
  for (const [signerId, publicKey] of Object.entries(trustedSignerPublicKeys)) {
    if (!signerId.trim() || !publicKey.trim()) throw new Error("A23 authorization contains an invalid trusted signer");
    const fingerprint = publicKeyFingerprint(publicKey);
    if (fingerprints.has(fingerprint)) {
      throw new Error("A23 authorization contains duplicate trusted public-key material");
    }
    fingerprints.add(fingerprint);
  }
  return fingerprints;
}

function publicKeyFingerprint(publicKey: string): string {
  try {
    const key = createPublicKey(publicKey);
    if (key.asymmetricKeyType !== "ed25519") throw new Error("not Ed25519");
    return createHash("sha256")
      .update(key.export({ type: "spki", format: "der" }))
      .digest("hex");
  } catch {
    throw new Error("A23 authorization contains an invalid Ed25519 public key");
  }
}

function readReleaseSignatures(value: unknown): A23ReleaseSignature[] {
  if (!Array.isArray(value)) return [];
  return value.map((signature) => {
    if (!signature || typeof signature !== "object" || Array.isArray(signature)) {
      throw new Error("A23 authorization contains a malformed signature");
    }
    const candidate = signature as Record<string, unknown>;
    if (
      typeof candidate.signerId !== "string" ||
      candidate.signerId.length === 0 ||
      candidate.scheme !== "ed25519" ||
      typeof candidate.signatureBase64 !== "string" ||
      candidate.signatureBase64.length === 0
    ) {
      throw new Error("A23 authorization contains a malformed signature");
    }
    return candidate as unknown as A23ReleaseSignature;
  });
}

function assertUniqueSignerIdentities(signatures: A23ReleaseSignature[]): void {
  const signerIds = new Set<string>();
  for (const signature of signatures) {
    if (signerIds.has(signature.signerId)) {
      throw new Error("A23 authorization contains a duplicate signer identity");
    }
    signerIds.add(signature.signerId);
  }
}

function countTrustedValidSigners(
  signatures: A23ReleaseSignature[],
  message: Uint8Array,
  trustedSignerPublicKeys: Record<string, string>,
): number {
  const verifiedKeyFingerprints = new Set<string>();
  for (const signature of signatures) {
    const publicKey = trustedSignerPublicKeys[signature.signerId];
    if (!publicKey) continue;
    try {
      if (verify(null, message, createPublicKey(publicKey), Buffer.from(signature.signatureBase64, "base64"))) {
        verifiedKeyFingerprints.add(publicKeyFingerprint(publicKey));
      }
    } catch {
      continue;
    }
  }
  return verifiedKeyFingerprints.size;
}

function omitAuthorizationSignatures(decision: A23GoDecision): unknown {
  const authorization = decision.authorization;
  if (!authorization) return decision;
  const { signatures: _signatures, ...signedAuthorization } = authorization;
  return { ...decision, authorization: signedAuthorization };
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
    .join(",")}}`;
}

function asA23GoDecision(value: unknown): A23GoDecision {
  assertCompleteA23GoDecision(value);
  return value;
}
