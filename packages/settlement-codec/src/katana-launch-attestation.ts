import { hash } from "starknet";

export interface KatanaLaunchAttestationBindingV1 {
  gameStackId: string;
  deploymentId: string;
  runtimeInstanceId: string;
  l3ChainId: string;
  genesisHash: string;
  rulesetId: string;
  releaseBundleHash: string;
  releaseIdentitySha256: string;
  vmAssetDigest: string;
}

const BINDING_FIELDS = [
  "gameStackId",
  "deploymentId",
  "runtimeInstanceId",
  "l3ChainId",
  "genesisHash",
  "rulesetId",
  "releaseBundleHash",
  "releaseIdentitySha256",
  "vmAssetDigest",
] as const satisfies readonly (keyof KatanaLaunchAttestationBindingV1)[];

const STARKNET_FIELD_PRIME = BigInt("0x0800000000000011000000000000000000000000000000000000000000000001");
const IDENTIFIER_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const SHA256_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;
const CANONICAL_FELT_PATTERN = /^0x(?:0|[1-9a-f][0-9a-f]*)$/;

export function hashKatanaLaunchAttestationBindingV1(binding: KatanaLaunchAttestationBindingV1): string {
  assertKatanaLaunchAttestationBindingV1(binding);
  const value = hash.computePoseidonHashOnElements(
    [
      hash.getSelectorFromName("KATANA_LAUNCH_ATTESTATION_BINDING_V1"),
      ...BINDING_FIELDS.map((field) => hash.getSelectorFromName(binding[field])),
    ].map(String),
  );
  return `0x${BigInt(value).toString(16).padStart(64, "0")}`;
}

export function assertKatanaLaunchAttestationBindingV1(binding: KatanaLaunchAttestationBindingV1): void {
  const actualFields = new Set(Object.keys(binding));
  if (actualFields.size !== BINDING_FIELDS.length || BINDING_FIELDS.some((field) => !actualFields.has(field))) {
    throw new Error("Katana launch attestation binding fields are not canonical");
  }
  assertPattern(binding.gameStackId, IDENTIFIER_PATTERN, "gameStackId");
  assertCanonicalFelt(binding.deploymentId, "deploymentId");
  assertPattern(binding.runtimeInstanceId, UUID_PATTERN, "runtimeInstanceId");
  assertCanonicalFelt(binding.l3ChainId, "l3ChainId");
  assertCanonicalFelt(binding.genesisHash, "genesisHash");
  assertCanonicalFelt(binding.rulesetId, "rulesetId");
  assertCanonicalFelt(binding.releaseBundleHash, "releaseBundleHash");
  assertPattern(binding.releaseIdentitySha256, SHA256_PATTERN, "releaseIdentitySha256");
  assertPattern(binding.vmAssetDigest, SHA256_DIGEST_PATTERN, "vmAssetDigest");
}

function assertCanonicalFelt(value: string, field: string): void {
  assertPattern(value, CANONICAL_FELT_PATTERN, field);
  if (BigInt(value) >= STARKNET_FIELD_PRIME) {
    throw new Error(`Katana launch attestation binding requires canonical ${field}`);
  }
}

function assertPattern(value: string, pattern: RegExp, field: string): void {
  if (typeof value !== "string" || !pattern.test(value)) {
    throw new Error(`Katana launch attestation binding requires canonical ${field}`);
  }
}
