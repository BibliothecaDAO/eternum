import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { configManager, LeaderboardManager } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";

import { topOwnerAddresses } from "./worldmap-content-ladder";

/** How many players' things the mid band plates, the best ranked first. */
const TOP_OWNER_COUNT = 10;

/** Something that says when it may have changed, and stops saying so when asked. */
export interface ChangeSource {
  subscribe(listener: () => void): () => void;
}

/** The mid band's top ten now: the leaderboard's ranking, every structure owner in it (no points is 0). */
export const rankTopOwners = (store: NativeFactStore): ReadonlySet<string> =>
  topOwnerAddresses(
    LeaderboardManager.instance(store).playersByRank,
    [...store.inGame("Structure", configManager.getActiveGameId())].map((row) => row.owner),
    TOP_OWNER_COUNT,
  );

/** The chain clock `getBlockTimestamp` reads (chain-time-binding.ts): each tick, and each new anchor. */
const CHAIN_CLOCK: ChangeSource = {
  subscribe: (listener) =>
    useChainTimeStore.subscribe((next, previous) => {
      if (next.nowMs !== previous.nowMs || next.anchorTimestampMs !== previous.anchorTimestampMs) listener();
    }),
};

/**
 * Keeps the mid band's top ten current (worldmap-content-ladder.ts) from everything its ranking reads: the store's
 * every write and snapshot change (its readiness, the time it was taken at), and the chain clock, on which a
 * hyperstructure's shares earn points with no fact changing. `onChange` is told only when the ranking's members differ
 * from those the plates were last given (`shown`), so an unchanged top ten rebuilds no plate. Returns the stop.
 */
export const followTopOwners = (
  store: NativeFactStore,
  {
    shown,
    onChange,
    clock = CHAIN_CLOCK,
  }: { shown: () => ReadonlySet<string>; onChange: () => void; clock?: ChangeSource },
): (() => void) => {
  const check = () => {
    if (!sameMembers(rankTopOwners(store), shown())) onChange();
  };
  const stops = [store.subscribe(check), clock.subscribe(check)];
  return () => stops.forEach((stop) => stop());
};

const sameMembers = (a: ReadonlySet<string>, b: ReadonlySet<string>) =>
  a.size === b.size && [...a].every((key) => b.has(key));
