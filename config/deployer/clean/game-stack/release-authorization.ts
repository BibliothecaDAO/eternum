import { createHash, createPublicKey, verify } from "node:crypto";

const A23_AUTHORIZATION_DOMAIN = "ETERNUM_A23_RELEASE_AUTHORIZATION_V1";

export interface A23ReleaseAuthorizationVerification {
  requiredSignatureCount: number;
  trustedSignerPublicKeys: Record<string, string>;
}

interface A23ReleaseSignature {
  signerId: string;
  scheme: "ed25519";
  signatureBase64: string;
}

interface A23ReleaseDecision {
  schemaVersion: number;
  ticket: string;
  decision: string;
  releaseReady: boolean;
  productionStartAuthorized: boolean;
  authorization?: {
    status?: unknown;
    signatures?: unknown;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export function assertProductionReleaseAuthorized(
  value: unknown,
  verification?: A23ReleaseAuthorizationVerification,
): void {
  const decision = asReleaseDecision(value);
  assertGoDecision(decision);
  const policy = requireVerificationPolicy(verification);
  const signatures = readReleaseSignatures(decision.authorization?.signatures);
  assertUniqueSignerIdentities(signatures);
  const message = buildA23ReleaseAuthorizationMessage(decision);
  const validSignerCount = countTrustedValidSigners(signatures, message, policy.trustedSignerPublicKeys);
  if (validSignerCount < policy.requiredSignatureCount) {
    throw new Error("A23 authorization does not satisfy the configured signature quorum");
  }
}

export function buildA23ReleaseAuthorizationMessage(value: unknown): Uint8Array {
  const decision = asReleaseDecision(value);
  const signingPayload = omitAuthorizationSignatures(decision);
  const digest = createHash("sha256").update(canonicalJson(signingPayload)).digest("hex");
  return new TextEncoder().encode(`${A23_AUTHORIZATION_DOMAIN}\n${digest}`);
}

function assertGoDecision(decision: A23ReleaseDecision): void {
  if (decision.decision !== "GO" || decision.releaseReady !== true || decision.productionStartAuthorized !== true) {
    throw new Error("Production launch is blocked by the current A23 Wave 0 release decision");
  }
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
  return verification;
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
  return signatures.filter((signature) => {
    const publicKey = trustedSignerPublicKeys[signature.signerId];
    if (!publicKey) return false;
    try {
      return verify(null, message, createPublicKey(publicKey), Buffer.from(signature.signatureBase64, "base64"));
    } catch {
      return false;
    }
  }).length;
}

function omitAuthorizationSignatures(decision: A23ReleaseDecision): A23ReleaseDecision {
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

function asReleaseDecision(value: unknown): A23ReleaseDecision {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("A23 Wave 0 release decision is unavailable or malformed");
  }
  const decision = value as Partial<A23ReleaseDecision>;
  if (decision.schemaVersion !== 1 || decision.ticket !== "A23") {
    throw new Error("A23 Wave 0 release decision is unavailable or malformed");
  }
  return decision as A23ReleaseDecision;
}
