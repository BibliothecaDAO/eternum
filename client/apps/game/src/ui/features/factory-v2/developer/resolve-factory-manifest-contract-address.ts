import {
  getFactorySqlBaseUrl,
  listFactoryWorlds,
  patchManifestWithFactory,
  resolveWorldContracts,
  resolveWorldDeploymentFromFactory,
} from "@/runtime/world";
import { DEFAULT_FACTORY_NAMESPACE } from "@/ui/features/factory/shared/factory-metadata";
import type { FactoryIndexedWorld } from "@/runtime/world";
import { getFactoryLookupManifest } from "./factory-manifest";
import type {
  FactoryManifestContractLookupFailure,
  FactoryManifestContractLookupRequest,
  FactoryManifestContractLookupResult,
} from "./types";

type ManifestContractEntry = {
  tag?: string;
  address?: string;
};

type ManifestLike = {
  contracts?: ManifestContractEntry[];
};

type NormalizedLookupRequest = {
  worldName: string;
  manifestTag: string;
};

const MAX_WORLD_SUGGESTIONS = 5;
const MAX_CONTRACT_SUGGESTIONS = 5;

const normalizeLookupValue = (value: string) => value.trim().toLowerCase();

const stripWrappingBraces = (value: string) => {
  if (value.startsWith("{") && value.endsWith("}")) {
    return value.slice(1, -1);
  }

  return value;
};

function normalizeFactoryManifestContractName(value: string): string {
  const normalizedValue = normalizeLookupValue(stripWrappingBraces(value));
  if (!normalizedValue) {
    return "";
  }

  return normalizedValue.includes("-") ? normalizedValue : `${DEFAULT_FACTORY_NAMESPACE}-${normalizedValue}`;
}

function normalizeLookupRequest(request: FactoryManifestContractLookupRequest): NormalizedLookupRequest | null {
  const worldName = request.worldName.trim();
  const manifestTag = normalizeFactoryManifestContractName(request.manifestContractName);

  if (!worldName || !manifestTag) {
    return null;
  }

  return {
    worldName,
    manifestTag,
  };
}

function listManifestContractTags(manifest: ManifestLike): string[] {
  return Array.isArray(manifest.contracts)
    ? manifest.contracts
        .flatMap((contract) => (typeof contract?.tag === "string" ? [contract.tag] : []))
        .filter((tag, index, tags) => tags.indexOf(tag) === index)
    : [];
}

function findManifestContractEntry(manifest: ManifestLike, manifestTag: string): ManifestContractEntry | null {
  const contract = manifest.contracts?.find((entry) => entry?.tag === manifestTag);
  return contract ?? null;
}

function resolveExactWorldName(availableWorldNames: string[], requestedWorldName: string): string | null {
  const normalizedRequestedWorldName = normalizeLookupValue(requestedWorldName);
  return (
    availableWorldNames.find((worldName) => normalizeLookupValue(worldName) === normalizedRequestedWorldName) ?? null
  );
}

function listFactoryWorldNames(availableWorlds: FactoryIndexedWorld[]): string[] {
  return availableWorlds.map((world) => world.name);
}

function findExactFactoryWorld(
  availableWorlds: FactoryIndexedWorld[],
  requestedWorldName: string,
): FactoryIndexedWorld | null {
  const exactWorldName = resolveExactWorldName(listFactoryWorldNames(availableWorlds), requestedWorldName);
  if (!exactWorldName) {
    return null;
  }

  return availableWorlds.find((world) => world.name === exactWorldName) ?? null;
}

function buildSuggestionScore(candidate: string, query: string): number {
  const normalizedCandidate = normalizeLookupValue(candidate);
  const normalizedQuery = normalizeLookupValue(query);
  if (!normalizedCandidate || !normalizedQuery) {
    return 0;
  }

  if (normalizedCandidate === normalizedQuery) {
    return 1_000;
  }

  let score = 0;
  if (normalizedCandidate.startsWith(normalizedQuery)) score += 120;
  if (normalizedCandidate.includes(normalizedQuery)) score += 80;

  for (const token of normalizedQuery.split(/[-_\s]+/).filter(Boolean)) {
    if (normalizedCandidate.startsWith(token)) score += 24;
    if (normalizedCandidate.includes(token)) score += 12;
  }

  return score;
}

function buildWorldSuggestions(availableWorldNames: string[], requestedWorldName: string): string[] {
  return availableWorldNames
    .map((worldName) => ({
      worldName,
      score: buildSuggestionScore(worldName, requestedWorldName),
    }))
    .filter((suggestion) => suggestion.score > 0)
    .sort((left, right) => right.score - left.score || left.worldName.localeCompare(right.worldName))
    .slice(0, MAX_WORLD_SUGGESTIONS)
    .map((suggestion) => suggestion.worldName);
}

