import {
  builtLine,
  clearCostLine,
  deployedLine,
  disbandedLine,
  EXPLORED,
  ESSENCE,
  LABOR,
  revealLine,
} from "@/ui/design-system/kit/words";
import { findGain } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { LORDS, type RankedWords, ResourcesIds, scaledToUnits } from "@bibliothecadao/types";

import { frontierBuildingName } from "../build/building-names";
import { armyLabel } from "../hud/dock-armies";
import { fightCost, fightLogLine } from "./fight-line";

/** A story as the day's log reads it: what it is, what it carries, and the line every mode gives it. */
type LoggedStory = {
  story: string;
  storyPayload: Record<string, unknown>;
  presentation: { title: string; ranked?: { title: RankedWords } };
};

/** A story's own title, its ranks as parts where it names one ("Battle II"). */
const titleOf = (story: LoggedStory): RankedWords | string =>
  story.presentation.ranked?.title ?? story.presentation.title;

/** What a reveal sends home, by the kit's word for it. */
const REVEAL_WORDS: Partial<Record<number, string>> = {
  [ResourcesIds.Essence]: ESSENCE,
  [ResourcesIds.Labor]: LABOR,
  [ResourcesIds.Lords]: LORDS,
};

export const dayLogLine = (story: LoggedStory, store: NativeFactStore, fight?: LoggedStory): RankedWords | string => {
  const payload = story.storyPayload;
  switch (story.story) {
    case "BattleEvent":
      return fightLogLine(story, store) ?? story.presentation.title;
    case "ExplorationReward":
      return revealPayLine(payload) ?? story.presentation.title;
    case "SitePayout":
      return withFightCost(story.presentation.title, fight);
    case "BuildingPaymentStory":
      return builtLineOf(payload) ?? story.presentation.title;
    case "ExplorerCreateStory":
      return deployedLine(armyLabel(store, Number(payload.explorer_id)));
    case "ExplorerDeleteStory":
      return disbandedLine(armyLabel(store, Number(payload.explorer_id)));
    default:
      return titleOf(story);
  }
};

/** A clear's line with what the attack that won it cost, when the day holds that attack. */
const withFightCost = (line: string, fight: LoggedStory | undefined): string => {
  const lost = fight && fightCost(fight);
  return lost ? clearCostLine(line, lost) : line;
};

/** "Farm built": the building by the name on its build card. */
const builtLineOf = (payload: Record<string, unknown>): string | null => {
  const name = frontierBuildingName(Number(payload.category));
  return name ? builtLine(name) : null;
};

/**
 * "+98 labor": what the reveal paid, written as the panel and the Log write it (scaledToUnits, one rounding); under a
 * unit, "Explored" with no amount, by the feed's own rule for a find (findGain).
 */
const revealPayLine = (payload: Record<string, unknown>): string | null => {
  const word = REVEAL_WORDS[Number(payload.resource_type)];
  if (!word) return null;
  const gain = findGain(scaledToUnits(BigInt(String(payload.amount))));
  return gain === null ? EXPLORED : revealLine(gain, word);
};
