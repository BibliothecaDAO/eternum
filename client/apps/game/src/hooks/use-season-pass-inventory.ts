import { useCallback, useEffect, useMemo, useState } from "react";
import { RpcProvider } from "starknet";
import type { Chain } from "@contracts";
import { getRpcUrlForChain } from "@/ui/features/admin/constants";

export interface SeasonPassInventoryItem {
  tokenId: bigint;
  realmId: number;
  realmName: string;
  resourceIds: number[];
}

interface UseSeasonPassInventoryProps {
  chain: Chain;
  ownerAddress?: string | null;
  seasonPassAddress?: string | null;
  rpcUrl?: string | null;
  enabled?: boolean;
  refetchIntervalMs?: number;
}

interface UseSeasonPassInventoryReturn {
  seasonPassBalance: bigint;
  seasonPasses: SeasonPassInventoryItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

const parseUint256 = (result: string[] | undefined): bigint => {
  if (!result || result.length < 2) return 0n;
  const low = BigInt(result[0] ?? 0);
  const high = BigInt(result[1] ?? 0);
  return low + (high << 128n);
};

const toLittleEndianBytes = (value: bigint): number[] => {
  const bytes: number[] = [];
  let current = value;
  while (current > 0n) {
    bytes.push(Number(current & 0xffn));
    current >>= 8n;
  }
  return bytes;
};

const decodeName = (nameFelt: bigint, nameLength: number): string => {
  if (nameLength <= 0) return "";
  const expectedHexLen = nameLength * 2;
  const hex = nameFelt.toString(16).padStart(expectedHexLen, "0").slice(-expectedHexLen);
  let decoded = "";

  for (let i = 0; i < nameLength; i++) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (!Number.isFinite(byte) || byte === 0) continue;
    decoded += String.fromCharCode(byte);
  }

  return decoded.trim();
};

const decodeEncodedMetadata = (
  nameAndAttrsRaw: string | undefined,
  tokenId: bigint,
): Pick<SeasonPassInventoryItem, "realmName" | "resourceIds"> => {
  const original = BigInt(nameAndAttrsRaw ?? 0);
  const attrsLength = Number(original & 0xffn);
  const nameLength = Number((original >> 8n) & 0xffn);
  const realmNameAndAttrs = original >> 16n;
  const attrsMask = attrsLength > 0 ? (1n << (8n * BigInt(attrsLength))) - 1n : 0n;
  const attributes = realmNameAndAttrs & attrsMask;
  const attrs = toLittleEndianBytes(attributes);

  // Layout is [region, cities, harbors, rivers, ...resources, wonder, order]
  const resourceStartIndex = 4;
  const resourceEndIndex = Math.max(resourceStartIndex, attrs.length - 2);
  const resourceIds = attrs
    .slice(resourceStartIndex, resourceEndIndex)
    .filter((resourceId) => resourceId >= 1 && resourceId <= 22);
  const nameFelt = attrsLength > 0 ? realmNameAndAttrs >> (8n * BigInt(attrsLength)) : realmNameAndAttrs;
  const decodedName = decodeName(nameFelt, nameLength);

  return {
    realmName: decodedName.length > 0 ? decodedName : `Realm #${tokenId.toString()}`,
    resourceIds,
  };
};

export const useSeasonPassInventory = ({
  chain,
  ownerAddress,
  seasonPassAddress,
  rpcUrl,
  enabled = true,
  refetchIntervalMs = 15_000,
}: UseSeasonPassInventoryProps): UseSeasonPassInventoryReturn => {
  const [seasonPassBalance, setSeasonPassBalance] = useState(0n);
  const [seasonPasses, setSeasonPasses] = useState<SeasonPassInventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const resolvedRpcUrl = useMemo(() => {
    const customRpcUrl = rpcUrl?.trim();
    if (customRpcUrl) return customRpcUrl;
    return getRpcUrlForChain(chain);
  }, [chain, rpcUrl]);

  const provider = useMemo(() => new RpcProvider({ nodeUrl: resolvedRpcUrl }), [resolvedRpcUrl]);

  const refetch = useCallback(() => {
    setRefreshTick((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!enabled || refetchIntervalMs <= 0) return;
    const timer = window.setInterval(() => {
      setRefreshTick((prev) => prev + 1);
    }, refetchIntervalMs);
    return () => {
      window.clearInterval(timer);
    };
  }, [enabled, refetchIntervalMs]);

  useEffect(() => {
    let cancelled = false;

    if (!enabled || !ownerAddress || !seasonPassAddress) {
      setSeasonPassBalance(0n);
      setSeasonPasses([]);
      setIsLoading(false);
      setError(null);
      return () => {
        cancelled = true;
      };
    }

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const balanceResult = await provider.callContract({
          contractAddress: seasonPassAddress,
          entrypoint: "balance_of",
          calldata: [ownerAddress],
        });
        const balance = parseUint256(balanceResult as string[]);
        if (!cancelled) {
          setSeasonPassBalance(balance);
        }

        if (balance === 0n) {
          if (!cancelled) {
            setSeasonPasses([]);
          }
          return;
        }

        const items: SeasonPassInventoryItem[] = [];

        for (let index = 0n; index < balance; index += 1n) {
          const tokenResult = await provider.callContract({
            contractAddress: seasonPassAddress,
            entrypoint: "token_of_owner_by_index",
            calldata: [ownerAddress, index.toString(), "0"],
          });
          const tokenId = parseUint256(tokenResult as string[]);

          let realmName = `Realm #${tokenId.toString()}`;
          let resourceIds: number[] = [];
          try {
            const metadataResult = await provider.callContract({
              contractAddress: seasonPassAddress,
              entrypoint: "get_encoded_metadata",
              calldata: [tokenId.toString()],
            });
            const [nameAndAttrs] = metadataResult ?? [];
            const decoded = decodeEncodedMetadata(nameAndAttrs, tokenId);
            realmName = decoded.realmName;
            resourceIds = decoded.resourceIds;
          } catch {
            // Some season pass contracts cannot decode metadata for every token id.
            // Keep the token discoverable even without metadata.
          }

          const realmId = tokenId <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(tokenId) : 0;

          items.push({
            tokenId,
            realmId,
            realmName,
            resourceIds,
          });
        }

        if (!cancelled) {
          const sorted = items.toSorted((a, b) => {
            if (a.tokenId === b.tokenId) return 0;
            return a.tokenId < b.tokenId ? -1 : 1;
          });
          setSeasonPasses(sorted);
        }
      } catch (loadError) {
        if (!cancelled) {
          setSeasonPasses([]);
          const message = loadError instanceof Error ? loadError.message : "Failed to load season passes.";
          const normalizedMessage = message.toLowerCase();
          if (normalizedMessage.includes("token_of_owner_by_index") || normalizedMessage.includes("entry point")) {
            setError("Season pass detected, but this contract does not expose token enumeration.");
          } else {
            setError(message);
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [enabled, ownerAddress, provider, refreshTick, seasonPassAddress]);

  return {
    seasonPassBalance,
    seasonPasses,
    isLoading,
    error,
    refetch,
  };
};
