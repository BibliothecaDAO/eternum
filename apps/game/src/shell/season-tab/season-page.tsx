import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { cn } from "@/ui/design-system/atoms/lib/utils";
import { KitIcon } from "@/ui/design-system/kit/kit-icon";
import { PlayerName } from "@/ui/design-system/kit/player-name";
import { SeasonRow } from "@/ui/design-system/kit/season-row";
import { ViewSwitch } from "@/ui/design-system/kit/view-switch";
import { DAY } from "@/ui/design-system/kit/words";
import { boardRows, wholeLords } from "@/ui/features/frontier/board/standings";

import { useLayout } from "../frame/layout";
import { PageFrame } from "../frame/page-frame";
import { type DirectoryGame, useDirectory, useLeaderboard, useRealmsPlayer, useRecentResults } from "../herald";
import { Loading } from "../loading";
import { paintingSources } from "../paintings";
import { Panel } from "../panel";
import { ageOf } from "../play/ages";
import { chooseSeason, directoryDay, seasonTitle } from "../season";
import { ServiceFailure } from "../service-failure";
import { useNowSeconds } from "../use-now";
import { SEASON_WORDS, WORDS } from "../words";
import { BlitzPanel } from "./blitz-rating";
import { HistoryRow } from "./history-row";

type SeasonView = "frontier" | "blitz";

/** How many of the board's rows a layout shows before the player's own row is pinned under them. */
const ROWS_SHOWN = { phone: 12, desktop: 15 } as const;

/** How many of the player's finished Blitz games the Season tab lists, newest first. */
const BLITZ_GAMES = 20;

/**
 * The Season tab (spec 09): where the player stands in Frontier's season, and in Blitz: a switch above the one list
 * on a phone (Blitz there is the player's finished games); the desktop shows both side by side, Blitz with its rating.
 */
export const SeasonPage = () => (useLayout() === "phone" ? <PhoneSeason /> : <DesktopSeason />);

const PhoneSeason = () => {
  const [view, setView] = useState<SeasonView>("frontier");
  return (
    <PageFrame>
      <div className="flex min-h-0 flex-col gap-3">
        <SeasonHeader />
        <ViewSwitch
          label={SEASON_WORDS.views}
          views={[
            { id: "frontier", word: ageOf("frontier").name },
            { id: "blitz", word: ageOf("blitz").name },
          ]}
          lit={view}
          onChange={setView}
        />
        {view === "frontier" ? <FrontierBoard rowsShown={ROWS_SHOWN.phone} /> : <BlitzGames />}
      </div>
    </PageFrame>
  );
};

/**
 * The desktop's Season: the season's title above, Frontier's board on the left with its day, and Blitz on the right:
 * the rating and the reader's own Blitz games.
 */
const DesktopSeason = () => {
  const { season, directory } = useSeason();
  const { data: player } = useRealmsPlayer();
  return (
    <PageFrame title={season ? seasonTitle(season) : WORDS.season}>
      <div className="grid grid-cols-[minmax(0,1fr)_34rem] items-start gap-6">
        {season || directory.isPending || directory.isError ? (
          <Panel icon="Tp" title={ageOf("frontier").name} aside={season && <SeasonDay season={season} />}>
            <FrontierBoard rowsShown={ROWS_SHOWN.desktop} framed={false} />
          </Panel>
        ) : (
          <NoSeason />
        )}
        <BlitzPanel games={player ? <BlitzGames framed={false} /> : null} />
      </div>
    </PageFrame>
  );
};

/** No Frontier season runs: the plains and the one line that says so. */
const NoSeason = () => (
  <section className="plate flex flex-col gap-4 p-4">
    <img {...paintingSources("brooding-plains")} sizes="50vw" alt="" className="h-40 w-full rounded-xl object-cover" />
    <p className="font-display text-[34px] leading-none text-kit-cream">{WORDS.noSeason}</p>
  </section>
);

const SeasonDay = ({ season }: { season: DirectoryGame }) => {
  const now = useNowSeconds();
  return (
    <span className="flex items-center gap-1 text-[15px] font-normal text-kit-muted">
      <KitIcon code="Hg" size={20} />
      {`${DAY} ${directoryDay(season, now).day ?? "—"}`}
    </span>
  );
};

/** The live Frontier season, the player's own if they have a realm in one. */
const useSeason = (): { season: DirectoryGame | undefined; directory: ReturnType<typeof useDirectory> } => {
  const directory = useDirectory();
  return { season: chooseSeason(directory.data?.games ?? [], true), directory };
};

/** Season and its day: the trophy and the word, and "Season 3" with "Day 12" while a season runs. */
const SeasonHeader = () => {
  const { season } = useSeason();
  const now = useNowSeconds();
  const day = season && directoryDay(season, now).day;
  return (
    <h1 className="flex items-center gap-2 font-ui text-[22px] font-bold text-kit-cream">
      <KitIcon code="Tp" size={26} />
      {season ? seasonTitle(season) : WORDS.season}
      {season && (
        <span className="ml-auto flex items-center gap-1 text-[15px] text-kit-muted">
          <KitIcon code="Hg" size={20} />
          {`${DAY} ${day ?? "—"}`}
        </span>
      )}
    </h1>
  );
};

/** Frontier's board: its first rows, the player's own lit in place, or pinned under them when it ranks below. */
const FrontierBoard = ({ rowsShown, framed = true }: { rowsShown: number; framed?: boolean }) => {
  const navigate = useNavigate();
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
  return (
    <section className={cn("flex min-h-0 flex-col", framed && "plate px-2")}>
      {rows.map(({ entry, own }) => (
        <SeasonRow
          key={entry.address}
          rank={entry.rank}
          order={entry.order}
          name={<PlayerName account={entry.address} you={own} portrait />}
          sitesCleared={entry.sites_cleared.total}
          lords={wholeLords(entry.rewards.lords)}
          own={own}
          onOpen={() => navigate(`/p/${entry.address}`)}
        />
      ))}
    </section>
  );
};

/** The player's finished Blitz games, newest first; a row opens its Results. Signed out, there are none to list. */
const BlitzGames = ({ framed = true }: { framed?: boolean }) => {
  const { data: player } = useRealmsPlayer();
  const history = useRecentResults(BLITZ_GAMES, player);
  const now = useNowSeconds();
  if (!player) return null;
  if (history.isError)
    return <ServiceFailure service="results" error={history.error} retry={() => void history.refetch()} />;
  if (history.isPending) return <Loading />;
  const games = history.data.games.filter((game) => game.mode === "blitz");
  return (
    <ul className={cn(framed && "plate px-2")}>
      {games.map((game) => (
        <HistoryRow key={`${game.chainId}:${game.game_id}`} game={game} player={player} now={now} />
      ))}
    </ul>
  );
};
