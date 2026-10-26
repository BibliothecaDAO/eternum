import { useAccountStore } from "@/hooks/store/use-account-store";
import { HudIconButton, HudNotice, HudPanel } from "@/ui/design-system/kit/hud-elements";
import { EVENTS_WORDS } from "@/ui/design-system/kit/words";
import { type EventsFilter, involvesPlayer } from "@/ui/features/event-feed/event-stories";
import { LensSwitch } from "@/ui/features/event-feed/events-filter-switch";
import { FeedLine } from "@/ui/features/event-feed/feed-line";
import { useEventsFeed } from "@/ui/features/event-feed/quick-feed";
import { useState } from "react";

/**
 * Frontier's one feed, in the desktop's rail and as the phone's Feed page (the owner, 22 October: "the world history is
 * more interesting than just the events"; 26 October: "Rename mobile log to feed as well btw it should be the same"):
 * the world's history live (All), who did what on every line, the player's own in gold, and Important, what they must
 * not miss, the two lenses Blitz's Events have too. It fills its place as any other panel does and scrolls
 * inside; its × closes it (owner, 26 October: "I should also be able to close the feed so I see nothing on the right
 * panel sometimes ? and feed height can be the same as the other panels").
 */
export const FrontierFeed = ({ onClose }: { onClose: () => void }) => {
  const [lens, setLens] = useState<EventsFilter>("all");
  return (
    <HudPanel
      label={EVENTS_WORDS.feed}
      title={EVENTS_WORDS.feed}
      icon="chronicles"
      collapsible={false}
      cue={
        <span className="inline-flex items-center gap-1">
          <LensSwitch lens={lens} onLens={setLens} />
          <HudIconButton icon="close" label={EVENTS_WORDS.closeFeed} kind="quiet" size="sm" onClick={onClose} />
        </span>
      }
      className="pointer-events-auto flex min-h-0 flex-1 flex-col"
      bodyClassName="min-h-0 flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin"
    >
      <FeedStories lens={lens} />
    </HudPanel>
  );
};

/** What the lens shows, newest first, each action once; the player's own in gold. */
const FeedStories = ({ lens }: { lens: EventsFilter }) => {
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
