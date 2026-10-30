import { useAccountStore } from "@/hooks/store/use-account-store";
import { HudNotice, HudPage } from "@/ui/design-system/kit/hud-elements";
import { EVENTS_WORDS } from "@/ui/design-system/kit/words";
import { type FeedLens, involvesPlayer } from "@/ui/features/event-feed/event-stories";
import { FEED_LENSES, LensSwitch } from "@/ui/features/event-feed/events-filter-switch";
import { FeedLine } from "@/ui/features/event-feed/feed-line";
import { useFeedStories } from "@/ui/features/event-feed/quick-feed";
import { useState } from "react";

/**
 * Frontier's one feed, in the desktop's rail and as the phone's Feed page (the owner, 22 October: "the world history is
 * more interesting than just the events"; 26 October: "Rename mobile log to feed as well btw it should be the same"):
 * the world's history live (All, first and the default), who did what on every line, the player's own rows in gold in
 * every lens; Important, anyone's notable stories; Mine, the player's own (owner, 27 October: "All / Important (battles
 * but not just mine), then mine ? and when a row is mine should put the row in yellow"). It fills its place as any other panel does and scrolls
 * inside; its × closes it (owner, 26 October: "I should also be able to close the feed so I see nothing on the right
 * panel sometimes ? and feed height can be the same as the other panels").
 */
export const FrontierFeed = ({ onClose }: { onClose: () => void }) => {
  const [lens, setLens] = useState<FeedLens>("all");
  return (
    <HudPage
      label={EVENTS_WORDS.feed}
      icon="chronicles"
      cue={<LensSwitch lens={lens} onLens={setLens} words={FEED_LENSES} />}
      onClose={onClose}
      bodyClassName="gap-0 overflow-x-hidden scrollbar-thin"
    >
      <FeedStories lens={lens} />
    </HudPage>
  );
};

/** What the lens shows, newest first, each action once; the player's own rows in gold. */
const FeedStories = ({ lens }: { lens: FeedLens }) => {
  const address = useAccountStore((state) => state.account?.address ?? null);
  const events = useFeedStories(lens);
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
