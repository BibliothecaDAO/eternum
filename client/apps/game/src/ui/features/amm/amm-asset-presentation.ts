import { findResourceById } from "@bibliothecadao/types";
import localSeasonAddresses from "../../../../../../../contracts/common/addresses/local.json";
import mainnetSeasonAddresses from "../../../../../../../contracts/common/addresses/mainnet.json";
import sepoliaSeasonAddresses from "../../../../../../../contracts/common/addresses/sepolia.json";
import slotSeasonAddresses from "../../../../../../../contracts/common/addresses/slot.json";
import slottestSeasonAddresses from "../../../../../../../contracts/common/addresses/slottest.json";

interface AmmAssetPresentation {
  tokenAddress: string;
  displayName: string;
  shortLabel: string;
  iconResource: string | null;
  isLords: boolean;
}

interface KnownAmmResource {
  address: string;
  displayName: string;
  iconResource: string | null;
}

interface SeasonAddressCatalog {
  resources: Record<string, (string | number)[]>;
}

const KNOWN_AMM_SEASON_ADDRESSES: SeasonAddressCatalog[] = [
  localSeasonAddresses,
  mainnetSeasonAddresses,
  sepoliaSeasonAddresses,
  slotSeasonAddresses,
  slottestSeasonAddresses,
];
const KNOWN_AMM_RESOURCES = buildKnownAmmResources();

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

  const resource = KNOWN_AMM_RESOURCES.get(normalizedTokenAddress);
  if (!resource) {
    return {
      tokenAddress: normalizedTokenAddress,
      displayName: resolveFallbackDisplayName(normalizedTokenAddress),
      shortLabel: resolveFallbackShortLabel(normalizedTokenAddress),
      iconResource: null,
      isLords: false,
    };
  }

  return {
    tokenAddress: normalizedTokenAddress,
    displayName: resource.displayName,
    shortLabel: resolveShortLabel(resource.displayName),
    iconResource: resource.iconResource,
    isLords: false,
  };
}

function buildKnownAmmResources(): Map<string, KnownAmmResource> {
  const resourcesByAddress = new Map<string, KnownAmmResource>();

  for (const seasonAddresses of KNOWN_AMM_SEASON_ADDRESSES) {
    appendSeasonResources(resourcesByAddress, seasonAddresses);
  }

  return resourcesByAddress;
}

function appendSeasonResources(
  resourcesByAddress: Map<string, KnownAmmResource>,
  seasonAddresses: SeasonAddressCatalog,
) {
  for (const resourceEntry of Object.values(seasonAddresses.resources)) {
    appendKnownResource(resourcesByAddress, resourceEntry);
  }
}

function appendKnownResource(resourcesByAddress: Map<string, KnownAmmResource>, resourceEntry: (string | number)[]) {
  const [resourceId, tokenAddress] = resourceEntry;
  const normalizedTokenAddress = normalizeTokenAddress(String(tokenAddress));

  if (resourcesByAddress.has(normalizedTokenAddress)) {
    return;
  }

  const resourceDefinition = findResourceById(Number(resourceId));
  if (!resourceDefinition) {
    return;
  }

  resourcesByAddress.set(normalizedTokenAddress, {
    address: normalizedTokenAddress,
    displayName: resourceDefinition.trait,
    iconResource: resourceDefinition.trait,
  });
}
