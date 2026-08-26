import { resolveWorldIdForGame } from "@/runtime/world/game-registry";
import { getWorldById } from "@/runtime/world/world-directory";
import { getGameManifest } from "@contracts";
import { DEFAULT_FACTORY_NAMESPACE } from "@/ui/features/factory/shared/factory-metadata";
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

const isManifestWorldId = (worldId: string): worldId is "blitz" | "eternum" =>
  worldId === "blitz" || worldId === "eternum";

export async function resolveFactoryManifestContractAddress(
  request: FactoryManifestContractLookupRequest,
): Promise<FactoryManifestContractLookupResult> {
  const normalizedRequest = normalizeLookupRequest(request);
  if (!normalizedRequest) {
    return buildFactoryUnavailableFailure("Enter both a game name and a contract name.");
  }

  try {
    const worldId = await resolveWorldIdForGame(normalizedRequest.worldName);
    const world = getWorldById(worldId);
    if (!world || !isManifestWorldId(world.id)) {
      return buildFactoryUnavailableFailure(
        `Game "${normalizedRequest.worldName}" was not found in any deployed world's registry.`,
      );
    }

    const manifest = getGameManifest(request.chain, world.id) as ManifestLike;
    const manifestContract = findManifestContractEntry(manifest, normalizedRequest.manifestTag);
    if (!manifestContract?.address) {
      return buildContractNotFoundFailure(
        normalizedRequest.manifestTag,
        buildContractSuggestions(manifest, normalizedRequest.manifestTag),
      );
    }

    return {
      kind: "success",
      worldName: normalizedRequest.worldName,
      resolvedTag: normalizedRequest.manifestTag,
      worldAddress: world.worldAddress,
      contractAddress: manifestContract.address,
    };
  } catch (error) {
    return buildFactoryUnavailableFailure(error instanceof Error ? error.message : "World lookup failed.");
  }
}
