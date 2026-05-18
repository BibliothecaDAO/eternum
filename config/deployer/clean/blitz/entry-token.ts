import { getContractByName, NAMESPACE } from "@bibliothecadao/provider";
import type { Config as EternumConfig } from "@bibliothecadao/types";
import { constants, hash } from "starknet";
import type { GameManifestLike } from "../shared/manifest-types";

interface BlitzEntryTokenDeploymentInput {
  blitzRealmSystemsAddress: string;
  configSystemsAddress: string;
}

function resolveBlitzEntryTokenDeploymentInput(manifest: GameManifestLike): BlitzEntryTokenDeploymentInput {
  return {
    blitzRealmSystemsAddress: getContractByName(manifest as any, `${NAMESPACE}-blitz_realm_systems`),
    configSystemsAddress: getContractByName(manifest as any, `${NAMESPACE}-config_systems`),
  };
}

function hasPositiveFeeAmount(feeAmount: unknown): boolean {
  if (feeAmount == null) {
    return false;
  }

  try {
    return BigInt(feeAmount as bigint | number | string) > 0n;
  } catch {
    return false;
  }
}

export function shouldDeployBlitzEntryToken(config: EternumConfig): boolean {
  return Boolean(config.blitz?.mode?.on) && hasPositiveFeeAmount(config.blitz?.registration?.fee_amount);
}

export function buildBlitzEntryTokenDeployCalldata(manifest: GameManifestLike): string[] {
  const { blitzRealmSystemsAddress, configSystemsAddress } = resolveBlitzEntryTokenDeploymentInput(manifest);

  // This mirrors the collectible deployment payload wired into blitz registration.
  return [
    "0x0",
    "0x5265616c6d733a204c6f6f74204368657374",
    "0x12",
    "0x0",
    "0x524c43",
    "0x3",
    "0x0",
    "0x0",
    "0x0",
    "0x0",
    "0x4c6f6f7420436865737420666f72205265616c6d73",
    "0x15",
    "0x992acf50dba66f87d8cafffbbc3cdbbec5f8f514b5014f6d4d75e6b8789153",
    blitzRealmSystemsAddress,
    "0x992acf50dba66f87d8cafffbbc3cdbbec5f8f514b5014f6d4d75e6b8789153",
    configSystemsAddress,
    configSystemsAddress,
    "0x992acf50dba66f87d8cafffbbc3cdbbec5f8f514b5014f6d4d75e6b8789153",
    "0x1f4",
  ];
}

export function resolveBlitzEntryTokenAddress(options: {
  manifest: GameManifestLike;
  entryTokenClassHash: string;
  blitzRegistrationTransactionHash: string;
}): string {
  const { configSystemsAddress } = resolveBlitzEntryTokenDeploymentInput(options.manifest);
  const deploymentSalt = hash.computePedersenHash(configSystemsAddress, options.blitzRegistrationTransactionHash);

  return hash.calculateContractAddressFromHash(
    deploymentSalt,
    options.entryTokenClassHash,
    buildBlitzEntryTokenDeployCalldata(options.manifest),
    constants.LegacyUDC.ADDRESS,
  );
}
