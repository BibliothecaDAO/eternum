import {
  hashKatanaLaunchAttestationBindingV1,
  matchesKatanaTeeAttestationMeasurement,
  type KatanaTeeReleaseProjection,
} from "@bibliothecadao/settlement-codec";
import type { GameStack, GameStackAttestationEvidence, GameStackRuntimeIdentity } from "./types";

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;

interface AttestationBoundGameStack extends GameStack {
  l3ChainId: string;
  katana: GameStackRuntimeIdentity & {
    chainId: string;
    genesisHash: string;
  };
  katanaTeeRelease: KatanaTeeReleaseProjection;
}

export function buildGameStackAttestationReportDataHash(gameStack: GameStack): string {
  assertAttestationBindingInputs(gameStack);
  return hashKatanaLaunchAttestationBindingV1({
    gameStackId: gameStack.gameStackId,
    deploymentId: gameStack.deploymentId,
    runtimeInstanceId: gameStack.katana.runtimeInstanceId,
    l3ChainId: gameStack.l3ChainId,
    genesisHash: gameStack.katana.genesisHash,
    rulesetId: gameStack.rulesetId,
    releaseBundleHash: gameStack.releaseBundleHash,
    releaseIdentitySha256: gameStack.katanaTeeRelease.releaseIdentitySha256,
    vmAssetDigest: gameStack.katanaTeeRelease.vmAssetDigest,
  });
}

export function assertGameStackAttestationEvidence(
  gameStack: GameStack,
  evidence: GameStackAttestationEvidence,
  verifiedAt: Date,
): void {
  assertGameStackAttestationBinding(gameStack, evidence);
  assertAttestationVerificationOrdering(gameStack, evidence.verifiedAt, verifiedAt);
}

export function hasGameStackAttestationBinding(gameStack: GameStack): boolean {
  if (!gameStack.attestationEvidence) return false;
  try {
    assertGameStackAttestationBinding(gameStack, gameStack.attestationEvidence);
    return true;
  } catch {
    return false;
  }
}

function assertGameStackAttestationBinding(gameStack: GameStack, evidence: GameStackAttestationEvidence): void {
  if (evidence.schemaVersion !== 1) {
    throw new Error("Katana attestation evidence requires schemaVersion=1");
  }
  if (!matchesKatanaTeeAttestationMeasurement(evidence.attestationMeasurement)) {
    throw new Error("Katana attestation does not match the game-stack release identity");
  }
  if (!SHA256_PATTERN.test(evidence.attestationDocumentSha256)) {
    throw new Error("Katana attestation evidence requires attestationDocumentSha256");
  }
  if (evidence.reportDataHash !== buildGameStackAttestationReportDataHash(gameStack)) {
    throw new Error("Katana attestation report data does not bind the sealed game-stack identity");
  }
}

function assertAttestationBindingInputs(gameStack: GameStack): asserts gameStack is AttestationBoundGameStack {
  for (const [label, value] of [
    ["Game-stack L3 chain ID", gameStack.l3ChainId],
    ["Katana runtime instance ID", gameStack.katana?.runtimeInstanceId],
    ["Katana chain ID", gameStack.katana?.chainId],
    ["Katana genesis hash", gameStack.katana?.genesisHash],
  ]) {
    if (!value?.trim()) throw new Error(`${label} is required before attestation verification`);
  }
  if (gameStack.l3ChainId !== gameStack.katana.chainId) {
    throw new Error("Game-stack L3 chain ID must match the sealed Katana chain ID");
  }
  if (gameStack.katana.imageDigest !== gameStack.katanaTeeRelease.vmAssetDigest) {
    throw new Error("Katana runtime image must match the game-stack release VM artifact");
  }
}

function assertAttestationVerificationOrdering(
  gameStack: GameStack,
  evidenceVerifiedAt: string,
  verifiedAt: Date,
): void {
  const identitySealedAtMs = Date.parse(gameStack.readiness?.identitySealedAt || "");
  const evidenceVerifiedAtMs = Date.parse(evidenceVerifiedAt);
  const verifiedAtMs = verifiedAt.getTime();
  if (
    !Number.isFinite(identitySealedAtMs) ||
    !Number.isFinite(evidenceVerifiedAtMs) ||
    evidenceVerifiedAtMs < identitySealedAtMs ||
    evidenceVerifiedAtMs > verifiedAtMs
  ) {
    throw new Error("Katana attestation verification time is invalid, future-dated, or predates identity sealing");
  }
}
