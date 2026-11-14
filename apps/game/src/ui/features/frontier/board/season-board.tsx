import { realmSkinOf } from "@/three/structures/realm-skins";
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
import type { HeraldFrontierLeaderboard, HeraldFrontierLeaderboardEntry } from "@bibliothecadao/eternum/game-sync";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { seasonDay } from "../hud/day-clock";
import { type SeasonDetail, SeasonDetailSheet } from "./season-detail";
import { SeasonList, type SeasonListRow, type SeasonPodiumPlace } from "./season-list";
import { type SeasonLords, seasonLordsOf, seasonPodium } from "./season-pool";
import { findOwnEntry, ownRank, wholeLords, earnedResource } from "./standings";
import { FrontierAspectPage, useAspectBoard } from "../aspect/aspect-page";

type Entry = HeraldFrontierLeaderboardEntry;

const REFRESH_MS = 30_000;

/**
 * Frontier's season board from Herald's read model: sites cleared, then deepest depth, then who reached the count
 * first. Herald ranks; the client only reads, and an unknown board shows as "—".
 */
export const useSeasonBoard = (enabled = true) => useFrontierBoard((board) => board.entries, enabled);

/** Herald's Frontier board for the active game, its entries and prizes, read through `select`. */
export const useFrontierBoard = <T,>(select: (board: HeraldFrontierLeaderboard) => T, enabled = true) => {
  const shard = requireShard(getActiveGame()?.chainId);
  const gameId = configManager.getActiveGameId();
  return useQuery({
    enabled,
    queryKey: ["frontierSeasonBoard", shard.url, gameId],
    queryFn: async () => {
      const board = await fetchHeraldLeaderboard(shard, gameId);
      // The Frontier HUD only mounts in a Frontier game, whose board is always the season's.
      if (board.mode !== "frontier") throw new Error(`Game ${gameId} ranks points, not a Frontier season`);
      return board;
    },
    select,
    refetchInterval: REFRESH_MS,
  });
};

/**
 * The season's podium as the Season page draws it: each prize place, its LORDS and who holds it (seasonPodium). Null
 * while no prize pool is published, undefined until the board is known.
 */
const useSeasonPodium = (own: string | undefined): SeasonPodiumPlace[] | null | undefined => {
  const board = useFrontierBoard((board) => board);
  if (!board.data) return undefined;
  const podium = seasonPodium(board.data);
  return (
    podium &&
    podium.map(({ place, lords, holder }) => ({
      place,
      lords,
      holder:
        typeof holder === "string"
          ? holder
          : { name: <LordName account={holder.address} you={holder.address === own} /> },
    }))
  );
};

export const useSeasonViewer = () => useAccountStore((state) => state.account?.address ?? null);

/** The player's season rank as the Menu's Season row shows it: "—" while unknown, none for a viewer without a realm. */
export const useSeasonRank = (): string => {
  const race = useAspectBoard();
  const legacy = useSeasonBoard(race.known?.race === null);
  const viewer = useSeasonViewer();
  if (!race.known) return "—";
  if (race.known.race) {
    const board = race.known.race;
    const rank = board.standings.find((row) => row.aspect === board.own?.aspect)?.rank;
    return rank === undefined ? "" : `#${rank}`;
  }
  const rank = ownRank(legacy.data, viewer);
  return rank === undefined ? "—" : rank === null ? "" : `#${rank}`;
};

/**
 * Season over the board: a common chest at today's price with the season's pool behind it, every realm with the
 * player's own lit, a row's detail with Visit. Visiting closes the page for the visited realm.
 */
export const FrontierSeason = ({
  rules, onVisited, onClose,
}: {
  rules: ExpeditionRules;
  onVisited: () => void;
  onClose: () => void;
}) => {
  const race = useAspectBoard();
  return race.known?.race === null
    ? <LegacyFrontierSeason rules={rules} onVisited={onVisited} onClose={onClose} />
    : <FrontierAspectPage onClose={onClose} />;
};

const LegacyFrontierSeason = ({
  rules,
  onVisited,
  onClose,
}: {
  rules: ExpeditionRules;
  onVisited: () => void;
  onClose: () => void;
}) => {
  const board = useSeasonBoard();
  const viewer = useSeasonViewer();
  const { pool, chest } = useSeasonLords(rules);
  const [opened, setOpened] = useState<string | null>(null);
  const now = useNowSeconds();
  const entries = board.data ?? [];
  const own = findOwnEntry(entries, viewer);
  const rows = useSeasonListRows(board.data);
  const podium = useSeasonPodium(own?.address);
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
      podium={podium}
      rows={rows}
      state={board.isError ? "failed" : board.isPending ? "loading" : "ready"}
      onRetry={() => void board.refetch()}
      onOpen={setOpened}
      onClose={onClose}
      ends={{ at: rules.endAt, ...seasonDay(rules, now) }}
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

/** Every realm's row as SeasonList draws it, the player's own lit. */
const useSeasonListRows = (entries: readonly Entry[] | undefined): SeasonListRow[] => {
  const own = findOwnEntry(entries ?? [], useSeasonViewer());
  // Each row's label is the one name rule's, read as the rows are built: built again when a name lands.
  const names = usePlayerNames();
  return (entries ?? []).map((entry) => listRow(entry, entry === own, names));
};

/**
 * The board carries each realm's rank, depth and founding identity, including homes outside the viewer's scope.
 */
const listRow = (entry: Entry, own: boolean, names: PlayerNames): SeasonListRow => ({
  key: entry.address,
  rank: entry.rank,
  order: entry.order,
  realm: {
    level: entry.level,
    depth: entry.deepest_depth,
    skin: realmSkinOf(entry.campaign),
    hasWonder: entry.has_wonder,
  },
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
