import { NO_END } from "@/ui/design-system/kit/words";
import { ResourcesIds, formatDuration } from "@bibliothecadao/types";

// ==================== CONSTANTS ====================

export const ALWAYS_SHOW_RESOURCES = [
  ResourcesIds.Lords,
  ResourcesIds.Research,
  ResourcesIds.Labor,
  ResourcesIds.Essence,
  ResourcesIds.Donkey,
  ResourcesIds.Fish,
  ResourcesIds.Wheat,
];

// Resources that don't show time remaining (because they can be produced indefinitely)
export const HIDE_TIME_REMAINING_FOR = [ResourcesIds.Labor];

/** How long a production runs on: a duration, or its own state when it never runs out. */
export const productionTimeLeft = (seconds: number): string =>
  seconds === Number.POSITIVE_INFINITY ? NO_END : formatDuration(seconds);
