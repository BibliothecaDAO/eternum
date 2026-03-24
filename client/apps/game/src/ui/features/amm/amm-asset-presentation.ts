import { STANDALONE_AMM_RESOURCES } from "@bibliothecadao/amm-sdk";
import { findResourceById } from "@bibliothecadao/types";

export interface AmmAssetPresentation {
  tokenAddress: string;
  displayName: string;
  shortLabel: string;
  iconResource: string | null;
  isLords: boolean;
}

function normalizeTokenAddress(tokenAddress: string): string {
  try {
    return `0x${BigInt(tokenAddress).toString(16)}`;
  } catch {
    return tokenAddress.toLowerCase();
  }
}

function resolveShortLabel(displayName: string): string {
  const upperName = displayName.toUpperCase();
  if (upperName.length <= 10) {
    return upperName;
  }

  const [firstWord] = upperName.split(" ");
  if (!firstWord) {
    return upperName.slice(0, 8);
  }

  return firstWord.length <= 10 ? firstWord : firstWord.slice(0, 10);
}

function resolveFallbackDisplayName(tokenAddress: string): string {
  return `${tokenAddress.slice(0, 8)}...`;
}

function resolveFallbackShortLabel(tokenAddress: string): string {
  const prefix = tokenAddress.slice(0, 2).toLowerCase();
  const rest = tokenAddress.slice(2, 8).toUpperCase();
  return `${prefix}${rest}`;
}

export function resolveAmmAssetPresentation(tokenAddress: string, lordsAddress: string): AmmAssetPresentation {
  const normalizedTokenAddress = normalizeTokenAddress(tokenAddress);
  const normalizedLordsAddress = normalizeTokenAddress(lordsAddress);
  const isLords = normalizedTokenAddress === normalizedLordsAddress;

  if (isLords) {
    return {
      tokenAddress: normalizedTokenAddress,
      displayName: "LORDS",
      shortLabel: "LORDS",
      iconResource: "Lords",
      isLords: true,
    };
  }

  const resource = STANDALONE_AMM_RESOURCES.find((candidate) => candidate.address === normalizedTokenAddress);
  if (!resource) {
    return {
      tokenAddress: normalizedTokenAddress,
      displayName: resolveFallbackDisplayName(normalizedTokenAddress),
      shortLabel: resolveFallbackShortLabel(normalizedTokenAddress),
      iconResource: null,
      isLords: false,
    };
  }

  const resourceDefinition = findResourceById(resource.id);
  const iconResource = resourceDefinition?.trait ?? null;

  return {
    tokenAddress: normalizedTokenAddress,
    displayName: resource.name,
    shortLabel: resolveShortLabel(resource.name),
    iconResource,
    isLords: false,
  };
}
