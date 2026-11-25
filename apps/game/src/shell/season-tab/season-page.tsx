import "./season-page.css";

import {
  aspectName,
  aspects,
  formatAmount,
  formatCount,
  formatDate,
  formatExact,
  orderAspect,
  type AspectId,
} from "@bibliothecadao/types";
import { useState, type CSSProperties } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { isGameOver } from "@/runtime/world/directory";
import { aspectVariables } from "@/tokens";
import { AspectMark } from "@/ui/design-system/aspect-mark";
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
import { OrderEmblem } from "@/ui/design-system/kit/order-emblem";
import { PlayerName } from "@/ui/design-system/kit/player-name";
import { ServiceFailure } from "@/ui/design-system/kit/service-failure";
import { ASPECT_PAGE_WORDS, DAY, PLAY_WORDS, PRIZE_UNHELD, SEASON_WORDS, WORDS } from "@/ui/design-system/kit/words";
import { seasonWinner } from "@/ui/features/frontier/board/season-pool";
import { findOwnEntry, wholeLords } from "@/ui/features/frontier/board/standings";

import { useLayout } from "../frame/layout";
import { openedFrom } from "../frame/opened-from";
import { PageFrame } from "../frame/page-frame";
import { entryHref } from "../game-links";
import {
  type AspectSeasonGame,
  type DirectoryGame,
  gameRefOf,
  isAspectSeason,
  useDirectory,
  useLeaderboard,
  useRealmsPlayer,
  useSettledGames,
} from "../herald";
import { Loading } from "../loading";
import { ageOf } from "../play/ages";
import { HyperstructureRaceStage } from "../play/hyperstructure-stage";
import { CopySeasonInvite, SeasonInviteAlerts, useSeasonInvite } from "../play/season-invite";
import {
  RACE_STAGE_COUNT,
  type AspectRaceStanding,
  aspectRaceStandings,
  directoryDay,
  endedSeasons,
  seasonDayLabel,
  seasonDaysOf,
  seasonEnded,
  seasonPlayerAspect,
  seasonPlayerHome,
  seasonRealmId,
  seasonTitle,
  stageTriumphsOf,
} from "../season";
import { chooseSeason } from "../season-pick";
import { useNowSeconds } from "../use-now";
import { AspectRoster, GlobalGloryRoster } from "./aspect-roster";
import { FrontierRows } from "./frontier-rows";
import { resultsHref } from "./results-link";
import { SeasonPodium } from "./season-podium";

const BOARD_ROWS = { phone: 12, desktop: 10 } as const;

export const SeasonPage = () => {
  const phone = useLayout() === "phone";
  const { season, past, failure } = useSeason();
  return (
    <PageFrame title={WORDS.season} painting="season-citadel">
      <div className="flex flex-col gap-6" data-season-page>
        {phone && <h1 className="text-app-title text-app-ink">{WORDS.season}</h1>}
        {failure ? (
          <AppPanel>
            <ServiceFailure service="season" error={failure.error} retry={() => void failure.refetch()} />
          </AppPanel>
        ) : !season ? (
          <Loading />
        ) : isAspectSeason(season) ? (
          <AspectSeasonView season={season} past={past} rows={phone ? BOARD_ROWS.phone : BOARD_ROWS.desktop} />
        ) : (
          <div className="season-grid">
            <FrontierPanel season={season} rows={phone ? BOARD_ROWS.phone : BOARD_ROWS.desktop} />
            <SeasonAside season={season} past={past} />
          </div>
        )}
      </div>
    </PageFrame>
  );
};

