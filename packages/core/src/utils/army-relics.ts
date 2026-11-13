import type { NativeFactStore } from "../client/native-fact-store";

/**
 * Whether a game's ruins pay army relics, for current and historical releases: a day game whose preset carries no
 * LORDS chest rules. Undefined while that cannot be told: the rules not held yet, or no ChestRules row before the
 * snapshot is complete, when its absence proves nothing.
 */
export function armyRelicsEnabled(
  store: Pick<NativeFactStore, "get" | "subscriptionScope">,
  gameId: number,
): boolean | undefined {
  const rules = store.get("SliceRules", { game_id: gameId });
  if (!rules) return undefined;
  if (rules.day_unit_seconds === 0) return false;
  if (store.get("ChestRules", { game_id: gameId })) return false;
  // A shared row lies in every scope: once the snapshot's scope is known, a missing one is absent.
  return store.subscriptionScope().known ? true : undefined;
}
