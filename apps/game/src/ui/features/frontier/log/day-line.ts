import {
  builtLine,
  deployedLine,
  disbandedLine,
  EXPLORED,
  ESSENCE,
  LABOR,
  revealLine,
  xpGainedLine,
} from "@/ui/design-system/kit/words";
import { siteClearXp, configManager, findGain, readRevealXp } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { formatExact, LORDS, ResourcesIds, scaledToUnits } from "@bibliothecadao/types";

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
 * Each story that moved XP says how much, as the contract counted it: a reveal's `reveal_xp`, a clear's XP from the
 * guard its site started with, a point spent keeps XP unchanged.
 */
export const dayLogLine = (story: LoggedStory, store: NativeFactStore): string | null => {
  const payload = story.storyPayload;
  switch (story.story) {
    case "BattleEvent":
      return fightLogLine(story, store) ?? story.presentation.title;
    case "ExplorationReward":
      return withRevealXp(revealPayLine(payload) ?? story.presentation.title, payload.coord, store);
    case "SitePayout":
      return withClearXp(story.presentation.title, payload.site_id, store);
    case "SkillPointSpent":
      return story.presentation.title;
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

/** The recorded tile keeps historical XP correct after an army changes depth or leaves the map. */
const withRevealXp = (line: string, coord: unknown, store: NativeFactStore): string => {
  if (!coord || typeof coord !== "object" || !("y" in coord)) return line;
  const xp = readRevealXp(store, configManager.getActiveGameId(), { y: Number(coord.y) });
  return xp === undefined ? line : xpGainedLine(line, formatExact(xp));
};

/** A clear's line with the XP it paid: the site's starting guard sets it, so it needs the site's row; else the title. */
const withClearXp = (line: string, siteId: unknown, store: NativeFactStore): string => {
  if (siteId === undefined) return line;
  const site = store.get("ExpeditionSite", { game_id: configManager.getActiveGameId(), entity_id: Number(siteId) });
  return site ? xpGainedLine(line, formatExact(siteClearXp(site))) : line;
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
