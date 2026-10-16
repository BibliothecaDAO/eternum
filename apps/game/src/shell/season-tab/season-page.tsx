import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { cn } from "@/ui/design-system/atoms/lib/utils";

import { PlayerName } from "@/ui/design-system/kit/player-name";
import { SeasonRow } from "@/ui/design-system/kit/season-row";
import { ViewSwitch } from "@/ui/design-system/kit/view-switch";
import { DAY } from "@/ui/design-system/kit/words";
import { boardRows, wholeLords } from "@/ui/features/frontier/board/standings";

import { useLayout } from "../frame/layout";
import { openedFrom } from "../frame/opened-from";
import { PageFrame } from "../frame/page-frame";
import { type DirectoryGame, useDirectory, useLeaderboard, useRealmsPlayer } from "../herald";
import { Loading } from "../loading";
import { paintingSources } from "../paintings";
import { Panel } from "../panel";
import { ageOf } from "../play/ages";
import { chooseSeason, directoryDay, seasonTitle } from "../season";
import { ServiceFailure } from "../service-failure";
import { useNowSeconds } from "../use-now";
import { SEASON_WORDS, WORDS } from "../words";
import { BlitzBoard } from "./blitz-board";

type SeasonView = "frontier" | "blitz";

/** How many of the board's rows a layout shows before the player's own row is pinned under them. */
const ROWS_SHOWN = { phone: 12, desktop: 15 } as const;

/**
 * Season (spec 09): where the player stands this season, one board per mode: Frontier's season board, and Blitz's
 * rating with the season prize each place would take. A switch above the one board on a phone; the desktop shows both
 * side by side. The player's own finished games are on You.
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
        {view === "frontier" ? <FrontierBoard rowsShown={ROWS_SHOWN.phone} /> : <BlitzBoard />}
      </div>
    </PageFrame>
  );
};

/** The desktop's Season: the season's title above, Frontier's board on the left with its day, Blitz's on the right. */
const DesktopSeason = () => {
  const { season, directory } = useSeason();
  return (
    <PageFrame title={season ? seasonTitle(season) : WORDS.season}>
      <div className="grid grid-cols-[minmax(0,1fr)_34rem] items-start gap-6">
        {season || directory.isPending || directory.isError ? (
          <Panel icon="victory" title={ageOf("frontier").name} aside={season && <SeasonDay season={season} />}>
            <FrontierBoard rowsShown={ROWS_SHOWN.desktop} framed={false} />
          </Panel>
        ) : (
          <NoSeason />
        )}
        <BlitzBoard />
      </div>
    </PageFrame>
  );
};

/** No Frontier season runs: the plains and the one line that says so. */
const NoSeason = () => (
  <section className="plate flex flex-col gap-4 p-4">
    <img {...paintingSources("brooding-plains")} sizes="50vw" alt="" className="h-40 w-full rounded-xl object-cover" />
    <p className="font-body text-xl font-bold text-kit-cream">{WORDS.noSeason}</p>
  </section>
);

const SeasonDay = ({ season }: { season: DirectoryGame }) => {
  const now = useNowSeconds();
  return (
    <span className="flex items-center gap-1 text-base font-normal text-kit-muted">
      <SemanticIcon name="hourglass" size={20} />
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
    <h1 className="flex items-center gap-2 font-body text-xl font-bold text-kit-cream">
      <SemanticIcon name="victory" size={26} />
      {season ? seasonTitle(season) : WORDS.season}
      {season && (
        <span className="ml-auto flex items-center gap-1 text-base text-kit-muted">
          <SemanticIcon name="hourglass" size={20} />
          {`${DAY} ${day ?? "—"}`}
        </span>
      )}
    </h1>
  );
};

/** Frontier's board: its first rows, the player's own lit in place, or pinned under them when it ranks below. */
const FrontierBoard = ({ rowsShown, framed = true }: { rowsShown: number; framed?: boolean }) => {
  const navigate = useNavigate();
  const here = useLocation();
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
          onOpen={() => navigate(`/p/${entry.address}`, { state: openedFrom(here) })}
        />
      ))}
    </section>
  );
};
