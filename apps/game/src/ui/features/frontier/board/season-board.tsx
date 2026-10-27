import { useGame } from "@/hooks/context/game-context";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { type PlayerNames, usePlayerDisplayName, usePlayerNames } from "@/hooks/use-player-profile";
import { getActiveGame } from "@/runtime/world";
import { startRealmVisit } from "@/sync/active-game-client";
import { PlayerSeatMark } from "@/hooks/use-watched-side";
import { LordName } from "./realm-marks";
import { configManager, dayOf, type ExpeditionRules } from "@bibliothecadao/eternum";
import { fetchHeraldLeaderboard, requireShard, safeInteger } from "@bibliothecadao/eternum/game-client";
import type { HeraldFrontierLeaderboardEntry } from "@bibliothecadao/eternum/game-sync";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";

import { type SeasonDetail, SeasonDetailSheet } from "./season-detail";
import { SeasonList, type SeasonListRow } from "./season-list";
import { type PodiumPlace, SeasonOverCard, type SeasonTotals } from "./season-over-card";
import { type SeasonLords, seasonLordsOf } from "./season-pool";
import { findOwnEntry, ownRank, wholeLords, earnedResource } from "./standings";

type Entry = HeraldFrontierLeaderboardEntry;

const REFRESH_MS = 30_000;
const LIST_LENGTH = 50;

/**
 * Frontier's season board from Herald's read model: sites cleared, then deepest depth, then who reached the count
 * first. Herald ranks; the client only reads, and an unknown board shows as "—".
 */
export const useSeasonBoard = () => {
  const shard = requireShard(getActiveGame()?.chainId);
  const gameId = configManager.getActiveGameId();
  return useQuery({
    queryKey: ["frontierSeasonBoard", shard.url, gameId],
    queryFn: async () => {
      const board = await fetchHeraldLeaderboard(shard, gameId);
      // The Frontier HUD only mounts in a Frontier game, whose board is always the season's.
      if (board.mode !== "frontier") throw new Error(`Game ${gameId} ranks points, not a Frontier season`);
      return board.entries;
    },
    refetchInterval: REFRESH_MS,
  });
};

const useViewer = () => useAccountStore((state) => state.account?.address ?? null);

/** The player's season rank as the Menu's Season row shows it: "—" while unknown, none for a viewer without a realm. */
export const useSeasonRank = (): string => {
  const rank = ownRank(useSeasonBoard().data, useViewer());
  return rank === undefined ? "—" : rank === null ? "" : `#${rank}`;
};

/**
 * Season over the board: a common chest at today's price with the season's pool behind it, the first fifty realms and
 * the player's own, a row's detail with Visit. Visiting closes the page for the visited realm.
 */
export const FrontierSeason = ({
  rules,
  onVisited,
  onClose,
}: {
  rules: ExpeditionRules;
  onVisited: () => void;
  onClose: () => void;
}) => {
  const board = useSeasonBoard();
  const viewer = useViewer();
  const { pool, chest } = useSeasonLords(rules);
  const [opened, setOpened] = useState<string | null>(null);
  const entries = board.data ?? [];
  const own = findOwnEntry(entries, viewer);
  const { rows, pinned } = useSeasonListRows(board.data, LIST_LENGTH);
  const chosen = entries.find((entry) => entry.address === opened);
  const visit = (entry: Entry) => {
    startRealmVisit({ player: entry.address, structureId: safeInteger(entry.structure_id), opensOn: "realm" });
    onVisited();
  };
  // A realm's detail stands in the list's place, never over it; its Back returns to the list.
  if (chosen)
    return (
      <EntryDetail
        entry={chosen}
        onVisit={chosen === own ? undefined : () => visit(chosen)}
        onClose={() => setOpened(null)}
      />
    );
  return (
    <SeasonList
      rank={ownRank(board.data, viewer)}
      chest={chest}
      pool={pool}
      rows={rows}
      pinned={pinned}
      state={board.isError ? "failed" : board.isPending ? "loading" : "ready"}
      onRetry={() => void board.refetch()}
      onOpen={setOpened}
      onClose={onClose}
    />
  );
};

/**
 * The season's LORDS from the game's own facts: the pool published to its budget row with what today releases of it by
 * the season's day schedule, a share's price today (the budget row's) under the ceiling the chest rules set, and a
 * common chest at that price. The pool is null while nothing is published and undefined until the game itself is known.
 */
