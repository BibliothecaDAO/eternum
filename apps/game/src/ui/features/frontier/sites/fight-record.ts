import { streamedStoriesOf } from "@/hooks/store/use-story-events-store";
import { RESOURCE_PRECISION, type ResourcesIds } from "@bibliothecadao/types";

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

/** What a cleared site paid home: the resource and its whole amount, as the contract set it for the site. */
type PayoutRecord = { resourceId: ResourcesIds; amount: number };

/**
 * What the action's clear paid, by its transaction, from the payout story the contract emits with the winning
 * battle: the reward, null for a site that pays none (beasts, or a ruin, whose chest is its own), and undefined
 * when no payout story of that transaction reached this client.
 */
export const readPayoutRecord = (transactionHash: string): PayoutRecord | null | undefined => {
  const payout = streamedStoriesOf(transactionHash).find(({ story }) => story === "SitePayout");
  if (!payout) return undefined;
  const reward = payout.storyPayload.reward;
  if (reward === null) return null;
  if (!reward || typeof reward !== "object" || !("resource_type" in reward) || !("amount" in reward))
    throw new Error("Malformed site payout reward");
  return { resourceId: Number(reward.resource_type), amount: Number(BigInt(String(reward.amount)) / PRECISION) };
};

/** One side's whole troops before and after the battle, as its story carries them in game precision. */
const troopsOf = (side: unknown): TroopsChange | null => {
  if (!side || typeof side !== "object" || !("before" in side) || !("after" in side)) return null;
  const whole = (count: unknown) => Number(BigInt(String(count)) / PRECISION);
  return { before: whole(side.before), after: whole(side.after) };
};
