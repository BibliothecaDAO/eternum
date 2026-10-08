import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { usePlayerDisplayName } from "@/hooks/use-player-profile";
import { getActiveGame } from "@/runtime/world";
import { startRealmVisit } from "@/sync/active-game-client";
import { PlayerName } from "@/ui/design-system/kit/player-name";
import { configManager } from "@bibliothecadao/eternum";
import { fetchHeraldLeaderboard, requireShard } from "@bibliothecadao/eternum/game-client";
import type { HeraldFrontierLeaderboardEntry } from "@bibliothecadao/eternum/game-sync";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { GuideSlot } from "../guide/frontier-guide";
import { type SeasonDetail, SeasonDetailSheet } from "./season-detail";
import { SeasonList, type SeasonListRow } from "./season-list";
import { type PodiumPlace, SeasonOverCard, type SeasonTotals } from "./season-over-card";
import { findOwnEntry, ownRank, wholeLords, wholeResource } from "./standings";

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
 * Season over the board: the first fifty realms and the player's own, a row's detail with Visit. Visiting closes the
 * page for the visited realm. Today's common chest waits for the day's chest price in the contracts' schema.
 */
export const FrontierSeason = ({ onBack }: { onBack: () => void }) => {
  const board = useSeasonBoard();
  const viewer = useViewer();
  const [opened, setOpened] = useState<string | null>(null);
  const entries = board.data ?? [];
  const own = findOwnEntry(entries, viewer);
  const top = entries.slice(0, LIST_LENGTH);
  const chosen = entries.find((entry) => entry.address === opened);
  const visit = (entry: Entry) => {
    startRealmVisit({ player: entry.address, structureId: Number(entry.structure_id) });
    onBack();
  };
  return (
    <>
      <SeasonList
        rank={ownRank(board.data, viewer)}
        rows={top.map((entry) => listRow(entry, entry === own))}
        pinned={own && !top.includes(own) ? listRow(own, true) : undefined}
        state={board.isError ? "failed" : board.isPending ? "loading" : "ready"}
        onRetry={() => void board.refetch()}
        onOpen={setOpened}
        onBack={onBack}
      />
      {chosen && (
        <EntryDetail
          entry={chosen}
          onVisit={chosen === own ? undefined : () => visit(chosen)}
          onClose={() => setOpened(null)}
        />
      )}
    </>
  );
};

const listRow = (entry: Entry, own: boolean): SeasonListRow => ({
  key: entry.address,
  rank: entry.rank,
  order: entry.order,
  name: <PlayerName account={entry.address} you={own} portrait />,
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
  name: <PlayerName account={entry.address} />,
  sites: {
    total: entry.sites_cleared.total,
    camps: entry.sites_cleared.camps,
    rifts: entry.sites_cleared.rifts,
    ruins: entry.sites_cleared.ruins,
    stragglers: entry.sites_cleared.stragglers,
  },
  chests: entry.chests_earned,
  lords: wholeLords(entry.rewards.lords),
  reach: entry.deepest_depth,
  essence: wholeResource(entry.rewards.essence),
  labor: wholeResource(entry.rewards.labor),
});

/**
 * The season-over card once the game has ended. The ending is not yet a recorded fact: the mist lifted stands until
 * Herald names it, as on the app's Results.
 */
export const SeasonOver = ({ onSeason }: { onSeason: () => void }) => {
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
      guide={<GuideSlot host="season-over" facts={{ seasonOver: true }} />}
      onSeason={onSeason}
      onExit={() => navigate("/")}
    />
  );
};

const podiumPlace = (entry: Entry, own: boolean): PodiumPlace => ({
  key: entry.address,
  rank: entry.rank,
  name: <PlayerName account={entry.address} you={own} portrait />,
  sitesCleared: entry.sites_cleared.total,
});

const seasonTotals = (entry: Entry): SeasonTotals => ({
  sitesCleared: entry.sites_cleared.total,
  chests: entry.chests_earned,
  lords: wholeLords(entry.rewards.lords),
  reach: entry.deepest_depth,
  essence: wholeResource(entry.rewards.essence),
  labor: wholeResource(entry.rewards.labor),
});
