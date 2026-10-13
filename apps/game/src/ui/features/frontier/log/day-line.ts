import { formatExact } from "@/ui/design-system/kit/amount";
import {
  builtLine,
  deployedLine,
  disbandedLine,
  ESSENCE,
  LABOR,
  LORDS,
  revealLine,
} from "@/ui/design-system/kit/words";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";

import { frontierBuildingName } from "../build/building-names";
import { armyLabel } from "../hud/dock-armies";
import { fightLogLine } from "./fight-line";

/** A story as the day's log reads it: what it is, what it carries, and the line every mode gives it. */
type LoggedStory = { story: string; storyPayload: Record<string, unknown>; presentation: { title: string } };

/** What a reveal sends home, by the kit's word for it. */
const REVEAL_WORDS: Partial<Record<number, string>> = {
  [ResourcesIds.Essence]: ESSENCE,
  [ResourcesIds.Labor]: LABOR,
  [ResourcesIds.Lords]: LORDS,
};

/**
 * The day log's line for one of the player's stories, in the names the rest of Frontier uses: a fight by its site and
 * how it ended, a reveal's pay as a whole number, a building by its build card's name, an army by its number. Null for
 * a story that only repeats another (a building's placement beside its payment); any other story keeps its title.
 */
export const dayLogLine = (story: LoggedStory, store: NativeFactStore): string | null => {
  const payload = story.storyPayload;
  switch (story.story) {
    case "BattleEvent":
      return fightLogLine(story, store) ?? story.presentation.title;
    case "ExplorationReward":
      return revealPayLine(payload) ?? story.presentation.title;
    case "BuildingPaymentStory":
      return builtLineOf(payload) ?? story.presentation.title;
    case "BuildingPlacementStory":
      return payload.change === "Created" ? null : story.presentation.title;
    case "ExplorerCreateStory":
      return deployedLine(armyLabel(store, Number(payload.explorer_id)));
    case "ExplorerDeleteStory":
      return disbandedLine(armyLabel(store, Number(payload.explorer_id)));
    default:
      return story.presentation.title;
  }
};

/** "Farm built": the building by the name on its build card. */
const builtLineOf = (payload: Record<string, unknown>): string | null => {
  const name = frontierBuildingName(Number(payload.category));
  return name ? builtLine(name) : null;
};

/** "+98 labor": what the reveal paid, in whole units as the totals above the log count it. */
const revealPayLine = (payload: Record<string, unknown>): string | null => {
  const word = REVEAL_WORDS[Number(payload.resource_type)];
  if (!word) return null;
  const whole = BigInt(String(payload.amount)) / BigInt(RESOURCE_PRECISION);
  return revealLine(formatExact(Number(whole)), word);
};
