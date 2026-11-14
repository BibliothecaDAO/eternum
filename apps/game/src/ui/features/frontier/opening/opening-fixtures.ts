import type { OpeningRules } from "@/ui/design-system/kit/words";

/** Season 1's rules a line names: a Barracks raises 100 Knights an hour; a Deep tick is 120 seconds and costs 200 troops. */
export const OPENING_RULES: OpeningRules = { knightsAnHour: 100, deepTick: { tickSeconds: 120, lossPerTick: 200 } };
