import { fetchHeraldGameDirectory, fetchHeraldGameSnapshot, snapshotModelRows } from "@/runtime/world/herald-http";
import { getDefaultWorld } from "@/runtime/world/world-directory";
import { normalizeHex } from "@/runtime/world/normalize";
import type { GameChain as Chain } from "@realms-world/chain";
import { useQuery } from "@tanstack/react-query";
import { shortString } from "starknet";

export interface FactorySeries {
  name: string;
  paddedName: string;
  lastGameNumber: bigint | null;
}

const decodeSeriesName = (value: unknown): string => {
  try {
    return shortString.decodeShortString(BigInt(value as string | number | bigint).toString());
  } catch {
    return "";
  }
};

const fetchSeriesOwned = async (chain: Chain, ownerAddress: string): Promise<FactorySeries[]> => {
  const world = getDefaultWorld();
  if (world.chain !== chain) return [];

  const directory = await fetchHeraldGameDirectory(world);
  const gameId = directory.games.at(-1)?.game_id;
  if (!gameId) return [];

  const snapshot = await fetchHeraldGameSnapshot(world, gameId, ["Series"]);
  return snapshotModelRows(snapshot, "Series").flatMap((row) => {
    if (normalizeHex(String(row.owner)) !== ownerAddress) return [];
    const seriesId = BigInt(row.series_id as string | number | bigint);
    const paddedName = `0x${seriesId.toString(16)}`;
    const name = decodeSeriesName(seriesId);
    const gameCount = BigInt(row.game_count as string | number | bigint);
    return name ? [{ name, paddedName, lastGameNumber: gameCount > 0n ? gameCount : null }] : [];
  });
};

export const useFactorySeries = (chain: Chain, ownerAddress: string | undefined | null) => {
  const normalizedOwner = ownerAddress ? normalizeHex(ownerAddress) : null;

  return useQuery<FactorySeries[], Error>({
    queryKey: ["factorySeries", chain, normalizedOwner],
    queryFn: () => (normalizedOwner ? fetchSeriesOwned(chain, normalizedOwner) : Promise.resolve([])),
    enabled: !!normalizedOwner,
    staleTime: 60_000,
    retry: 1,
  });
};
