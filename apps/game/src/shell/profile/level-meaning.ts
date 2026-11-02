import { levelLine } from "@/ui/design-system/kit/words";
import { kindsAtLevel, NOTIFICATION_LEVELS, type NotificationLevel } from "@bibliothecadao/notifications";

/** What a level brings beyond the one below it, from the kinds table the server delivers by. */
export const levelMeaning = (level: NotificationLevel): string => {
  const below = NOTIFICATION_LEVELS[NOTIFICATION_LEVELS.indexOf(level) - 1] ?? null;
  const carried = below === null ? [] : kindsAtLevel(below);
  return levelLine(
    kindsAtLevel(level).filter((kind) => !carried.includes(kind)),
    below,
  );
};
