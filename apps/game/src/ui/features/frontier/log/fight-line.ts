import { formatExact } from "@/ui/design-system/kit/amount";
import { fightLine } from "@/ui/design-system/kit/words";
import { configManager } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { RESOURCE_PRECISION, StructureType } from "@bibliothecadao/types";

import { fightVerdict } from "../sites/fight-result";
import { VERDICT_WORDS } from "../sites/fight-result-card";
import { TARGET_MARKS } from "../sites/site-marks";

const PRECISION = BigInt(RESOURCE_PRECISION);

/**
 * The day log's line for one of the player's attacks on a site, from its battle story: the site, how the attack ended
 * (the result card's own word), the troops it cost and the guard before and after. Null for any other story, or a
 * battle whose defender is no site this client knows.
 */
export const fightLogLine = (
  story: { story: string; storyPayload: Record<string, unknown> },
  store: NativeFactStore,
): string | null => {
  if (story.story !== "BattleEvent") return null;
  const army = troopsOf(story.storyPayload.attacker);
  const guard = troopsOf(story.storyPayload.defender);
  const site = siteWord(store, story.storyPayload.defender_id);
  if (!army || !guard || !site) return null;
  const verdict = VERDICT_WORDS[fightVerdict({ army: army.after, guard: guard.after })];
  return fightLine(
    site,
    verdict,
    formatExact(army.before - army.after),
    formatExact(guard.before),
    formatExact(guard.after),
  );
};

/** One side's whole troops before and after the battle, as its story carries them in game precision. */
const troopsOf = (side: unknown): { before: number; after: number } | null => {
  if (!side || typeof side !== "object" || !("before" in side) || !("after" in side)) return null;
  const whole = (count: unknown) => Number(BigInt(String(count)) / PRECISION);
  return { before: whole(side.before), after: whole(side.after) };
};

const siteWord = (store: NativeFactStore, entityId: unknown): string | null => {
  const structure = store.get("Structure", { game_id: configManager.getActiveGameId(), entity_id: Number(entityId) });
  const kind = structure && StructureType[structure.base.category];
  return kind && kind in TARGET_MARKS ? TARGET_MARKS[kind as keyof typeof TARGET_MARKS].word : null;
};
