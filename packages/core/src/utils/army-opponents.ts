import type { NativeFactStore } from "../client/native-fact-store";
import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { isDeepTile } from "./deep-geometry";
import { entityMapPosition } from "./tile";

/** The same Frontier boundary for the map's order and the selected target's card. */
export function armyCombatRefusal(
  store: Pick<NativeFactStore, "get" | "require" | "entityOccupancy">,
  attacker: NativeRows["ExplorerTroops"],
  defender: NativeRows["ExplorerTroops"],
): "no-attack" | "allied" | undefined {
  const game_id = attacker.game_id;
  if (game_id !== defender.game_id) return "no-attack";
  if (store.require("SliceRules", { game_id }).day_unit_seconds === 0) return undefined;
  const { spacing } = store.require("SettlementRules", { game_id });
  for (const army of [attacker, defender]) {
    const { x, y, alt } = entityMapPosition(store, game_id, army.explorer_id);
    if (!isDeepTile(spacing, { col: x, row: y, alt })) return "no-attack";
  }
  const attackerAspect = store.require("HomeAspect", { game_id, home: attacker.owner }).aspect;
  const defenderAspect = store.require("HomeAspect", { game_id, home: defender.owner }).aspect;
  return attackerAspect === defenderAspect ? "allied" : undefined;
}
