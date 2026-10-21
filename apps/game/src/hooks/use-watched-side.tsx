import { configManager } from "@bibliothecadao/eternum";
import { fetchHeraldGameHistory, requireShard } from "@bibliothecadao/eternum/game-client";
import type { HeraldHistoryEvent } from "@bibliothecadao/eternum/game-sync";
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
 * An open game's seat order: its players in the order each first had a realm created in it (its `RealmCreatedStory`
 * events, by their place on the chain). A newcomer takes the next seat and no seat moves, a later realm or a captured one
 * changes nothing, and every viewer, whenever they arrive, reads the same order from the same events.
 */
export const openGameSeatsOf = (stories: readonly HeraldHistoryEvent[]): bigint[] => {
  const ordered = stories.toSorted(
    (a, b) =>
      a.block_number - b.block_number || a.transaction_index - b.transaction_index || a.event_index - b.event_index,
  );
  const seats = new Set<bigint>();
  for (const story of ordered) {
    const owner = ContractAddress(String(story.value.owner));
    if (owner !== 0n) seats.add(owner);
  }
  return [...seats];
};

/** Herald's page, at most. */
const HISTORY_PAGE = 500;
const OPEN_SEATS_REFRESH_MS = 30_000;

/** Every realm created in a game, page by page from Herald's history: each a `RealmCreatedStory` event. */
const fetchRealmsCreated = async (chainId: string, game: number): Promise<HeraldHistoryEvent[]> => {
  const shard = requireShard(chainId);
  const stories: HeraldHistoryEvent[] = [];
  for (let offset = 0; ; offset += HISTORY_PAGE) {
    const page = await fetchHeraldGameHistory(shard, game, {
      model: "StoryEvent",
      story: "RealmCreatedStory",
      limit: HISTORY_PAGE,
      offset,
    });
    stories.push(...page.items);
    if (page.items.length === 0 || offset + HISTORY_PAGE >= page.total) return stories;
  }
};

/**
 * Keeps an open game's seats while the viewer watches it (`setOpenGameSeats`), for that game alone: its shard's chain id
 * and its id. A Blitz or Duel game seats by its roster, on the chain. Mounted once, beside whichever HUD draws.
 */
export const useOpenGameSeats = (): void => {
  const watching = useIsWatching();
  const game = configManager.getActiveGameId();
  const roster = useNativeRow("BlitzRoster", { game_id: game });
  const chainId = getActiveGame()?.chainId;
  const stories = useQuery({
    queryKey: ["openGameSeats", chainId, game],
    queryFn: () => fetchRealmsCreated(chainId!, game),
    enabled: watching && !roster && chainId !== undefined,
    refetchInterval: OPEN_SEATS_REFRESH_MS,
  });
  useEffect(() => {
    if (stories.data && chainId !== undefined)
      setOpenGameSeats({ chainId, gameId: game }, openGameSeatsOf(stories.data));
  }, [stories.data, chainId, game]);
};