const AspectSeasonView = ({
  season,
  past,
  rows,
}: {
  season: AspectSeasonGame;
  past: readonly DirectoryGame[];
  rows: number;
}) => {
  const [selectedAspect, setSelectedAspect] = useState<AspectId | 0>(0);
  const now = useNowSeconds();
  const day = directoryDay(season, now);
  const { finishHeight, byAspect } = aspectRaceStandings(season.aspect_race, season.aspect_members ?? null);
  const triumphs = stageTriumphsOf(season.aspect_race);
  const dayText = seasonDayLabel(day.day, seasonDaysOf(season));
  const ownAspect = seasonPlayerAspect(season);
  const ownRealmId = seasonRealmId(season);
  return (
    <div className="flex flex-col gap-6" data-season-race>
      <AppPanel
        title={ageOf("frontier").name}
        icon="crown"
        painting={ageOf("frontier").painting}
        cue={
          <span className="flex flex-wrap items-center gap-2">
            {isGameOver(season) ? (
              <SeasonEnded season={season} />
            ) : (
              <AppChip icon="hourglass" tone="gold">
                {[seasonTitle(season), dayText].filter(Boolean).join(" · ")}
              </AppChip>
            )}
            <AppChip icon="people">{formatCount(season.player_count, PLAY_WORDS.player)}</AppChip>
          </span>
        }
      >
        <HyperstructureRaceStage
          byAspect={byAspect}
          finishHeight={finishHeight}
          ownAspect={ownAspect}
          triumphs={triumphs}
        />
      </AppPanel>
      <div className="season-grid">
        <AppPanel title={SEASON_WORDS.gloryLeaderboard} icon="leaderboard" flush>
          <div className="season-board__tabs">
            <AppTabs
              label={SEASON_WORDS.gloryLeaderboard}
              value={selectedAspect}
              onChange={(value) => setSelectedAspect(value)}
              tabs={[
                { key: 0 as const, label: SEASON_WORDS.allPlayers },
                ...aspects.map(({ id, name }) => ({
                  key: id,
                  label: name,
                  lead: <AspectMark aspect={id} size={18} decorative />,
                  aspectId: id,
                })),
              ]}
            />
          </div>
          {selectedAspect === 0 ? (
            <GlobalGloryRoster season={season} ownRealmId={ownRealmId} rows={rows} />
          ) : (
            <AspectRoster
              season={season}
              aspect={selectedAspect}
              ownRealmId={ownRealmId}
              ownAspect={selectedAspect === ownAspect}
              rows={rows}
            />
          )}
        </AppPanel>
        <div className="flex min-w-0 flex-col gap-6">
          <AspectPlayerStanding season={season} finishHeight={finishHeight} byAspect={byAspect} />
          {past.length > 0 && <PastSeasons seasons={past} />}
        </div>
      </div>
    </div>
  );
};

const AspectPlayerStanding = ({
  season,
  finishHeight,
  byAspect,
}: {
  season: AspectSeasonGame;
  finishHeight: number;
  byAspect: Record<AspectId, AspectRaceStanding>;
}) => {
  const { realm, order, aspect } = seasonPlayerHome(season);
  if (!realm || aspect === null) {
    return (
      <AppPanel title={SEASON_WORDS.yourStanding} icon="realm">
        <div className="flex flex-col gap-3">
          <p className="text-app-body text-app-muted">{SEASON_WORDS.noRealmYet}</p>
          <AppButton kind="primary" icon="play" to="/">
            {WORDS.play}
          </AppButton>
        </div>
      </AppPanel>
    );
  }
  const ownStanding = byAspect[aspect];
  return (
    <AppPanel title={SEASON_WORDS.yourStanding} icon="realm">
      <div className="flex flex-col gap-4" style={aspectVariables(aspect) as CSSProperties}>
        <div className="flex items-center gap-3">
          <AspectMark aspect={aspect} size={46} decorative />
          <div className="flex min-w-0 flex-col">
            <span className="text-app-heading text-app-ink">{realm.name}</span>
            <span className="flex flex-wrap items-center gap-2 text-app-label text-app-muted">
              <span className="season-standing__aspect">{aspectName(aspect)}</span>
              {order && (
                <span className="inline-flex items-center gap-1">
                  <OrderEmblem order={order.orderId} size={16} />
                  {order.orderName}
                </span>
              )}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="season-stat">
            <span className="season-stat__value">{formatExact(ownStanding.height)}</span>
            <span className="season-stat__label">{ASPECT_PAGE_WORDS.height(ownStanding.height, finishHeight)}</span>
          </div>
          <div className="season-stat">
            <span className="season-stat__value text-app-gold">{`${ownStanding.stage}/${RACE_STAGE_COUNT}`}</span>
            <span className="season-stat__label">{ASPECT_PAGE_WORDS.stage(ownStanding.stage, RACE_STAGE_COUNT)}</span>
          </div>
        </div>
        <AspectStandingActions season={season} />
      </div>
    </AppPanel>
  );
};

