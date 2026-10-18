import { AppButton, AppChip, AppPageHead, AppPanel, AppTabs } from "@/ui/design-system/kit/app-elements";
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
  LobbyClock,
  Outcome,
  Registered,
  ResultBoard,
  Seats,
  SideRail,
  Standing,
  TopBar,
} from "./app-blocks";
import { AGE_OF, type LabAge } from "./app-lab-data";

/**
 * The desktop app's three directions at 1920×1080, each applied to the four most-used pages (Play, the Blitz lobby,
 * Season, Results), built from the same app sheet elements and page parts so the owner compares layouts alone.
 */

export const DIRECTION_PAGES = ["play", "lobby", "season", "results"] as const;
export type DirectionPage = (typeof DIRECTION_PAGES)[number];

export const PAGE_NAMES: Record<DirectionPage, string> = {
  play: "Play",
  lobby: "Blitz lobby",
  season: "Season",
  results: "Results",
};

type Direction = {
  name: string;
  /** The direction in one line: what it does with the desktop's width. */
  idea: string;
  pages: Record<DirectionPage, () => ReactNode>;
};

/** A page's 1920×1080 frame, the app's surface, its age's colours where it shows one game. */
const Screen = ({ age, children }: { age?: LabAge; children: ReactNode }) => (
  <div
    data-surface="shell"
    data-age={age}
    data-app-direction-page
    className="relative flex h-[1080px] w-[1920px] overflow-hidden bg-app-ground font-body text-app-ink"
  >
    {children}
  </div>
);

/* ── A. Launcher: a rail down the side, the page fills the rest. ── */

const LauncherPage = ({ current, age, children }: { current: string; age?: LabAge; children: ReactNode }) => (
  <Screen age={age}>
    <SideRail current={current} />
    <main className="relative flex min-w-0 flex-1 flex-col gap-6 p-10">{children}</main>
  </Screen>
);

const LAUNCHER: Direction = {
  name: "A · Launcher",
  idea: "A rail down the side holds the places and the player; the page fills the rest. Play leads with the game to act on, then every other age's games side by side and the season beside them.",
  pages: {
    play: () => (
      <LauncherPage current="play">
        <LeadCard />
        <div className="grid min-h-0 flex-1 grid-cols-3 gap-6">
          {(["blitz", "eternum"] as const).map((age) => (
            <div key={age} data-age={age}>
              <AppPanel
                title={AGE_OF[age].name}
                icon="play"
                cue={`Age ${AGE_OF[age].numeral}`}
                flush
                className="h-full"
              >
                {gamesOf(age).map((game) => (
                  <GameRow key={game.title} game={game} />
                ))}
              </AppPanel>
            </div>
          ))}
          <AppPanel title="This season" icon="victory" cue="Season 3 · Day 12" className="h-full">
            <Standing layout="column" />
          </AppPanel>
        </div>
      </LauncherPage>
    ),
    lobby: () => (
      <LauncherPage current="play" age="blitz">
        <Backdrop age="blitz" />
        <AppPageHead title="Blitz 16:30" back={() => undefined} aside={<AppChip tone="warn">Entry open</AppChip>} />
        <div className="relative grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_480px] gap-6">
          <div className="flex flex-col gap-6">
            <AppPanel title="Who is in" icon="person" cue="Up to 24 a game">
              <Registered />
            </AppPanel>
            <AppPanel title="Chat" icon="chat" className="flex-1">
              <Chat />
            </AppPanel>
          </div>
          <AppPanel title="Entry" icon="lords" cue="Closes 16:30">
            <div className="flex flex-col gap-6">
              <LobbyClock />
              <Entry />
            </div>
          </AppPanel>
        </div>
      </LauncherPage>
    ),
    season: () => (
      <LauncherPage current="season">
        <AppPageHead title="Season 3" aside={<AppChip icon="hourglass">Day 12 · ends 9 Dec</AppChip>} />
        <AppPanel>
          <Standing />
        </AppPanel>
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-6">
          <div data-age="frontier">
            <AppPanel title="Frontier" icon="victory" cue="Sites cleared · LORDS" flush>
              <FrontierBoard rows={10} />
            </AppPanel>
          </div>
          <div data-age="blitz">
            <AppPanel title="Blitz" icon="victory" cue="Pool 765,900 LORDS" flush>
              <BlitzBoard />
            </AppPanel>
          </div>
        </div>
      </LauncherPage>
    ),
    results: () => (
      <LauncherPage current="you" age="blitz">
        <Backdrop age="blitz" />
        <AppPageHead title="Results" />
        <div className="relative grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_440px_400px] gap-6">
          <div className="flex flex-col justify-between">
            <Outcome />
            <div className="flex gap-3">
              <AppButton kind="secondary" size="lg">
                Continue
              </AppButton>
              <AppButton kind="quiet" size="lg" icon="share">
                Share
              </AppButton>
            </div>
          </div>
          <AppPanel title="The game" icon="victory" flush>
            <ResultBoard />
            <Breakdown />
          </AppPanel>
          <AppPanel title="Your chest" icon="chest">
            <Chest />
          </AppPanel>
        </div>
      </LauncherPage>
    ),
  },
};

