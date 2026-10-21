import { configManager } from "@bibliothecadao/eternum";
import { fetchHeraldLeaderboard, requireShard } from "@bibliothecadao/eternum/game-client";
import type { HeraldFrontierLeaderboardEntry, HeraldLeaderboardEntry } from "@bibliothecadao/eternum/game-sync";
import { ContractAddress } from "@bibliothecadao/types";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useSyncExternalStore } from "react";

import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision, useNativeRow } from "@/hooks/helpers/use-native-facts";
import { getActiveGame } from "@/runtime/world";
import type { SeatSide } from "@/tokens";
import { SeatMark } from "@/ui/design-system/seat-mark";
import { useIsWatching } from "@/utils/can-issue-orders";
import { readSeatsRevision, setOpenGameSeats, subscribeSeats, watchedSide } from "@/utils/entity-ownership";

/** The seat's facts: a Blitz game's roster (an open game's seats are Herald's, `useOpenGameSeats`). */
const SEAT_FACTS = ["BlitzRoster"] as const;

/** `watchedSide` for a rendered surface: a player's seat while the viewer watches, null while they play. */
const useWatchedSide = (owner: bigint | string | null | undefined): SeatSide | null => {
  const {
    setup: { store },
  } = useGame();
  useNativeRevision(SEAT_FACTS);
  useSyncExternalStore(subscribeSeats, readSeatsRevision, readSeatsRevision);
  const watching = useIsWatching();
  return watching ? watchedSide(store, owner) : null;
};

/** A player's seat mark beside their name on a list (the standings), while the viewer watches; nothing while they play. */
export const PlayerSeatMark = ({ account, name }: { account: bigint | string; name: string }) => (
  <SeatMark side={useWatchedSide(account)} name={name} />
);

/**
 * An open game's seat order from its Herald board, which lists every player (a watching viewer's own facts hold only
 * those in view): a Frontier season's by each player's realm, in the order realms were settled (a Frontier realm never
 * changes hands, so a newcomer takes the next seat and no seat moves); an Eternum game's by address, as Herald's board
 * gives no other order.
 */
export const openGameSeatsOf = (
  board:
    | { mode: "frontier"; entries: HeraldFrontierLeaderboardEntry[] }
    | { mode: "points"; entries: HeraldLeaderboardEntry[] },
): bigint[] => {
  const byAddress = (a: bigint, b: bigint) => (a < b ? -1 : a > b ? 1 : 0);
  if (board.mode === "frontier")
    return board.entries
      .map((entry) => ({ player: ContractAddress(entry.address), realm: BigInt(entry.structure_id) }))
      .toSorted((a, b) => (a.realm === b.realm ? byAddress(a.player, b.player) : a.realm < b.realm ? -1 : 1))
      .map(({ player }) => player);
  return board.entries.map((entry) => ContractAddress(entry.address)).toSorted(byAddress);
};

const OPEN_SEATS_REFRESH_MS = 30_000;

/**
 * Keeps an open game's seats from Herald while the viewer watches it (`setOpenGameSeats`): a Blitz or Duel game seats
 * by its roster, on the chain. Mounted once, beside whichever HUD draws.
 */
export const useOpenGameSeats = (): void => {
  const watching = useIsWatching();
  const game = configManager.getActiveGameId();
  const roster = useNativeRow("BlitzRoster", { game_id: game });
  const chainId = getActiveGame()?.chainId;
  const board = useQuery({
    queryKey: ["openGameSeats", chainId, game],
    queryFn: () => fetchHeraldLeaderboard(requireShard(chainId), game),
    enabled: watching && !roster && chainId !== undefined,
    refetchInterval: OPEN_SEATS_REFRESH_MS,
  });
  useEffect(() => {
    if (board.data) setOpenGameSeats(game, openGameSeatsOf(board.data));
  }, [board.data, game]);
};
