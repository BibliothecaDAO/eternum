import type { NativeFactStore } from "../client/native-fact-store";
import { isDeepTile } from "./deep-geometry";
import { entityMapPosition } from "./tile";

/** The same Frontier boundary for the map's order and the selected target's card. */
export function armyCombatRefusal(
  store: Pick<NativeFactStore, "get" | "require" | "entityOccupancy">,
  attacker: { game_id: number; explorer_id: number | bigint },
  defender: { game_id: number; explorer_id: number | bigint },
): "no-attack" | "allied" | undefined {
  const game_id = attacker.game_id;
  if (game_id !== defender.game_id) return "no-attack";
  if (store.require("SliceRules", { game_id }).day_unit_seconds === 0) return undefined;
  const { spacing } = store.require("SettlementRules", { game_id });
  for (const army of [attacker, defender]) {
    const { x, y, alt } = entityMapPosition(store, game_id, army.explorer_id);
    if (!isDeepTile(spacing, { col: x, row: y, alt })) return "no-attack";
  }
  const attackerAspect = store.require("HomeAspect", { game_id, home: store.require("ExplorerTroops", attacker).owner }).aspect;
  const defenderAspect = store.require("HomeAspect", { game_id, home: store.require("ExplorerTroops", defender).owner }).aspect;
  return attackerAspect === defenderAspect ? "allied" : undefined;
}
