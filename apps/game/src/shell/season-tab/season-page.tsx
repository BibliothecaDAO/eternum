import { formatAmount } from "@bibliothecadao/types";
import { useState } from "react";

import { AppButton, AppChip, AppEmpty, AppFigure, AppPanel, AppTabs } from "@/ui/design-system/kit/app-elements";
import { DAY, SEASON_WORDS, WORDS } from "@/ui/design-system/kit/words";
import { boardRows, findOwnEntry, wholeLords } from "@/ui/features/frontier/board/standings";

import { useLayout } from "../frame/layout";
import { PageFrame } from "../frame/page-frame";
import { type DirectoryGame, useDirectory, useLeaderboard, useRealmsPlayer } from "../herald";
import { Loading } from "../loading";
import { ageOf } from "../play/ages";
import { chooseSeason, directoryDay, seasonTitle } from "../season";
import { ServiceFailure } from "@/ui/design-system/kit/service-failure";
import { useNowSeconds } from "../use-now";
import { BlitzBoard } from "./blitz-board";
import { FrontierRow } from "./frontier-row";

type SeasonView = "frontier" | "blitz";

/** How many of the board's rows a layout shows before the player's own row is pinned under them. */
const ROWS_SHOWN = { phone: 12, desktop: 10 } as const;

/**
 * Season (the owner's pick, A · Launcher): where the player stands this season, in figures at the top (their place on
 * Frontier's board, the LORDS their realm earned), then one board per mode under its mode's painting: Frontier's season board, and Blitz's rating with the season prize each place would take. The desktop shows
 * both side by side; a phone switches between them. The player's own finished games are on You.
 */
export const SeasonPage = () => {
  const phone = useLayout() === "phone";
  // Frontier and Blitz each run their own season: the page is Season, and each board names its own.
  return (
    <PageFrame title={WORDS.season} painting="season-citadel">
      <div className="flex flex-col gap-6">
        {phone && <h1 className="text-app-title text-app-ink">{WORDS.season}</h1>}
        <Standing />
        {phone ? <PhoneBoards /> : <DesktopBoards />}
      </div>
    </PageFrame>
  );
};

const DesktopBoards = () => (
  <div className="grid grid-cols-2 items-start gap-6">
    <FrontierPanel rowsShown={ROWS_SHOWN.desktop} />
    <BlitzBoard />
  </div>
);

/** A phone: the sheet's tabs above the one board. */
const PhoneBoards = () => {
  const [view, setView] = useState<SeasonView>("frontier");
  return (
    <>
      <AppTabs
        label={SEASON_WORDS.views}
        value={view}
        onChange={setView}
        tabs={[
          { key: "frontier", label: ageOf("frontier").name },
          { key: "blitz", label: ageOf("blitz").name },
        ]}
      />
      {view === "frontier" ? <FrontierPanel rowsShown={ROWS_SHOWN.phone} /> : <BlitzBoard />}
    </>
  );
};

/** Frontier's own season and its day by the hourglass, "Season 1 · Day 4", on the clock. */
const FrontierDay = ({ season }: { season: DirectoryGame }) => {
  const now = useNowSeconds();
  return (
    <AppChip icon="hourglass">{`${seasonTitle(season)} · ${DAY} ${directoryDay(season, now).day ?? "—"}`}</AppChip>
  );
};

/** The live Frontier season, the player's own if they have a realm in one. */
const useSeason = (): { season: DirectoryGame | undefined; directory: ReturnType<typeof useDirectory> } => {
  const directory = useDirectory();
  return { season: chooseSeason(directory.data?.games ?? [], true), directory };
};

/**
 * Where the player stands on Frontier this season, in figures with their pictures: their place on the board, and the
 * LORDS their realm has earned. Their Blitz rating stands on Blitz's board. With no realm in the season, nothing.
 */
const Standing = () => {
  const { season } = useSeason();
  const { data: player } = useRealmsPlayer();
  const board = useLeaderboard(season ? { chainId: season.chainId, gameId: season.game_id } : null);
  const entries = board.data?.mode === "frontier" ? board.data.entries : [];
  const own = findOwnEntry(entries, player);
  if (!own) return null;
  return (
    <AppPanel>
      <div className="flex flex-wrap items-center gap-x-12 gap-y-4">
        <AppFigure
          icon="leaderboard"
          tone="gold"
          value={`#${formatAmount(own.rank)}`}
          label={`${ageOf("frontier").name} · ${SEASON_WORDS.of} ${formatAmount(entries.length)}`}
        />
        <AppFigure
          icon="lords"
          tone="gold"
          value={formatAmount(wholeLords(own.rewards.lords))}
          label={SEASON_WORDS.lordsEarned}
        />
      </div>
    </AppPanel>
  );
};

/** Frontier's board under Frontier's painting, with its season and day; no season running is said once on the plains. */
const FrontierPanel = ({ rowsShown }: { rowsShown: number }) => {
  const { season, directory } = useSeason();
  const frontier = ageOf("frontier");
  if (!season && !directory.isPending && !directory.isError)
    return (
      <AppPanel title={frontier.name} icon="leaderboard" painting="brooding-plains">
        <AppEmpty icon="leaderboard" line={WORDS.noSeason} />
      </AppPanel>
    );
  return (
    <div data-age="frontier">
      <AppPanel
        title={frontier.name}
        icon="leaderboard"
        painting={frontier.painting}
        cue={season && <FrontierDay season={season} />}
        flush
      >
        <FrontierBoard rowsShown={rowsShown} />
      </AppPanel>
    </div>
  );
};

/** Frontier's board: its first rows, the player's own lit in place, or pinned under them when it ranks below. */
const FrontierBoard = ({ rowsShown }: { rowsShown: number }) => {
  const { season, directory } = useSeason();
  const { data: player } = useRealmsPlayer();
  const board = useLeaderboard(season ? { chainId: season.chainId, gameId: season.game_id } : null);
  if (directory.isError || board.isError)
    return (
      <ServiceFailure
        service="season"
        error={directory.error ?? board.error}
        retry={() => void (directory.isError ? directory.refetch() : board.refetch())}
      />
    );
  if (!season) return directory.isPending ? <Loading /> : null;
  if (board.isPending) return <Loading />;
  const rows = board.data?.mode === "frontier" ? boardRows(board.data.entries, player, rowsShown) : [];
  if (rows.length === 0)
    return (
      <AppEmpty
        icon="leaderboard"
        line={SEASON_WORDS.boardEmpty}
        action={
          <AppButton kind="secondary" icon="play" to="/">
            {WORDS.play}
          </AppButton>
        }
      />
    );
  return (
    <div>
      {rows.map(({ entry, own }) => (
        <FrontierRow key={entry.address} entry={entry} own={own} />
      ))}
    </div>
  );
};
