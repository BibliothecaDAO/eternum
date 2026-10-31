import { formatAmount, formatDate } from "@bibliothecadao/types";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { isGameOver } from "@/runtime/world/directory";
import {
  AppButton,
  AppChip,
  AppEmpty,
  AppFigure,
  AppPanel,
  AppRow,
  AppTabs,
} from "@/ui/design-system/kit/app-elements";
import { HudPlaceMedal } from "@/ui/design-system/kit/hud-elements";
import { RowThumb } from "@/ui/design-system/kit/list-row";
import { PlayerName } from "@/ui/design-system/kit/player-name";
import { DAY, PLAY_WORDS, SEASON_WORDS, WORDS } from "@/ui/design-system/kit/words";
import { seasonWinner } from "@/ui/features/frontier/board/season-pool";
import { boardRows, findOwnEntry, wholeLords } from "@/ui/features/frontier/board/standings";

import { useLayout } from "../frame/layout";
import { openedFrom } from "../frame/opened-from";
import { PageFrame } from "../frame/page-frame";
import {
  type DirectoryGame,
  gameRefOf,
  useDirectory,
  useLeaderboard,
  useRealmsPlayer,
  useSettledGames,
} from "../herald";
import { Loading } from "../loading";
import { ageOf } from "../play/ages";
import { chooseSeason, directoryDay, endedSeasons, seasonTitle } from "../season";
import { ServiceFailure } from "@/ui/design-system/kit/service-failure";
import { useNowSeconds } from "../use-now";
import { BlitzBoard } from "./blitz-board";
import { FrontierRow } from "./frontier-row";
import { resultsHref } from "./results-link";
import { SeasonPodium } from "./season-podium";

type SeasonView = "frontier" | "blitz";

/** How many of the board's rows a layout shows before the player's own row is pinned under them. */
const ROWS_SHOWN = { phone: 12, desktop: 10 } as const;

/**
 * Season (the owner's pick, A · Launcher): where the player stands this season, in figures at the top (their place on
 * Frontier's board, the LORDS their realm earned), then one board per mode under its mode's painting: Frontier's
 * season board, and Blitz's rating with the season prize each place would take. With no Frontier season running, its
 * board is the last one's as it ended; the seasons before it are under Past seasons, each opening its Results. The
 * desktop shows both side by side; a phone switches between them. The player's own finished games are on You.
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
      >
        {view === "frontier" ? <FrontierPanel rowsShown={ROWS_SHOWN.phone} /> : <BlitzBoard />}
      </AppTabs>
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

/**
 * The Frontier season Season shows: the live one, the player's own if they have a realm in one; with none live, the
 * last to end. The seasons that ended before it are past, the last to end first. `failure` is the read the shown season
 * waits on that did not answer: the directory, or the history while no season is live.
 */
const useSeason = () => {
  const directory = useDirectory();
  const settled = useSettledGames();
  const listed = directory.data?.games ?? [];
  const ended = endedSeasons(listed, settled.data ?? []);
  const live = chooseSeason(listed, true);
  const season = live ?? ended[0];
  const failure = directory.isError ? directory : !live && settled.isError ? settled : undefined;
  const pending = directory.isPending || (!live && settled.isPending);
  return { season, past: ended.filter((game) => game !== season), failure, pending };
};

/**
 * Where the player stands on Frontier this season, in figures with their pictures: their place on the board, and the
 * LORDS their realm has earned. Their Blitz rating stands on Blitz's board. With no realm in the season, nothing.
 */
const Standing = () => {
  const { season } = useSeason();
  const { data: player } = useRealmsPlayer();
  const board = useLeaderboard(season ? gameRefOf(season) : null);
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

/**
 * Frontier's board under Frontier's painting, with its season and day, or the day it ended; the seasons past under it.
 * No season at all, running or ended, is said once on the plains.
 */
const FrontierPanel = ({ rowsShown }: { rowsShown: number }) => {
  const { season, past, failure, pending } = useSeason();
  const frontier = ageOf("frontier");
  if (!season && !pending && !failure)
    return (
      <AppPanel title={frontier.name} icon="leaderboard" painting="brooding-plains">
        <AppEmpty icon="leaderboard" line={WORDS.noSeason} />
      </AppPanel>
    );
  return (
    <div className="flex flex-col gap-6">
      <div data-age="frontier">
        <AppPanel
          title={frontier.name}
          icon="leaderboard"
          painting={frontier.painting}
          cue={season && (isGameOver(season) ? <SeasonEnded season={season} /> : <FrontierDay season={season} />)}
          flush
        >
          <FrontierBoard rowsShown={rowsShown} />
        </AppPanel>
      </div>
      {past.length > 0 && <PastSeasons seasons={past} />}
    </div>
  );
};

/** An ended season and the day it ended, "Season 1 · Ended 31 Oct", on the calendar. */
const SeasonEnded = ({ season }: { season: DirectoryGame }) => (
  <AppChip icon="calendar">{`${seasonTitle(season)} · ${PLAY_WORDS.ended} ${formatDate(season.clock.end_at)}`}</AppChip>
);

/** Frontier's board: its first rows, the player's own lit in place, or pinned under them when it ranks below. */
const FrontierBoard = ({ rowsShown }: { rowsShown: number }) => {
  const { season, failure, pending } = useSeason();
  const { data: player } = useRealmsPlayer();
  const board = useLeaderboard(season ? gameRefOf(season) : null);
  const failed = failure ?? (board.isError ? board : undefined);
  if (failed) return <ServiceFailure service="season" error={failed.error} retry={() => void failed.refetch()} />;
  if (!season) return pending ? <Loading /> : null;
  if (board.isPending) return <Loading />;
  const frontier = board.data?.mode === "frontier" ? board.data : undefined;
  const rows = frontier ? boardRows(frontier.entries, player, rowsShown) : [];
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
      {frontier && (
        <SeasonPodium
          board={frontier}
          own={findOwnEntry(frontier.entries, player)?.address}
          over={isGameOver(season)}
        />
      )}
      {rows.map(({ entry, own }) => (
        <FrontierRow key={entry.address} entry={entry} own={own} />
      ))}
    </div>
  );
};

/** The seasons that ended before the one shown, the last to end first. */
const PastSeasons = ({ seasons }: { seasons: readonly DirectoryGame[] }) => (
  <AppPanel title={SEASON_WORDS.pastSeasons} icon="calendar" flush>
    <ol>
      {seasons.map((season) => (
        <li key={`${season.chainId}:${season.game_id}`}>
          <PastSeason season={season} />
        </li>
      ))}
    </ol>
  </AppPanel>
);

/** A past season: its number, the day it ended and its winner; the row opens its Results, whose Back leads here. */
const PastSeason = ({ season }: { season: DirectoryGame }) => {
  const board = useLeaderboard(gameRefOf(season));
  const here = useLocation();
  const navigate = useNavigate();
  const winner = board.data?.mode === "frontier" ? seasonWinner(board.data) : undefined;
  return (
    <AppRow
      lead={<RowThumb painting={ageOf("frontier").painting} size={10} />}
      title={seasonTitle(season)}
      detail={`${PLAY_WORDS.ended} ${formatDate(season.clock.end_at)}`}
      onClick={() => navigate(resultsHref(gameRefOf(season)), { state: openedFrom(here) })}
      trail={
        winner && (
          <span className="inline-flex min-w-0 items-center gap-2">
            <HudPlaceMedal place={1} size={20} below={null} />
            <PlayerName account={winner} portrait />
          </span>
        )
      }
    />
  );
};
