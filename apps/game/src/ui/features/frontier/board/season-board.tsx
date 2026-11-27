import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { type PlayerNames, usePlayerDisplayName, usePlayerNames } from "@/hooks/use-player-profile";
import { startRealmVisit } from "@/sync/active-game-client";
import { PlayerSeatMark } from "@/hooks/use-watched-side";
import { LordName } from "./realm-marks";
import { entryRealmPainting } from "@/ui/design-system/home-icons";
import { configManager, type ExpeditionRules } from "@bibliothecadao/eternum";
import { fetchHeraldLeaderboard, requireShard, safeInteger } from "@bibliothecadao/eternum/game-client";
import type { HeraldFrontierLeaderboard, HeraldFrontierLeaderboardEntry } from "@bibliothecadao/eternum/game-sync";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { seasonDay } from "../hud/day-clock";
import { type SeasonDetail, SeasonDetailSheet } from "./season-detail";
import { SeasonList, type SeasonListRow, type SeasonPodiumPlace } from "./season-list";
import { seasonPodium } from "./season-pool";
import { findOwnEntry, ownRank, wholeLords, earnedResource } from "./standings";
import { FrontierAspectPage, useAspectBoard } from "../aspect/aspect-page";
import { useRacesAspects } from "../aspect/races-aspects";

type Entry = HeraldFrontierLeaderboardEntry;

const REFRESH_MS = 30_000;

/**
 * Frontier's season board from Herald's read model: sites cleared, then deepest depth, then who reached the count
 * first. Herald ranks; the client only reads, and an unknown board shows as "—".
 */
export const useSeasonBoard = (enabled = true) => useFrontierBoard((board) => board.entries, enabled);

/** Herald's Frontier board for the active game, its entries and prizes, read through `select`. */
export const useFrontierBoard = <T,>(select: (board: HeraldFrontierLeaderboard) => T, enabled = true) => {
  // A Season 1 game races Aspects: Herald serves no player ranking for it, so nothing asks.
  const races = useRacesAspects();
  const shard = requireShard();
  const gameId = configManager.getActiveGameId();
  return useQuery({
    enabled: enabled && races === false,
    queryKey: ["frontierSeasonBoard", shard.url, gameId],
    queryFn: () => fetchHeraldLeaderboard(shard, gameId),
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
export const useSeasonRank = (): string | null => {
  const race = useAspectBoard();
  const legacy = useSeasonBoard();
  const viewer = useSeasonViewer();
  if (!race.known) return null;
  if (race.known.race) {
    const board = race.known.race;
    const rank = board.standings.find((row) => row.aspect === board.own?.aspect)?.rank;
    return rank === undefined ? "" : `#${rank}`;
  }
  const rank = ownRank(legacy.data, viewer);
  return rank === undefined ? null : rank === null ? "" : `#${rank}`;
};

export const FrontierSeason = ({
  rules,
  onVisited,
  onClose,
}: {
  rules: ExpeditionRules;
  onVisited: () => void;
  onClose: () => void;
}) => {
  const race = useAspectBoard();
  const now = useNowSeconds();
  return race.known?.race === null ? (
    <LegacyFrontierSeason rules={rules} onVisited={onVisited} onClose={onClose} />
  ) : (
    <FrontierAspectPage day={seasonDay(rules, now)} onClose={onClose} />
  );
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

/** Every realm's row as SeasonList draws it, the player's own lit. */
const useSeasonListRows = (entries: readonly Entry[] | undefined): SeasonListRow[] => {
  const own = findOwnEntry(entries ?? [], useSeasonViewer());
  // Each row's label is the one name rule's, read as the rows are built: built again when a name lands.
  const names = usePlayerNames();
  return (entries ?? []).map((entry) => listRow(entry, entry === own, names));
};

const listRow = (entry: Entry, own: boolean, names: PlayerNames): SeasonListRow => ({
  key: entry.address,
  rank: entry.rank,
  order: entry.order,
  realm: {
    level: entry.level,
    depth: entry.deepest_depth,
    ...entryRealmPainting(entry),
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
