import { useEventsFilter } from "@/hooks/store/use-events-filter-store";
import { HudButton } from "@/ui/design-system/kit/hud-elements";
import type { EventsFilter } from "./event-stories";

/** Each filter's word, and what it shows, on its hover. */
const FILTERS: { id: EventsFilter; word: string; tip: string }[] = [
  {
    id: "important",
    word: "Important",
    tip: "Your fights and captures, armies lost, crates you opened, refused orders and the game's milestones",
  },
  { id: "mine", word: "Mine", tip: "Everything about you: your actions, your realms' news and what happened to them" },
  { id: "all", word: "All", tip: "Everything Events holds, other players' fights included" },
];

/** The player's one filter for Events and the Log: the same choice in both, remembered for them on this device. */
export const EventsFilterSwitch = () => {
  const [filter, choose] = useEventsFilter();
  return (
    <span role="group" aria-label="Event filter" className="inline-flex items-center gap-1">
      {FILTERS.map(({ id, word, tip }) => (
        <HudButton
          key={id}
          kind="quiet"
          size="sm"
          aria-pressed={filter === id}
          data-tip={tip}
          onClick={() => choose(id)}
        >
          {word}
        </HudButton>
      ))}
    </span>
  );
};
