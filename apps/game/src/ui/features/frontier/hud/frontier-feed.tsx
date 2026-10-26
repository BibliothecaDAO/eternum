import { useAccountStore } from "@/hooks/store/use-account-store";
import { useStoryEvents } from "@/hooks/store/use-story-events-store";
import { HudButton, HudIconButton, HudNotice, HudPanel } from "@/ui/design-system/kit/hud-elements";
import { EVENTS_WORDS } from "@/ui/design-system/kit/words";
import { involvesPlayer, oneStoryPerAction } from "@/ui/features/event-feed/event-stories";
import { FeedLine } from "@/ui/features/event-feed/feed-line";
import { useEventsFeed } from "@/ui/features/event-feed/quick-feed";
import { useIsWatching } from "@/utils/can-issue-orders";
import { useState } from "react";

/** How far back the world's history reads: the newest stories, as the Log read them. */
const WORLD_STORIES = 350;

type Lens = keyof typeof EVENTS_WORDS.lenses;
const LENSES = Object.keys(EVENTS_WORDS.lenses) as Lens[];

/**
 * Frontier's one feed, in the desktop's rail and as the phone's Feed page (the owner, 22 October: "the world history is
 * more interesting than just the events"; 26 October: "Rename mobile log to feed as well btw it should be the same"):
 * the world's history live, who did what on every line, the player's own in gold, with Mine and Important as lenses on
 * it (a spectator, with nothing of their own, has no Mine). It fills its place as any other panel does and scrolls
 * inside; its × closes it (owner, 26 October: "I should also be able to close the feed so I see nothing on the right
 * panel sometimes ? and feed height can be the same as the other panels").
 */
export const FrontierFeed = ({ onClose }: { onClose: () => void }) => {
  const [lens, setLens] = useState<Lens>("world");
  const watching = useIsWatching();
  return (
    <HudPanel
      label={EVENTS_WORDS.feed}
      title={EVENTS_WORDS.feed}
      icon="chronicles"
      collapsible={false}
      cue={
        <span className="inline-flex items-center gap-1">
          <span role="group" aria-label="Feed lens" className="inline-flex items-center gap-1">
            {LENSES.filter((id) => !(watching && id === "mine")).map((id) => (
              <HudButton
                key={id}
                kind="quiet"
                size="sm"
                aria-pressed={lens === id}
                data-tip={EVENTS_WORDS.lensTips[id]}
                onClick={() => setLens(id)}
              >
                {EVENTS_WORDS.lenses[id]}
              </HudButton>
            ))}
          </span>
          <HudIconButton icon="close" label={EVENTS_WORDS.closeFeed} kind="quiet" size="sm" onClick={onClose} />
        </span>
      }
      className="pointer-events-auto flex min-h-0 flex-1 flex-col"
      bodyClassName="min-h-0 flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin"
    >
      {lens === "world" ? <WorldStories /> : <LensStories lens={lens} />}
    </HudPanel>
  );
};

/** The world's history, newest first, each action once; the player's own in gold. */
const WorldStories = () => {
  const address = useAccountStore((state) => state.account?.address ?? null);
  const world = useStoryEvents(WORLD_STORIES);
  const stories = oneStoryPerAction(world.data);
  if (world.isError) return <HudNotice tone="bad" line={EVENTS_WORDS.failed} retry={() => void world.refetch()} />;
  if (stories.length === 0) return <p className="text-hud-label text-hud-muted">{EVENTS_WORDS.nothingYet}</p>;
  return (
    <div className="flex flex-col">
      {stories.map((event) => (
        <FeedLine key={event.id} story={event} own={involvesPlayer(event, address)} />
      ))}
    </div>
  );
};

/** What Mine or Important holds, as Events reads it. */
const LensStories = ({ lens }: { lens: Exclude<Lens, "world"> }) => {
  const address = useAccountStore((state) => state.account?.address ?? null);
  const events = useEventsFeed(lens);
  if (events.isError) return <HudNotice tone="bad" line={EVENTS_WORDS.failed} retry={events.retry} />;
  if (events.stories.length === 0) return <p className="text-hud-label text-hud-muted">{EVENTS_WORDS.nothingYet}</p>;
  return (
    <div className="flex flex-col">
      {events.stories.map((event) => (
        <FeedLine key={event.id} story={event} own={involvesPlayer(event, address)} />
      ))}
    </div>
  );
};
