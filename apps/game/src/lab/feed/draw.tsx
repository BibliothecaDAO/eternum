import { GameProvider } from "@/hooks/context/game-context";
import { usePlayerNames } from "@/hooks/use-player-profile";
import { useHudMode } from "@/hooks/use-hud-mode";
import { HudBubble, HudPanel } from "@/ui/design-system/kit/hud-elements";
import { EVENTS_WORDS } from "@/ui/design-system/kit/words";
import { FeedRowLine } from "@/ui/features/event-feed/feed-row-line";
import { involvesPlayer } from "@/ui/features/event-feed/event-stories";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { feedRuns, readFeedStory } from "./feed-reading";
import { FeedPanel, FeedRows } from "./options";
import { answerRecordedNames, installRecordedGame, RECORDED_FEED, recordedStories } from "./recorded-feed";
import { FRAMES, type StillDevice, type StillFrame } from "./stills";

/** Where the stills open the page: two stories before its first exploration paying under one unit. */
const windowStart = (stories: ReturnType<typeof recordedStories>) =>
  Math.max(
    0,
    stories.findIndex(
      (story) => story.story === "ExplorationReward" && BigInt(String(story.storyPayload.amount)) < 1_000_000_000n,
    ) - 2,
  );

/**
 * Dev only: one frame of the Feed's stills (HUD → Feed · to pick shows them), drawn for the capture
 * (`pnpm --dir apps/game capture:feed`): today's Feed or an option's (`frame`), on a desktop rail or a phone
 * (`device`), open or closed (`closed=1`), from the same story of prod's recorded page. Not a page to read: the pick
 * page shows its screenshots.
 */
export const FeedDrawView = () => {
  useHudMode("frontier");
  const [params] = useSearchParams();
  const frame = (FRAMES as readonly string[]).includes(params.get("frame") ?? "")
    ? (params.get("frame") as StillFrame)
    : "today";
  const device: StillDevice = params.get("device") === "phone" ? "phone" : "desktop";
  const closed = params.get("closed") === "1";
  const [store] = useState(installRecordedGame);
  const [restore] = useState(answerRecordedNames);
  useEffect(() => restore, [restore]);
  const names = usePlayerNames();
  const all = useMemo(() => recordedStories(store, names), [store, names]);
  const stories = useMemo(() => all.slice(windowStart(all)), [all]);
  const readings = useMemo(() => stories.map((story) => readFeedStory(story, store)), [stories, store]);
  const runs = useMemo(() => feedRuns(readings, stories), [readings, stories]);
  // Named once every player's name has come back, so a capture never takes "…".
  const ready = Object.keys(RECORDED_FEED.names).every((address) => names.reading(address).state === "named");
  const rows =
    frame === "today" ? (
      <div className="flex flex-col">
        {stories.map((story) => (
          <FeedRowLine key={story.id} event={story} own={involvesPlayer(story, RECORDED_FEED.viewer)} />
        ))}
      </div>
    ) : (
      <FeedRows option={frame} readings={readings} runs={runs} names={names} viewer={RECORDED_FEED.viewer} />
    );
  return (
    <GameProvider value={{ store, systemCalls: {} } as never} account={{ address: RECORDED_FEED.viewer } as never}>
      <div className="inline-block bg-hud-dark p-2 font-sans text-hud-ink" data-still={ready ? "ready" : "waiting"}>
        {device === "desktop" ? (
          <Rail today={frame === "today"} closed={closed}>
            {rows}
          </Rail>
        ) : (
          <Phone today={frame === "today"} closed={closed}>
            {rows}
          </Phone>
        )}
      </div>
    </GameProvider>
  );
};

/** A desktop's rail at 1440 × 900: from under the top bar to over the foot's places. */
const RAIL = { width: 480, height: 720 };
const PHONE = { width: 390, height: 844 };

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
const Rail = ({ today, closed, children }: { today: boolean; closed: boolean; children: ReactNode }) => (
  <div className="flex flex-col items-center gap-2">
    <div className="flex flex-col gap-2 p-2" style={{ width: RAIL.width, height: RAIL.height }} data-rail>
      <NextUp />
      {!closed &&
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
          <FeedPanel onClose={() => undefined}>{children}</FeedPanel>
        ))}
      <ChatStrip />
    </div>
    <HudBubble icon="chronicles" word={EVENTS_WORDS.feed} pressed={!closed} aria-label={EVENTS_WORDS.feed} />
  </div>
);

/**
 * A phone at its size: the strip, the Feed as a page between it and the place bar, the place bar. Today the place is the
 * Log; every option names it the Feed (the owner, 26 Oct: "Rename mobile log to feed as well btw it should be the
 * same").
 */
const Phone = ({ today, closed, children }: { today: boolean; closed: boolean; children: ReactNode }) => (
  <div
    className="flex flex-col overflow-hidden rounded-[28px] border border-hud-line-strong bg-hud-night"
    style={{ width: PHONE.width, height: PHONE.height }}
    data-phone
  >
    <div className="ui ui-panel m-2 shrink-0 px-3 py-2 text-hud-label">Day 7 · 2h 56m left</div>
    <div className="flex min-h-0 flex-1 flex-col px-2">
      {!closed &&
        (today ? (
          <HudPanel
            label="Log"
            title="Log"
            icon="chronicles"
            collapsible={false}
            className="flex min-h-0 flex-1 flex-col"
            bodyClassName="min-h-0 flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin"
          >
            {children}
          </HudPanel>
        ) : (
          <FeedPanel onClose={() => undefined}>{children}</FeedPanel>
        ))}
    </div>
    <nav aria-label="Phone places" className="flex shrink-0 justify-center gap-4 p-2">
      <HudBubble
        icon="chronicles"
        word={today ? "Log" : EVENTS_WORDS.feed}
        pressed={!closed}
        aria-label={today ? "Log" : EVENTS_WORDS.feed}
      />
    </nav>
  </div>
);
