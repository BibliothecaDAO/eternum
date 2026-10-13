import { streamedStoriesOf } from "@/hooks/store/use-story-events-store";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";

const PRECISION = BigInt(RESOURCE_PRECISION);

/** One side's whole troops before and after a battle. */
export type TroopsChange = { before: number; after: number };

/** What a battle did to both sides, as the battle's own story records it: the attacker's army and whoever it fought. */
export interface FightRecord {
  army: TroopsChange;
  guard: TroopsChange;
}

/** A battle story's record; null for a payload that is no battle's. */
export const battleRecordOf = (payload: Record<string, unknown>): FightRecord | null => {
  const army = troopsOf(payload.attacker);
  const guard = troopsOf(payload.defender);
  return army && guard ? { army, guard } : null;
};

/**
 * The battle an action fought, by its transaction. The story travels with the action's facts, so it is here once the
 * action's outcome is known; undefined when no story of that transaction reached this client.
 */
export const readFightRecord = (transactionHash: string): FightRecord | undefined => {
  for (const { story, storyPayload } of streamedStoriesOf(transactionHash)) {
    const record = story === "BattleEvent" ? battleRecordOf(storyPayload) : null;
    if (record) return record;
  }
  return undefined;
};

/** One side's whole troops before and after the battle, as its story carries them in game precision. */
const troopsOf = (side: unknown): TroopsChange | null => {
  if (!side || typeof side !== "object" || !("before" in side) || !("after" in side)) return null;
  const whole = (count: unknown) => Number(BigInt(String(count)) / PRECISION);
  return { before: whole(side.before), after: whole(side.after) };
};
