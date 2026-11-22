import { aspects, formatAmount, formatDate, orderAspect, type AspectId } from "@bibliothecadao/types";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { isGameOver } from "@/runtime/world/directory";
import { AspectMark } from "@/ui/design-system/aspect-mark";
import { AppButton, AppChip, AppEmpty, AppFigure, AppPanel, AppRow } from "@/ui/design-system/kit/app-elements";
import { HudPlaceMedal } from "@/ui/design-system/kit/hud-elements";
import { RowThumb } from "@/ui/design-system/kit/list-row";
import { PlayerName } from "@/ui/design-system/kit/player-name";
import { DAY, PLAY_WORDS, PRIZE_UNHELD, SEASON_WORDS, WORDS } from "@/ui/design-system/kit/words";
import { seasonWinner } from "@/ui/features/frontier/board/season-pool";
import { findOwnEntry, wholeLords } from "@/ui/features/frontier/board/standings";

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
import { chooseSeason, directoryDay, endedSeasons, seasonEnded, seasonTitle } from "../season";
import { ServiceFailure } from "@/ui/design-system/kit/service-failure";
import { useNowSeconds } from "../use-now";
import { FrontierRows } from "./frontier-rows";
import { resultsHref } from "./results-link";
import { SeasonPodium } from "./season-podium";

const BOARD_ROWS = { phone: 12, desktop: 10 } as const;

export const SeasonPage = () => {
  const phone = useLayout() === "phone";
  return (
    <PageFrame title={WORDS.season} painting="season-citadel">
      <div className="flex flex-col gap-6">
        {phone && <h1 className="text-app-title text-app-ink">{WORDS.season}</h1>}
        <div className="app-season-grid">
          <FrontierPanel rows={phone ? BOARD_ROWS.phone : BOARD_ROWS.desktop} />
          <SeasonAside />
        </div>
      </div>
    </PageFrame>
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
 * last to end (an archived season at the least). The seasons that ended before it are past, the last to end first.
 * None is shown while a read it waits on is pending. `failure` is the read the shown season waits on that did not
 * answer: the directory, or the history while no season is live.
 */
const useSeason = () => {
  const directory = useDirectory();
  const settled = useSettledGames();
  const listed = directory.data?.games ?? [];
  const ended = endedSeasons(listed, settled.data ?? []);
  const live = chooseSeason(
    listed.filter((game) => game.status === "Live"),
    true,
  );
  const failure = directory.isError ? directory : !live && settled.isError ? settled : undefined;
  const pending = directory.isPending || (!live && settled.isPending);
  const season = pending ? undefined : (live ?? ended[0]);
  return { season, past: season ? ended.filter((game) => game !== season) : [], failure };
};

const Standing = () => {
  const { season } = useSeason();
  const { data: player } = useRealmsPlayer();
  const board = useLeaderboard(season ? gameRefOf(season) : null);
  const entries = board.data?.entries ?? [];
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

const SeasonAside = () => {
  const { past } = useSeason();
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Standing />
      {past.length > 0 && <PastSeasons seasons={past} />}
    </div>
  );
};

const FrontierPanel = ({ rows }: { rows: number }) => {
  const { season } = useSeason();
  const frontier = ageOf("frontier");
  return (
    <div data-age="frontier" className="min-w-0">
      <AppPanel
        title={frontier.name}
        icon="leaderboard"
        painting={frontier.painting}
        cue={season && (isGameOver(season) ? <SeasonEnded season={season} /> : <FrontierDay season={season} />)}
        flush
      >
        <FrontierBoard rows={rows} />
      </AppPanel>
    </div>
  );
};

/** An ended season and the day it ended, "Playtest · Ended 31 Oct", on the calendar. */
const SeasonEnded = ({ season }: { season: DirectoryGame }) => <AppChip icon="calendar">{seasonEnded(season)}</AppChip>;

const FrontierBoard = ({ rows }: { rows: number }) => {
  const [aspectFilter, setAspectFilter] = useState<AspectId | null>(null);
  const { season, failure } = useSeason();
  const { data: player } = useRealmsPlayer();
  const board = useLeaderboard(season ? gameRefOf(season) : null);
  const failed = failure ?? (board.isError ? board : undefined);
  if (failed) return <ServiceFailure service="season" error={failed.error} retry={() => void failed.refetch()} />;
  if (!season || board.isPending) return <Loading />;
  const frontier = board.data;
  const entries = frontier?.entries ?? [];
  const own = findOwnEntry(entries, player);
  if (entries.length === 0)
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
  const shown = aspectFilter === null ? entries : entries.filter((entry) => orderAspect(entry.order) === aspectFilter);
  return (
    <div>
      {frontier && <SeasonPodium board={frontier} own={own?.address} over={isGameOver(season)} />}
      <div className="app-aspect-filter" role="group" aria-label={WORDS.season}>
        {aspects.map(({ id, name }) => {
          const active = aspectFilter === id;
          return (
            <button
              key={id}
              type="button"
              data-aspect-id={id}
              aria-pressed={active}
              className="app-aspect-filter__pill"
              onClick={() => setAspectFilter(active ? null : id)}
            >
              <AspectMark aspect={id} size={18} decorative />
              <span>{name}</span>
            </button>
          );
        })}
      </div>
      <FrontierRows entries={shown} own={own} rows={rows} />
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
  const winner = board.data && seasonWinner(board.data);
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
            {typeof winner === "string" ? (
              <span className="text-app-muted">{PRIZE_UNHELD[winner]}</span>
            ) : (
              <PlayerName account={winner.address} />
            )}
          </span>
        )
      }
    />
  );
};
