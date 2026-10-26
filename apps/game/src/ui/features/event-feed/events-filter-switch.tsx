import { useEventsFilter } from "@/hooks/store/use-events-filter-store";
import { HudButton } from "@/ui/design-system/kit/hud-elements";
import { EVENTS_WORDS } from "@/ui/design-system/kit/words";
import type { EventsFilter } from "./event-stories";

const LENSES = Object.keys(EVENTS_WORDS.lenses) as EventsFilter[];

/** The two lenses, Important and All, the one shown lit, each saying on its hover what it shows: the same in every mode. */
export const LensSwitch = ({ lens, onLens }: { lens: EventsFilter; onLens: (lens: EventsFilter) => void }) => (
  <span role="group" aria-label={EVENTS_WORDS.lens} className="inline-flex items-center gap-1">
    {LENSES.map((id) => (
      <HudButton
        key={id}
        kind="quiet"
        size="sm"
        aria-pressed={lens === id}
        data-tip={EVENTS_WORDS.lensTips[id]}
        onClick={() => onLens(id)}
      >
        {EVENTS_WORDS.lenses[id]}
      </HudButton>
    ))}
  </span>
);

/** The player's one lens for Events and the Log: the same choice in both, remembered for them on this device. */
export const EventsFilterSwitch = () => {
  const [filter, choose] = useEventsFilter();
  return <LensSwitch lens={filter} onLens={choose} />;
};
