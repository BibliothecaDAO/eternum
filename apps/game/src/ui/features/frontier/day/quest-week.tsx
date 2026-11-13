import { useGame } from "@/hooks/context/game-context";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { questMeaning } from "@/ui/design-system/domain-icon-meaning";
import { Icon } from "@/ui/design-system/icon";
import { HudChip, HudPanel, HudRow } from "@/ui/design-system/kit/hud-elements";
import { DAY, QUEST_WORDS } from "@/ui/design-system/kit/words";
import { readQuestWeek } from "@bibliothecadao/eternum";
import { safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { formatAmount } from "@bibliothecadao/types";

import { QUEST_MODELS } from "./day-banner";

type WeekDay = NonNullable<ReturnType<typeof readQuestWeek>>["days"][number];
/** Where a day of the week stands for the home. */
type DayState = keyof typeof QUEST_WORDS.state;

/**
 * Today's page's week of quests (the opening interface's Essence moment opens it): each day of the week's bag with its
 * quest's painting and name (a bane day's bane quest), and where it stands: collected, done, missed, today, or coming.
 * A day whose rows the snapshot has not settled says it is reading. Nothing in a game without quests.
 */
export const QuestWeek = ({ realm }: { realm: NativeRows["Structure"] }) => {
  const { setup } = useGame();
  useNativeRevision(QUEST_MODELS);
  const week = readQuestWeek(setup.store, realm.game_id, safeInteger(realm.entity_id), useNowSeconds());
  if (!week) return null;
  return (
    <HudPanel title={QUEST_WORDS.week} label={QUEST_WORDS.week} collapsible={false} bodyClassName="flex flex-col gap-1">
      {week.days.map((day) => {
        const state = dayState(day, week.today);
        const { quest } = day;
        return (
          <HudRow
            key={day.day}
            lead={quest && <Icon name={questMeaning(quest.id)} size={28} />}
            title={quest?.name ?? QUEST_WORDS.readingDay}
            detail={`${DAY} ${formatAmount(day.day + 1)}`}
            trail={state && <HudChip tone={QUEST_STATE_TONES[state]}>{QUEST_WORDS.state[state]}</HudChip>}
          />
        );
      })}
    </HudPanel>
  );
};

const QUEST_STATE_TONES = {
  collected: "good",
  done: "good",
  missed: "bad",
  today: undefined,
  coming: undefined,
} as const satisfies Record<DayState, "good" | "bad" | undefined>;

/** A day's standing: later days are coming and today is today; a past day's, only once its reading is known. */
const dayState = (day: WeekDay, today: number): DayState | null => {
  if (day.day > today) return "coming";
  if (day.day === today) return "today";
  const reading = day.reading.known;
  if (!reading) return null;
  return reading.claimed ? "collected" : reading.completed ? "done" : "missed";
};