/* ── B. Ages: the places across the top, each page on its age's painting, the ages side by side. ── */

const AgesPage = ({ current, age, children }: { current: string; age?: LabAge; children: ReactNode }) => (
  <Screen age={age}>
    <div className="flex min-w-0 flex-1 flex-col">
      <TopBar current={current} />
      <main className="relative flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  </Screen>
);

const AGES: Direction = {
  name: "B · Ages",
  idea: "The places across the top; each page stands on its age's painting. Play is the three ages side by side, the one to act on widest.",
  pages: {
    play: () => (
      <AgesPage current="play">
        <div className="grid min-h-0 flex-1 grid-cols-[1.5fr_1fr_1fr] gap-6 p-10">
          <LeadCard className="h-full" />
          {(["blitz", "eternum"] as const).map((age) => (
            <div
              key={age}
              data-age={age}
              className="relative flex min-h-0 flex-col overflow-hidden rounded-[var(--app-radius-panel)] border border-app-line"
            >
              <Backdrop age={age} strength="full" />
              <div className="relative mt-auto flex flex-col gap-3 bg-[linear-gradient(0deg,var(--app-age-to)_70%,transparent)] p-6 pt-24">
                <span className="text-app-label text-[rgb(var(--app-age))]">Age {AGE_OF[age].numeral}</span>
                <h2 className="text-app-title text-app-ink">{AGE_OF[age].name}</h2>
                <div className="flex flex-col rounded-[var(--app-radius-control)] bg-app-well">
                  {gamesOf(age).map((game) => (
                    <GameRow key={game.title} game={game} />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </AgesPage>
    ),
    lobby: () => (
      <AgesPage current="play" age="blitz">
        <Backdrop age="blitz" strength="full" />
        <div className="relative flex min-h-0 flex-1 flex-col justify-between p-10">
          <div className="flex items-start justify-between">
            <AppPageHead title="Blitz 16:30" back={() => undefined} />
            <div className="text-right">
              <LobbyClock />
            </div>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_560px_420px] items-end gap-6">
            <AppPanel title="Who is in" icon="person">
              <Registered />
            </AppPanel>
            <AppPanel title="Entry" icon="lords">
              <Entry />
            </AppPanel>
            <AppPanel title="Chat" icon="chat">
              <Chat />
            </AppPanel>
          </div>
        </div>
      </AgesPage>
    ),
    season: () => (
      <AgesPage current="season">
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-6 p-10">
          {(["frontier", "blitz"] as const).map((age) => (
            <div
              key={age}
              data-age={age}
              className="flex min-h-0 flex-col overflow-hidden rounded-[var(--app-radius-panel)] border border-app-line bg-app-surface"
            >
              <div className="relative h-48 flex-none">
                <Backdrop age={age} strength="full" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-6">
                  <div>
                    <span className="text-app-label text-[rgb(var(--app-age))]">
                      Season 3 · Age {AGE_OF[age].numeral}
                    </span>
                    <h2 className="text-app-title text-app-ink">{AGE_OF[age].name}</h2>
                  </div>
                  {age === "frontier" ? (
                    <AppChip tone="gold">You: #12 of 1,240</AppChip>
                  ) : (
                    <AppChip tone="gold">You: 1,744 · Conqueror</AppChip>
                  )}
                </div>
              </div>
              {age === "frontier" ? <FrontierBoard rows={10} /> : <BlitzBoard />}
            </div>
          ))}
        </div>
      </AgesPage>
    ),
    results: () => (
      <AgesPage current="you" age="blitz">
        <Backdrop age="blitz" strength="full" />
        <div className="relative grid min-h-0 flex-1 grid-cols-[1fr_minmax(0,720px)_1fr] items-center gap-10 p-10">
          <span />
          <div className="flex flex-col items-center gap-8 rounded-[var(--app-radius-panel)] bg-app-surface p-10">
            <Outcome align="center" />
            <Chest />
            <AppButton kind="secondary" size="lg">
              Continue
            </AppButton>
          </div>
          <AppPanel title="The game" icon="victory" flush>
            <ResultBoard />
          </AppPanel>
        </div>
      </AgesPage>
    ),
  },
};

/* ── C. Ledger: the places across the top, a twelve-column grid of panels; everything at a glance, nothing hidden. ── */

const LedgerPage = ({ current, age, children }: { current: string; age?: LabAge; children: ReactNode }) => (
  <Screen age={age}>
    <div className="flex min-w-0 flex-1 flex-col">
      <TopBar current={current} />
      <main className="mx-auto grid min-h-0 w-full max-w-[1680px] flex-1 auto-rows-min grid-cols-12 content-start gap-6 p-10">
        {children}
      </main>
    </div>
  </Screen>
);

const LEDGER: Direction = {
  name: "C · Ledger",
  idea: "The places across the top, then a twelve-column grid of panels: the now, the schedule of every age in one table, the player's standing and news beside them.",
  pages: {
    play: () => (
      <LedgerPage current="play">
        <LeadCard size="tile" className="col-span-8" />
        <AppPanel title="This season" icon="victory" className="col-span-4">
          <Standing layout="column" />
        </AppPanel>
        <AppPanel
          title="Schedule"
          icon="hourglass"
          cue={
            <AppTabs
              label="Ages"
              value="all"
              tabs={[
                { key: "all", label: "All" },
                { key: "blitz", label: "Blitz", dot: true },
                { key: "frontier", label: "Frontier" },
                { key: "eternum", label: "Eternum" },
              ]}
            />
          }
          flush
          className="col-span-8"
        >
          {gamesOf().map((game) => (
            <div key={game.title} data-age={game.age}>
              <GameRow game={game} />
            </div>
          ))}
        </AppPanel>
        <AppPanel title="What's new" icon="chronicles" flush className="col-span-4">
          <GameRowLike title="Season 3 opens the spires" detail="2 days ago" />
          <GameRowLike title="Sword and shield entries" detail="5 days ago" />
          <GameRowLike title="Frontier's day, explained" detail="1 week ago" />
        </AppPanel>
      </LedgerPage>
    ),
    lobby: () => (
      <LedgerPage current="play" age="blitz">
        <div className="col-span-12">
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
        </div>
        <AppPanel title="Who is in" icon="person" className="col-span-5">
          <div className="flex flex-col gap-6">
            <Registered />
            <Seats />
          </div>
        </AppPanel>
        <AppPanel title="Entry" icon="lords" className="col-span-4">
          <Entry verbSize="md" />
        </AppPanel>
        <AppPanel title="Chat" icon="chat" className="col-span-3">
          <Chat />
        </AppPanel>
      </LedgerPage>
    ),
    season: () => (
      <LedgerPage current="season">
        <div className="col-span-12">
          <AppPageHead title="Season 3" aside={<AppChip icon="hourglass">Day 12 · ends 9 Dec</AppChip>} />
        </div>
        <AppPanel
          title="Standings"
          icon="victory"
          cue={
            <AppTabs
              label="Board"
              value="frontier"
              tabs={[
                { key: "frontier", label: "Frontier" },
                { key: "blitz", label: "Blitz" },
              ]}
            />
          }
          flush
          className="col-span-8"
        >
          <FrontierBoard />
        </AppPanel>
        <div className="col-span-4 flex flex-col gap-6">
          <AppPanel title="You" icon="person">
            <Standing layout="column" />
          </AppPanel>
          <AppPanel title="Blitz prize" icon="lords" cue="Pool 765,900">
            <p className="text-app-body text-app-muted">50 places paid. Claim when the season ends.</p>
          </AppPanel>
        </div>
      </LedgerPage>
    ),
    results: () => (
      <LedgerPage current="you" age="blitz">
        <div className="col-span-12">
          <AppPageHead
            title="Results · Blitz 11:00"
            aside={
              <span className="flex gap-2">
                <AppButton kind="quiet" icon="share">
                  Share
                </AppButton>
                <AppButton kind="secondary">Continue</AppButton>
              </span>
            }
          />
        </div>
        <AppPanel className="col-span-8">
          <Outcome />
        </AppPanel>
        <AppPanel title="Your chest" icon="chest" className="col-span-4 row-span-2">
          <Chest />
        </AppPanel>
        <AppPanel title="The game" icon="victory" flush className="col-span-4">
          <ResultBoard />
        </AppPanel>
        <AppPanel title="Your points" icon="flag" flush className="col-span-4">
          <Breakdown />
        </AppPanel>
      </LedgerPage>
    ),
  },
};

/** A list entry with only words: a post on What's new. */
const GameRowLike = ({ title, detail }: { title: string; detail: string }) => (
  <div className="flex flex-col border-b border-app-line px-5 py-3 last:border-0">
    <span className="text-app-strong text-app-ink">{title}</span>
    <span className="text-app-label text-app-muted">{detail}</span>
  </div>
);

export const DIRECTIONS = { launcher: LAUNCHER, ages: AGES, ledger: LEDGER } as const;
export type DirectionKey = keyof typeof DIRECTIONS;