const useSeasonLords = (rules: ExpeditionRules): Partial<SeasonLords> => {
  const { setup } = useGame();
  useNativeRevision(LORDS_MODELS);
  const now = useNowSeconds();
  const gameId = configManager.getActiveGameId();
  const game = setup.store.get("GameRegistry", { game_id: gameId });
  if (!game) return {};
  const season = { start: Number(game.start_main_at), end: Number(game.end_at) };
  const facts = {
    budget: setup.store.get("LordsBudget", { game_id: gameId }),
    chestRules: setup.store.get("ChestRules", { game_id: gameId }),
  };
  return seasonLordsOf(facts, season, now < season.end ? dayOf(rules, now) : null);
};

const LORDS_MODELS = ["GameRegistry", "LordsBudget", "ChestRules"] as const;

/**
 * The season's first rows as SeasonRow draws them, the player's own lit in place, or pinned under them when it ranks
 * below.
 */
const useSeasonListRows = (
  entries: readonly Entry[] | undefined,
  length: number,
): { rows: SeasonListRow[]; pinned: SeasonListRow | undefined } => {
  const own = findOwnEntry(entries ?? [], useViewer());
  // Each row's label is the one name rule's, read as the rows are built: built again when a name lands.
  const names = usePlayerNames();
  const top = (entries ?? []).slice(0, length);
  return {
    rows: top.map((entry) => listRow(entry, entry === own, names)),
    pinned: own && !top.includes(own) ? listRow(own, true, names) : undefined,
  };
};

/**
 * Each realm's rank and depth as the board's own entry gives them, whether or not the realm is streamed to this
 * viewer (Herald reads both from the realm's Structure row).
 */
const listRow = (entry: Entry, own: boolean, names: PlayerNames): SeasonListRow => ({
  key: entry.address,
  rank: entry.rank,
  order: entry.order,
  realm: { level: entry.level, depth: entry.deepest_depth },
  name: (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
      <PlayerSeatMark account={entry.address} name={names.text(entry.address)} />
      <LordName account={entry.address} you={own} />
    </span>
  ),
  label: names.text(entry.address),
  sitesCleared: entry.sites_cleared.total,
  lords: wholeLords(entry.rewards.lords),
  own,
});

const EntryDetail = ({ entry, onVisit, onClose }: { entry: Entry; onVisit?: () => void; onClose: () => void }) => {
  const label = usePlayerDisplayName(entry.address) ?? entry.address;
  return <SeasonDetailSheet detail={seasonDetail(entry)} label={label} onVisit={onVisit} onClose={onClose} />;
};

const seasonDetail = (entry: Entry): SeasonDetail => ({
  rank: entry.rank,
  order: entry.order,
  sites: {
    total: entry.sites_cleared.total,
    camps: entry.sites_cleared.camps,
    rifts: entry.sites_cleared.rifts,
    ruins: entry.sites_cleared.ruins,
    beasts: entry.sites_cleared.beasts,
  },
  chests: entry.chests_earned,
  lords: wholeLords(entry.rewards.lords),
  depth: entry.deepest_depth,
  essence: earnedResource(entry.rewards.essence),
  labor: earnedResource(entry.rewards.labor),
});

/**
 * The season-over card once the game has ended. The ending is not yet a recorded fact: the mist lifted stands until
 * Herald names it, as on the app's Results.
 */
export const SeasonOver = ({ withdraw, onSeason }: { withdraw?: ReactNode; onSeason: () => void }) => {
  useNowSeconds();
  const navigate = useNavigate();
  const board = useSeasonBoard();
  const viewer = useViewer();
  if (!configManager.isGameOver()) return null;
  const entries = board.data;
  const own = entries && findOwnEntry(entries, viewer);
  return (
    <SeasonOverCard
      ending="lifted"
      place={own?.rank}
      field={entries?.length}
      podium={(entries ?? []).slice(0, 3).map((entry) => podiumPlace(entry, entry === own))}
      totals={own && seasonTotals(own)}
      withdraw={withdraw}
      onSeason={onSeason}
      onExit={() => navigate("/")}
    />
  );
};

const podiumPlace = (entry: Entry, own: boolean): PodiumPlace => ({
  key: entry.address,
  rank: entry.rank,
  name: <LordName account={entry.address} you={own} portrait />,
  sitesCleared: entry.sites_cleared.total,
});

const seasonTotals = (entry: Entry): SeasonTotals => ({
  sitesCleared: entry.sites_cleared.total,
  chests: entry.chests_earned,
  lords: wholeLords(entry.rewards.lords),
  depth: entry.deepest_depth,
  essence: earnedResource(entry.rewards.essence),
  labor: earnedResource(entry.rewards.labor),
});
