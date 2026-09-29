import type { NativeFactResult, NativeFactStore } from "../client/native-fact-store";
import { absoluteEpoch, readExpeditionRules } from "./expeditions";
import { supportBonusPercent } from "./production-output";

/**
 * The realm's Support boost for the day containing `timestamp`, in percent of its production: its earned daily maximum
 * (RealmSupport), none where the day earned nothing. Unknown while the realm's scope is; a game without expedition days
 * has no Support.
 */
export const realmSupportPercent = (
  store: Pick<NativeFactStore, "get" | "requireOrAbsent">,
  gameId: number,
  structureId: number,
  timestamp: number,
): NativeFactResult<number> => {
  const rules = readExpeditionRules(store, gameId);
  if (!rules) return { known: 0 };
  const support = store.requireOrAbsent("RealmSupport", {
    game_id: gameId,
    structure_id: structureId,
    epoch: BigInt(absoluteEpoch(rules, timestamp)),
  });
  return support.known ? { known: supportBonusPercent(support.known.level) } : { unknown: support.unknown };
};
