import { RESOURCE_PRECISION } from "@bibliothecadao/types";

const PRECISION = BigInt(RESOURCE_PRECISION);

/** One side's whole troops before and after a battle. */
type TroopsChange = { before: number; after: number };

/** What a battle did to both sides, as the battle's own story records it: the attacker's army and whoever it fought. */
interface FightRecord {
  army: TroopsChange;
  guard: TroopsChange;
}

/** A battle story's record; null for a payload that is no battle's. */
export const battleRecordOf = (payload: Record<string, unknown>): FightRecord | null => {
  const army = troopsOf(payload.attacker);
  const guard = troopsOf(payload.defender);
  return army && guard ? { army, guard } : null;
};

/** One side's whole troops before and after the battle, as its story carries them in game precision. */
const troopsOf = (side: unknown): TroopsChange | null => {
  if (!side || typeof side !== "object" || !("before" in side) || !("after" in side)) return null;
  const whole = (count: unknown) => Number(BigInt(String(count)) / PRECISION);
  return { before: whole(side.before), after: whole(side.after) };
};