function buildContractSuggestions(manifest: ManifestLike, manifestTag: string): string[] {
  const normalizedManifestTag = normalizeLookupValue(manifestTag);
  const bareContractName = normalizedManifestTag.includes("-")
    ? normalizedManifestTag.slice(normalizedManifestTag.indexOf("-") + 1)
    : normalizedManifestTag;

  return listManifestContractTags(manifest)
    .map((tag) => ({
      tag,
      score: Math.max(buildSuggestionScore(tag, normalizedManifestTag), buildSuggestionScore(tag, bareContractName)),
    }))
    .filter((suggestion) => suggestion.score > 0)
    .sort((left, right) => right.score - left.score || left.tag.localeCompare(right.tag))
    .slice(0, MAX_CONTRACT_SUGGESTIONS)
    .map((suggestion) => suggestion.tag);
}

function buildWorldNotFoundFailure(
  worldName: string,
  worldSuggestions: string[],
): FactoryManifestContractLookupFailure {
  return {
    kind: "failure",
    code: "world_not_found",
    message: `No Factory world named "${worldName.trim()}" was found on the selected chain.`,
    worldSuggestions,
  };
}

function buildContractNotFoundFailure(
  manifestContractName: string,
  contractSuggestions: string[],
): FactoryManifestContractLookupFailure {
  return {
    kind: "failure",
    code: "contract_not_found",
    message: `No manifest contract matched "${manifestContractName.trim()}".`,
    contractSuggestions,
  };
}

function buildFactoryUnavailableFailure(message: string): FactoryManifestContractLookupFailure {
  return {
    kind: "failure",
    code: "factory_unavailable",
    message,
  };
}

function resolveWorldAddress(worldAddress: string | null | undefined): string {
  const normalizedWorldAddress = worldAddress?.trim();
  return normalizedWorldAddress && normalizedWorldAddress.length > 0 ? normalizedWorldAddress : "0x0";
}

function resolveRequestedFactoryWorld(
  availableWorlds: FactoryIndexedWorld[],
  requestedWorldName: string,
): FactoryIndexedWorld | FactoryManifestContractLookupFailure {
  const requestedWorld = findExactFactoryWorld(availableWorlds, requestedWorldName);
  if (requestedWorld) {
    return requestedWorld;
  }

  return buildWorldNotFoundFailure(
    requestedWorldName,
    buildWorldSuggestions(listFactoryWorldNames(availableWorlds), requestedWorldName),
  );
}

function isLookupFailure(
  result: FactoryIndexedWorld | FactoryManifestContractLookupFailure,
): result is FactoryManifestContractLookupFailure {
  return "kind" in result && result.kind === "failure";
}

function resolveLookupWorldAddress(
  requestedWorld: FactoryIndexedWorld,
  deployment: { worldAddress?: string | null } | null | undefined,
): string {
  return resolveWorldAddress(deployment?.worldAddress ?? requestedWorld.worldAddress);
}

function buildPatchedFactoryLookupManifest(
  chain: FactoryManifestContractLookupRequest["chain"],
  worldAddress: string,
  contractsBySelector: Record<string, string>,
): ManifestLike {
  return patchManifestWithFactory(
    getFactoryLookupManifest(chain) as ManifestLike,
    worldAddress,
    contractsBySelector,
  ) as ManifestLike;
}

export async function resolveFactoryManifestContractAddress(
  request: FactoryManifestContractLookupRequest,
): Promise<FactoryManifestContractLookupResult> {
  const normalizedRequest = normalizeLookupRequest(request);
  if (!normalizedRequest) {
    return buildFactoryUnavailableFailure("Enter both a game name and a contract name.");
  }

  const factorySqlBaseUrl = getFactorySqlBaseUrl(request.chain);
  if (!factorySqlBaseUrl) {
    return buildFactoryUnavailableFailure(`Factory indexer is not configured for chain "${request.chain}".`);
  }

  try {
    const availableWorlds = await listFactoryWorlds(request.chain);
    const requestedWorld = resolveRequestedFactoryWorld(availableWorlds, normalizedRequest.worldName);
    if (isLookupFailure(requestedWorld)) {
      return requestedWorld;
    }

    const [contractsBySelector, deployment] = await Promise.all([
      resolveWorldContracts(factorySqlBaseUrl, requestedWorld.name),
      resolveWorldDeploymentFromFactory(factorySqlBaseUrl, requestedWorld.name),
    ]);

    const worldAddress = resolveLookupWorldAddress(requestedWorld, deployment);
    const patchedManifest = buildPatchedFactoryLookupManifest(request.chain, worldAddress, contractsBySelector);
    const manifestContract = findManifestContractEntry(patchedManifest, normalizedRequest.manifestTag);

    if (!manifestContract?.address) {
      return buildContractNotFoundFailure(
        normalizedRequest.manifestTag,
        buildContractSuggestions(patchedManifest, normalizedRequest.manifestTag),
      );
    }

    return {
      kind: "success",
      worldName: requestedWorld.name,
      resolvedTag: normalizedRequest.manifestTag,
      worldAddress,
      contractAddress: manifestContract.address,
    };
  } catch (error) {
    return buildFactoryUnavailableFailure(error instanceof Error ? error.message : "Factory lookup failed.");
  }
}
