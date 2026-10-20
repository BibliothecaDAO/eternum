import { useNativeRow } from "@/hooks/helpers/use-native-facts";
import { fetchDirectory } from "@/runtime/world/directory";
import { getActiveGame } from "@/runtime/world";
import { environmentLedger, type RankedWallet, type SlotKey } from "@/shell/value/ledger";
import { configManager } from "@bibliothecadao/eternum";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { normalizeLeaderboardAddress } from "./finalized-blitz-leaderboard";

interface RosterSeat {
  account: bigint;
  wallet: bigint;
}

/**
 * Each player's MMR change if the game ended now, by account: off for a game without a rated slot (a free or unrated
 * game shows no column), waiting until the ledger answers, unavailable when it could not.
 */
export type MmrForecast =
  | { status: "off" }
  | { status: "waiting" }
  | { status: "unavailable" }
  | { status: "ready"; deltaByAccount: ReadonlyMap<string, number> };

/**
 * The game's roster as the ledger ranks a result, if it ended now: every seat by its points (none counts as zero), in
 * competition ranks (1, 1, 3), equal points ordered by wallet number.
 */
export const rankRosterNow = (roster: readonly RosterSeat[], pointsOf: (account: bigint) => number): RankedWallet[] => {
  const ordered = roster
    .map((seat) => ({ ...seat, points: pointsOf(seat.account) }))
    .toSorted((left, right) => right.points - left.points || compareWallets(left.wallet, right.wallet));
  return ordered.map((seat) => ({
    wallet: `0x${seat.wallet.toString(16)}`,
    rank: ordered.findIndex((other) => other.points === seat.points) + 1,
  }));
};

const compareWallets = (left: bigint, right: bigint): number => (left < right ? -1 : left > right ? 1 : 0);

/**
 * The forecast, from the ledger's preview_mmr, the calculation settlement applies: asked again only when the ranking
 * changes, never on a timer. The slot comes from our directory's listing of the live game.
 */
export const useMmrForecast = (pointsByAccount: ReadonlyMap<string, { points: number }>): MmrForecast => {
  const game = getActiveGame();
  const ledger = useMemo(() => environmentLedger(), []);
  const roster = useNativeRow("BlitzRoster", { game_id: configManager.getActiveGameId() });

  const slot = useQuery({
    queryKey: ["leaderboard", "slot", game?.chainId, game?.gameId],
    queryFn: () => findSlot(game!.chainId, game!.gameId),
    enabled: game !== null && ledger !== null,
    staleTime: Infinity,
    retry: 1,
  });
  const key = slot.data ?? null;
  const rated = useQuery({
    queryKey: ["ledger", "rated", key?.shard, key?.slotId],
    queryFn: () => ledger!.rated(key!),
    enabled: key !== null,
    staleTime: Infinity,
    retry: 1,
  });

  const ranked = useMemo(
    () =>
      rankRosterNow(
        roster?.players ?? [],
        (account) => pointsByAccount.get(normalizeLeaderboardAddress(account))?.points ?? 0,
      ),
    [roster, pointsByAccount],
  );
  const preview = useQuery({
    queryKey: ["ledger", "mmr-preview", key?.shard, key?.slotId, ranked.map(({ wallet, rank }) => `${wallet}:${rank}`)],
    queryFn: () => ledger!.previewMmr(key!, ranked),
    enabled: rated.data === true && ranked.length > 0,
    staleTime: Infinity,
    retry: false,
  });

  return useMemo((): MmrForecast => {
    if (game === null || ledger === null) return { status: "off" };
    if (slot.isError || rated.isError || preview.isError) return { status: "unavailable" };
    if (slot.isPending || (key !== null && rated.isPending)) return { status: "waiting" };
    if (key === null || rated.data !== true || ranked.length === 0) return { status: "off" };
    // Only this ranking's answer is a forecast: while the ledger is asked again, the last ranking's deltas are not shown.
    if (!preview.data) return { status: "waiting" };
    const accountOf = new Map((roster?.players ?? []).map((seat) => [seat.wallet, seat.account]));
    const deltaByAccount = new Map<string, number>();
    for (const { wallet, delta } of preview.data) {
      const account = accountOf.get(BigInt(wallet));
      if (account !== undefined) deltaByAccount.set(normalizeLeaderboardAddress(account), delta);
    }
    return { status: "ready", deltaByAccount };
  }, [
    game,
    ledger,
    slot.isError,
    slot.isPending,
    rated.isError,
    rated.isPending,
    rated.data,
    preview.isError,
    preview.data,
    key,
    ranked,
    roster,
  ]);
};

/**
 * A live game's slot on the ledger, from our directory; null only for a game it lists outside any slot (a free game).
 * A shard or game it could not read, or a game it does not list, is unknown, not free: the read fails, so the forecast
 * says unavailable and a later opening asks again.
 */
const findSlot = async (chainId: string, gameId: number): Promise<SlotKey | null> => {
  const shard = (await fetchDirectory()).find((listed) => BigInt(listed.chainId) === BigInt(chainId));
  const entry = shard?.games?.find((game) => game.game_id === gameId);
  if (!shard || !entry || entry.error || entry.slotId === undefined) throw new Error("game_slot_unavailable");
  return entry.slotId === null ? null : { shard: shard.chainId, slotId: entry.slotId };
};
