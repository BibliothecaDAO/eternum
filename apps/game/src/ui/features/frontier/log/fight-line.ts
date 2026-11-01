import { fightLine } from "@/ui/design-system/kit/words";
import { configManager, siteDisplayName } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { formatExact, fightVerdict, VERDICT_WORDS } from "@bibliothecadao/types";

import { battleRecordOf, type FightRecord } from "../sites/fight-record";

/**
 * The day log's line for one of the player's attacks on a site, from its battle story: the site by its one name
 * (siteDisplayName, as its map label, its clear and every story name it), how the attack ended
 * (the result card's own word), the troops it cost and the guard before and after. Null for any other story, or a
 * battle whose defender is no site this client knows.
 */
export const fightLogLine = (
  story: { story: string; storyPayload: Record<string, unknown> },
  store: NativeFactStore,
): string | null => {
  if (story.story !== "BattleEvent") return null;
  const record = battleRecordOf(story.storyPayload);
  const site = siteWord(store, story.storyPayload.defender_id);
  if (!record || !site) return null;
  const { army, guard } = record;
  const verdict = VERDICT_WORDS[fightVerdict({ army: army.after, guard: guard.after })];
  return fightLine(site, verdict, troopsLost(record), formatExact(guard.before), formatExact(guard.after));
};

/** The troops a fight cost its attacker, as its line writes them: "68"; null for a story that is no fight. */
export const fightCost = (story: { story: string; storyPayload: Record<string, unknown> }): string | null => {
  const record = story.story === "BattleEvent" ? battleRecordOf(story.storyPayload) : null;
  return record && troopsLost(record);
};

const troopsLost = ({ army }: FightRecord): string => formatExact(army.before - army.after);

/** The site by its one name, once its expedition row (which outlives the Structure its clear removes) says it is one. */
const siteWord = (store: NativeFactStore, entityId: unknown): string | null => {
  const id = Number(entityId);
  const site = store.get("ExpeditionSite", { game_id: configManager.getActiveGameId(), entity_id: id });
  return site ? siteDisplayName(id) : null;
};
