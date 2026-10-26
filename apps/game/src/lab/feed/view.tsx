import { GameProvider } from "@/hooks/context/game-context";
import { usePlayerNames } from "@/hooks/use-player-profile";
import { useHudMode } from "@/hooks/use-hud-mode";
import { HudBubble, HudPanel, HudTabs } from "@/ui/design-system/kit/hud-elements";
import { EVENTS_WORDS } from "@/ui/design-system/kit/words";
import { FeedRowLine } from "@/ui/features/event-feed/feed-row-line";
import { involvesPlayer } from "@/ui/features/event-feed/event-stories";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { feedRuns, readFeedStory } from "./feed-reading";
import { type FeedOption, FeedPanel, FeedRows } from "./options";
import { answerRecordedNames, installRecordedGame, RECORDED_FEED, recordedStories } from "./recorded-feed";

/** Each option: its name, and the one sentence that says what it changes. */
const FEED_OPTIONS: Record<FeedOption, { name: string; line: string }> = {
  a: {
    name: "A · Named lines",
    line: "Today's line, led by who did it, with the act's own painting and the reward at the end.",
  },
  b: {
    name: "B · Who, act, what",
    line: "A strategy game's kill feed: the player's face, the act as a painting, what it was done to as a painting.",
  },
  c: {
    name: "C · One card per run",
    line: "A player's run of play as one card: their explorations summed in one line, every other act below it.",
  },
};

/** A desktop's rail at 1440 × 900: from under the top bar to over the foot's places. */
const RAIL = { width: 480, height: 720 };
const PHONE = { width: 390, height: 844 };

/**
 * Dev only: the Feed's options for the owner to pick (26 Oct 2026, HUD → Feed · to pick), each beside today's Feed, on
 * prod's recorded page (recorded-feed.ts): who did what on every row, a reward under one without its amount, and a Feed
 * that closes and fills the rail. `option` names the option, the lab's `device` the frames.
 */
export const FeedLabView = () => {
  useHudMode("frontier");
  const [params, setParams] = useSearchParams();
  const option = (["a", "b", "c"] as const).find((key) => key === params.get("option")) ?? "a";
  const device = params.get("device") ?? "both";
  const [store] = useState(installRecordedGame);
  const [restore] = useState(answerRecordedNames);
  useEffect(() => restore, [restore]);
  const names = usePlayerNames();
  const stories = useMemo(() => recordedStories(store, names), [store, names]);
  const readings = useMemo(() => stories.map((story) => readFeedStory(story, store)), [stories, store]);
  const runs = useMemo(() => feedRuns(readings, stories), [readings, stories]);
  const choose = (key: string) =>
    setParams((current) => {
      current.set("option", key);
      return current;
    });
  const rows = <FeedRows option={option} readings={readings} runs={runs} names={names} viewer={RECORDED_FEED.viewer} />;
  const today = (
    <div className="flex flex-col">
      {stories.map((story) => (
        <FeedRowLine key={story.id} event={story} own={involvesPlayer(story, RECORDED_FEED.viewer)} />
      ))}
    </div>
  );
  return (
    <GameProvider value={{ store, systemCalls: {} } as never} account={{ address: RECORDED_FEED.viewer } as never}>
      <main className="min-h-full bg-hud-dark p-4 font-sans text-hud-ink" data-lab="feed">
        <header className="mb-3 flex flex-col gap-1">
          <h1 className="text-hud-title">The Feed: who did what, on every row</h1>
          <p className="max-w-[72rem] text-hud-label text-hud-muted">
            Prod's Frontier feed as it read on {RECORDED_FEED.pulledAt.slice(0, 16).replace("T", " ")} UTC:{" "}
            {stories.length} stories of {Object.keys(RECORDED_FEED.names).length} players, seen by djizus (gold).
            Today's Feed on the left; the option on the right. Every option closes (×, then the Feed bubble opens it
            again) and fills the rail as Research and the Season do.
          </p>
        </header>
        <HudTabs
          tabs={(Object.keys(FEED_OPTIONS) as FeedOption[]).map((key) => ({ key, label: FEED_OPTIONS[key].name }))}
          value={option}
          onChange={choose}
        />
        <p className="my-2 text-hud-body">{FEED_OPTIONS[option].line}</p>
        <div className="flex flex-wrap items-start gap-6">
          {device !== "phone" && (
            <>
              <Frame caption="Today · desktop rail">
                <Rail today>{today}</Rail>
              </Frame>
              <Frame caption={`${FEED_OPTIONS[option].name} · desktop rail`}>
                <Rail key={option}>{rows}</Rail>
              </Frame>
            </>
          )}
          {device !== "desktop" && (
            <Frame caption={`${FEED_OPTIONS[option].name} · phone`}>
              <Phone key={option}>{rows}</Phone>
            </Frame>
          )}
        </div>
      </main>
    </GameProvider>
  );
};

