import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { cn } from "@/ui/design-system/atoms/lib/utils";

import { PlayerName } from "@/ui/design-system/kit/player-name";
import { SeasonRow } from "@/ui/design-system/kit/season-row";
import { StateCard } from "@/ui/design-system/kit/state-card";
import { ViewSwitch } from "@/ui/design-system/kit/view-switch";
import { DAY } from "@/ui/design-system/kit/words";
import { boardRows, wholeLords } from "@/ui/features/frontier/board/standings";

import { useLayout } from "../frame/layout";
import { openedFrom } from "../frame/opened-from";
import { PageFrame } from "../frame/page-frame";
import { type DirectoryGame, useDirectory, useLeaderboard, useRealmsPlayer } from "../herald";
import { Loading } from "../loading";
import { Panel } from "@/ui/design-system/kit/panel";
import { Title } from "@/ui/design-system/kit/title";
import { ageOf } from "../play/ages";
import { chooseSeason, directoryDay, seasonTitle } from "../season";
import { ServiceFailure } from "@/ui/design-system/kit/service-failure";
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
          <Panel
            icon="victory"
            title={ageOf("frontier").name}
            aside={season && <DayLine season={season} className="font-normal" />}
          >
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
  <StateCard painting="brooding-plains" image="md" pad="4" sizes="50vw">
    <p className="font-body text-xl font-bold text-kit-cream">{WORDS.noSeason}</p>
  </StateCard>
);

/** The season's day by the hourglass, "Day 12", on the clock. */
const DayLine = ({ season, className }: { season: DirectoryGame; className?: string }) => {
  const now = useNowSeconds();
  return (
    <span className={cn("flex items-center gap-1 text-base text-kit-muted", className)}>
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
  return (
    <Title level="header" face="body" className="flex items-center gap-2">
      <SemanticIcon name="victory" size={26} />
      {season ? seasonTitle(season) : WORDS.season}
      {season && <DayLine season={season} className="ml-auto" />}
    </Title>
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
