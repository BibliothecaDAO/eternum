import { useEventsFilter } from "@/hooks/store/use-events-filter-store";
import { HUD_LABEL } from "@/ui/design-system/atoms/hud-typography";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import type { EventsFilter } from "./important-feed-rows";

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
export const EventsFilterSwitch = ({ className }: { className?: string }) => {
  const [filter, choose] = useEventsFilter();
  return (
    <span role="group" aria-label="Event filter" className={cn("inline-flex items-center gap-2", className)}>
      {FILTERS.map(({ id, word, tip }) => (
        <button
          type="button"
          key={id}
          aria-pressed={filter === id}
          data-tip={tip}
          onClick={() => choose(id)}
          className={cn("font-sans", HUD_LABEL, filter === id ? "text-gold" : "text-gold/45 hover:text-gold/80")}
        >
          {word}
        </button>
      ))}
    </span>
  );
};
