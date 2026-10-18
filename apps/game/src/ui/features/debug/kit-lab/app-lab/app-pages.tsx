import {
  AppButton,
  AppChip,
  AppFrame,
  AppPageHead,
  AppPanel,
  type AppPlace,
} from "@/ui/design-system/kit/app-elements";
import type { Painting } from "@/ui/design-system/kit/paintings";
import type { ReactNode } from "react";

import {
  Backdrop,
  BlitzBoard,
  Breakdown,
  Chat,
  Chest,
  Entry,
  FrontierBoard,
  GameRow,
  gamesOf,
  LeadCard,
  Outcome,
  Registered,
  ResultBoard,
  Seats,
  Standing,
} from "./app-blocks";
import { AGE_OF, type LabAge, PLAYER } from "./app-lab-data";

/**
 * The desktop app at 1920×1080, the four most-used pages each in the direction the owner picked (18 October 2026):
 * Play in B Ages, the Blitz lobby and Results in C Ledger, Season in A Launcher, every one under the bar across the top
 * with the player at its right end. One look across them: each stands on its painting (the age or mode it shows, else
 * the app's landscape), its panels translucent over it, with icons on places, panels, verbs and figures. Built from
 * the app sheet's elements, before any page of the app moves onto them.
 */

export const APP_PAGES = ["play", "lobby", "season", "results", "results-opened"] as const;
export type AppPage = (typeof APP_PAGES)[number];

type PageLayout = {
  name: string;
  /** The direction it was picked from, and what that does with the desktop's width. */
  direction: string;
  render: () => ReactNode;
};

/** A page's 1920×1080 screen: the app's surface, its age's colours where it shows one game, the frame on its painting. */
const Screen = ({
  current,
  painting,
  age,
  children,
}: {
  current: AppPlace;
  painting: Painting;
  age?: LabAge;
  children: ReactNode;
}) => (
  <div
    data-surface="shell"
    data-age={age}
    data-app-page
    className="relative flex h-[1080px] w-[1920px] overflow-hidden bg-app-ground font-body text-app-ink"
  >
    <AppFrame current={current} player={PLAYER} painting={painting}>
      {children}
    </AppFrame>
  </div>
);

/** B · Ages: the ages side by side as tall painted columns, the one to act on widest. */
const Play = () => (
  <Screen current="play" painting="dark-plains">
    <div className="grid min-h-0 flex-1 grid-cols-[1.5fr_1fr_1fr] gap-6">
      <LeadCard className="h-full" />
      {(["blitz", "eternum"] as const).map((age) => (
        <AgeColumn key={age} age={age} />
      ))}
    </div>
  </Screen>
);

/** One age's column on Play: its painting, its name, its games. */
const AgeColumn = ({ age }: { age: LabAge }) => (
  <section
    data-age={age}
    className="relative flex min-h-0 flex-col overflow-hidden rounded-[var(--app-radius-panel)] border border-app-line shadow-[var(--app-shadow-panel)]"
  >
    <Backdrop age={age} />
    <div className="relative mt-auto flex flex-col gap-3 bg-[linear-gradient(0deg,var(--app-age-to)_70%,transparent)] p-6 pt-24">
      <span className="text-app-label text-[rgb(var(--app-age))]">Age {AGE_OF[age].numeral}</span>
      <h2 className="text-app-title text-app-ink">{AGE_OF[age].name}</h2>
      <div className="flex flex-col rounded-[var(--app-radius-control)] bg-app-well">
        {gamesOf(age).map((game) => (
          <GameRow key={game.title} game={game} />
        ))}
      </div>
    </div>
  </section>
);

/** C · Ledger: who is in, the entry and the chat, side by side under the slot's head, on Blitz's painting. */
const Lobby = () => (
  <Screen current="play" painting="blitz-spires" age="blitz">
    <AppPageHead
      title="Blitz 16:30"
      back={() => undefined}
      aside={
        <span className="flex gap-2">
          <AppChip tone="warn">Entry open</AppChip>
          <AppChip icon="hourglass">Closes in 2:03:57</AppChip>
        </span>
      }
    />
    <div className="grid grid-cols-12 items-start gap-6">
      <AppPanel title="Who is in" icon="people" className="col-span-5">
        <div className="flex flex-col gap-6">
          <Registered />
          <Seats />
        </div>
      </AppPanel>
      <AppPanel title="Entry" icon="lords" className="col-span-4">
        <Entry />
      </AppPanel>
      <AppPanel title="Chat" icon="chat" className="col-span-3">
        <Chat />
      </AppPanel>
    </div>
  </Screen>
);

/** A · Launcher: the player's three figures over the two boards side by side, each under its mode's painting. */
const Season = () => (
  <Screen current="season" painting="winter-fortress">
    <AppPageHead title="Season 3" aside={<AppChip icon="hourglass">Day 12 · ends 9 Dec</AppChip>} />
    <AppPanel>
      <Standing />
    </AppPanel>
    <div className="grid min-h-0 flex-1 grid-cols-2 items-start gap-6">
      <div data-age="frontier">
        <AppPanel
          title="Frontier"
          icon="leaderboard"
          painting={AGE_OF.frontier.painting}
          cue="Sites cleared · LORDS"
          flush
        >
          <FrontierBoard />
        </AppPanel>
      </div>
      <div data-age="blitz">
        <AppPanel
          title="Blitz"
          icon="leaderboard"
          painting={AGE_OF.blitz.painting}
          cue="Rating · Pool 765,900 LORDS"
          flush
        >
          <BlitzBoard />
        </AppPanel>
      </div>
    </div>
  </Screen>
);

/** C · Ledger: the outcome and the chest at its tier, then the board and the points, on the game's painting. */
const Results = ({ opened }: { opened: boolean }) => (
  <Screen current="play" painting="blitz-spires" age="blitz">
    <AppPageHead
      title="Results · Blitz 11:00"
      back={() => undefined}
      aside={
        <span className="flex gap-2">
          <AppButton kind="quiet" icon="share">
            Share
          </AppButton>
          <AppButton kind="secondary" icon="play">
            Continue
          </AppButton>
        </span>
      }
    />
    <div className="grid grid-cols-12 items-stretch gap-6">
      <AppPanel className="col-span-8">
        <Outcome />
      </AppPanel>
      <AppPanel title="Your chest" icon="chest" className="col-span-4 row-span-2">
        <Chest opened={opened} />
      </AppPanel>
      <AppPanel title="The game" icon="leaderboard" flush className="col-span-4">
        <ResultBoard />
      </AppPanel>
      <AppPanel title="Your points" icon="star" flush className="col-span-4">
        <Breakdown />
      </AppPanel>
    </div>
  </Screen>
);

export const PAGE_LAYOUTS: Record<AppPage, PageLayout> = {
  play: {
    name: "Play",
    direction: "B · Ages: the ages side by side as tall painted columns, the one to act on widest.",
    render: Play,
  },
  lobby: {
    name: "Blitz lobby",
    direction: "C · Ledger: who is in, the entry and the chat in three columns, on Blitz's painting.",
    render: Lobby,
  },
  season: {
    name: "Season",
    direction: "A · Launcher: the player's three figures over Frontier's and Blitz's boards, each under its painting.",
    render: Season,
  },
  results: {
    name: "Results",
    direction: "C · Ledger: the outcome and the sealed chest at its tier, then the game's board and the points.",
    render: () => <Results opened={false} />,
  },
  "results-opened": {
    name: "Results, the chest opened",
    direction: "C · Ledger: the same page once the chest is opened: its opened art and what it paid.",
    render: () => <Results opened />,
  },
};
