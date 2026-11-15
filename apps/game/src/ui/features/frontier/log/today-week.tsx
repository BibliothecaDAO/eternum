import { Icon } from "@/ui/design-system/icon";
import { HudChip } from "@/ui/design-system/kit/hud-elements";
import { OPENING_WORDS } from "@/ui/design-system/kit/words";

import type { WeekDay } from "./quest-week";

/** The week's seven quests as a row of chips: today's marked, a past day's reward ticked when it was taken. */
export const TodayWeek = ({ week }: { week: readonly WeekDay[] }) => (
  <section data-today-week aria-label={OPENING_WORDS.week} className="flex flex-wrap items-center gap-1.5">
    {week.map(({ day, quest, when, collected }) => (
      <span key={day} data-week-day={when} data-tip={OPENING_WORDS.weekDay(day, quest.name)}>
        <HudChip icons={[quest.icon]} tone={when === "today" ? "good" : undefined}>
          {day}
          {collected && <Icon name="check" size={14} />}
        </HudChip>
      </span>
    ))}
  </section>
);
