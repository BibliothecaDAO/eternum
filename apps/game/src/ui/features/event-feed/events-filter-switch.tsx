import { useEventsFilter } from "@/hooks/store/use-events-filter-store";
import { HudChoice } from "@/ui/design-system/kit/hud-elements";
import { EVENTS_WORDS } from "@/ui/design-system/kit/words";
import type { EventsFilter, FeedLens } from "./event-stories";

type LensWords<Lens extends string> = { names: Record<Lens, string>; tips: Record<Lens, string> };

/** Blitz's Events and Log: Important, then All. */
const EVENTS_LENSES: LensWords<EventsFilter> = { names: EVENTS_WORDS.lenses, tips: EVENTS_WORDS.lensTips };

/**
 * The lenses, the one shown lit, each saying on its hover what it shows, in the order and words of `words` (Blitz's
 * Events: Important, then All; Frontier's Feed: All, Important, then Mine).
 */
export const LensSwitch = <Lens extends string>({
  lens,
  onLens,
  words,
}: {
  lens: Lens;
  onLens: (lens: Lens) => void;
  words: LensWords<Lens>;
}) => (
  <HudChoice
    label={EVENTS_WORDS.lens}
    value={lens}
    options={(Object.keys(words.names) as Lens[]).map((id) => ({ value: id, label: words.names[id], tip: words.tips[id] }))}
    onChange={onLens}
  />
);

/** Frontier's Feed: All, its default, first; then Important; then Mine. */
export const FEED_LENSES: LensWords<FeedLens> = { names: EVENTS_WORDS.feedLenses, tips: EVENTS_WORDS.feedLensTips };

/** The player's one lens for Events and the Log: the same choice in both, remembered for them on this device. */
export const EventsFilterSwitch = () => {
  const [filter, choose] = useEventsFilter();
  return <LensSwitch lens={filter} onLens={choose} words={EVENTS_LENSES} />;
};