const Frame = ({ caption, children }: { caption: string; children: ReactNode }) => (
  <figure className="flex flex-col gap-1">
    {children}
    <figcaption className="text-hud-label text-hud-muted">{caption}</figcaption>
  </figure>
);

/** What stands above the Feed in the rail, as the game draws it there. */
const NextUp = () => (
  <HudPanel label="Next up" title="Next up" icon="flag" collapsible={false} className="shrink-0">
    <p className="text-hud-body">Your army can explore: each new tile sends Essence or labor home and gives 2 XP.</p>
  </HudPanel>
);

const ChatStrip = () => (
  <div className="ui ui-panel mt-auto shrink-0 px-3 py-2 text-hud-label text-hud-muted">Sign in to chat</div>
);

/**
 * A desktop rail at its size: Next up, the Feed, chat at its foot; under it, the Feed's bubble among the places. Today's
 * Feed keeps its cap (45% of the screen: 405 px of 900) and has no ×; an option's fills the rail and closes.
 */
const Rail = ({ today = false, children }: { today?: boolean; children: ReactNode }) => {
  const [open, setOpen] = useState(true);
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="flex flex-col gap-2 rounded-lg border border-dashed border-hud-line p-2"
        style={{ width: RAIL.width, height: RAIL.height }}
        data-rail={today ? "today" : "option"}
        data-feed-open={open}
      >
        <NextUp />
        {open &&
          (today ? (
            <HudPanel
              label={EVENTS_WORDS.feed}
              title={EVENTS_WORDS.feed}
              icon="chronicles"
              collapsible={false}
              className="flex min-h-0 flex-col"
              bodyClassName="min-h-0 max-h-[405px] overflow-y-auto overflow-x-hidden scrollbar-thin"
            >
              {children}
            </HudPanel>
          ) : (
            <FeedPanel onClose={() => setOpen(false)}>{children}</FeedPanel>
          ))}
        <ChatStrip />
      </div>
      <HudBubble
        icon="chronicles"
        word={EVENTS_WORDS.feed}
        pressed={open}
        aria-label={EVENTS_WORDS.feed}
        disabled={today}
        onClick={() => setOpen(!open)}
      />
    </div>
  );
};

/** A phone at its size: the strip, the Feed as a page between it and the place bar, the place bar with the Feed. */
const Phone = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(true);
  return (
    <div
      className="flex flex-col overflow-hidden rounded-[28px] border border-hud-line-strong bg-hud-night"
      style={{ width: PHONE.width, height: PHONE.height }}
      data-phone
      data-feed-open={open}
    >
      <div className="ui ui-panel m-2 shrink-0 px-3 py-2 text-hud-label">Day 7 · 2h 56m left</div>
      <div className="flex min-h-0 flex-1 flex-col px-2">
        {open && <FeedPanel onClose={() => setOpen(false)}>{children}</FeedPanel>}
      </div>
      <nav aria-label="Phone places" className="flex shrink-0 justify-center gap-4 p-2">
        <HudBubble
          icon="chronicles"
          word={EVENTS_WORDS.feed}
          pressed={open}
          aria-label={EVENTS_WORDS.feed}
          onClick={() => setOpen(!open)}
        />
      </nav>
    </div>
  );
};