const AspectStandingActions = ({ season }: { season: AspectSeasonGame }) => {
  const invite = useSeasonInvite();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {season.status === "Live" && (
          <AppButton kind="primary" icon="play" to={entryHref(season, "play")} className="flex-1">
            {WORDS.enterRealm}
          </AppButton>
        )}
        <CopySeasonInvite invite={invite} size="md" className="flex-1" />
      </div>
      <SeasonInviteAlerts invite={invite} />
    </div>
  );
};

const FrontierDay = ({ season }: { season: DirectoryGame }) => {
  const now = useNowSeconds();
  return (
    <AppChip icon="hourglass">{`${seasonTitle(season)} · ${DAY} ${directoryDay(season, now).day ?? "—"}`}</AppChip>
  );
};

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

const Standing = ({ season }: { season: DirectoryGame }) => {
  const { data: player } = useRealmsPlayer();
  const board = useLeaderboard(season);
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

const SeasonAside = ({ season, past }: { season: DirectoryGame; past: readonly DirectoryGame[] }) => (
  <div className="flex min-w-0 flex-col gap-6">
    <Standing season={season} />
    {past.length > 0 && <PastSeasons seasons={past} />}
  </div>
);

const FrontierPanel = ({ season, rows }: { season: DirectoryGame; rows: number }) => {
  const frontier = ageOf("frontier");
  return (
    <div data-age="frontier" className="min-w-0">
      <AppPanel
        title={frontier.name}
        icon="leaderboard"
        painting={frontier.painting}
        cue={isGameOver(season) ? <SeasonEnded season={season} /> : <FrontierDay season={season} />}
        flush
      >
        <FrontierBoard season={season} rows={rows} />
      </AppPanel>
    </div>
  );
};

const SeasonEnded = ({ season }: { season: DirectoryGame }) => <AppChip icon="calendar">{seasonEnded(season)}</AppChip>;

const FrontierBoard = ({ season, rows }: { season: DirectoryGame; rows: number }) => {
  const [aspectFilter, setAspectFilter] = useState<AspectId | null>(null);
  const { data: player } = useRealmsPlayer();
  const board = useLeaderboard(season);
  if (board.isError) return <ServiceFailure service="season" error={board.error} retry={() => void board.refetch()} />;
  if (board.isPending) return <Loading />;
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
      <div className="border-b border-app-line px-4 py-3">
        <AppTabs
          label={WORDS.season}
          value={aspectFilter}
          onChange={(id) => setAspectFilter(aspectFilter === id ? null : id)}
          tabs={aspects.map(({ id, name }) => ({
            key: id,
            label: name,
            lead: <AspectMark aspect={id} size={18} decorative />,
            aspectId: id,
          }))}
        />
      </div>
      <FrontierRows entries={shown} own={own} rows={rows} />
    </div>
  );
};

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

const PastSeason = ({ season }: { season: DirectoryGame }) => {
  const aspectSeason = isAspectSeason(season);
  const board = useLeaderboard(season);
  const here = useLocation();
  const navigate = useNavigate();
  const winner = board.data && seasonWinner(board.data);
  const aspectWinner = aspectSeason
    ? aspectRaceStandings(season.aspect_race, season.aspect_members ?? null).winner
    : null;
  return (
    <AppRow
      lead={<RowThumb painting={ageOf("frontier").painting} size={10} />}
      title={seasonTitle(season)}
      detail={`${PLAY_WORDS.ended} ${formatDate(season.clock.end_at)}`}
      onClick={() => navigate(resultsHref(gameRefOf(season)), { state: openedFrom(here) })}
      trail={
        aspectWinner ? (
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <AspectMark aspect={aspectWinner.id} size={20} decorative />
            <span className="text-app-ink">{aspectWinner.name}</span>
          </span>
        ) : winner ? (
          <span className="inline-flex min-w-0 items-center gap-2">
            <HudPlaceMedal place={1} size={20} below={null} />
            {typeof winner === "string" ? (
              <span className="text-app-muted">{PRIZE_UNHELD[winner]}</span>
            ) : (
              <PlayerName account={winner.address} />
            )}
          </span>
        ) : undefined
      }
    />
  );
};
