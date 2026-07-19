import type { DeploymentEnvironmentId } from "../types";

export const CARTRIDGE_VRF_RELEASE = Object.freeze({
  name: "cartridge-vrf",
  release: "v0.3.1",
  sourceRepository: "https://github.com/cartridge-gg/vrf",
  sourceRevision: "6d1c0f60a53558f19618b2bff81c3da0849db270",
  providerClassHash: "0x00be3edf412dd5982aa102524c0b8a0bcee584c5a627ed1db6a7c36922047257",
  providerAddress: "0x051fea4450da9d6aee758bdeba88b2f665bcbf549d2c61421aa724e9ac0ced8f",
  networks: ["mainnet", "sepolia"] as const,
  fulfillmentMode: "asynchronous-submit-then-consume" as const,
  gameplayMutationOrder: "consume-before-mutate" as const,
  fallbackPolicy: "fail-closed" as const,
});

const PUBLIC_BLITZ_ENVIRONMENTS = new Set<DeploymentEnvironmentId>(["mainnet.blitz"]);

export function resolveLaunchVrfProvider(environmentId: DeploymentEnvironmentId, requestedAddress?: string): string {
  if (!PUBLIC_BLITZ_ENVIRONMENTS.has(environmentId)) {
    return isZeroAddress(requestedAddress) ? CARTRIDGE_VRF_RELEASE.providerAddress : requestedAddress!;
  }

  if (isZeroAddress(requestedAddress)) {
    return CARTRIDGE_VRF_RELEASE.providerAddress;
  }
  if (normalizeAddress(requestedAddress!) !== normalizeAddress(CARTRIDGE_VRF_RELEASE.providerAddress)) {
    throw new Error(
      `${environmentId} requires Cartridge VRF ${CARTRIDGE_VRF_RELEASE.release} at ${CARTRIDGE_VRF_RELEASE.providerAddress}`,
    );
  }
  return CARTRIDGE_VRF_RELEASE.providerAddress;
}

function isZeroAddress(value?: string): boolean {
  if (!value) {
    return true;
  }
  try {
    return BigInt(value) === 0n;
  } catch {
    throw new Error(`Invalid VRF provider address: ${value}`);
  }
}

function normalizeAddress(value: string): string {
  return `0x${BigInt(value).toString(16)}`;
}
