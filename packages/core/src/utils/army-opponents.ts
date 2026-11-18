import type { NativeFactStore } from "../client/native-fact-store";
import { isDeepTile } from "./deep-geometry";
import { entityMapPosition } from "./tile";

/** The same Frontier boundary for the map's order and the selected target's card. */
export function armyCombatRefusal(
  store: Pick<NativeFactStore, "get" | "require" | "entityOccupancy">,
  attacker: { game_id: number; explorer_id: number | bigint },
  defender: { game_id: number; explorer_id: number | bigint },
): "no-attack" | "outside-deep" | "allied" | undefined {
  if (attacker.game_id !== defender.game_id) return "no-attack";
  if (!limitsArmyCombat(store, attacker.game_id)) return undefined;
  const side = (army: typeof attacker) => {
    const { x, y, alt } = entityMapPosition(store, army.game_id, army.explorer_id);
    return { home: store.require("ExplorerTroops", army).owner, tile: { col: x, row: y, alt } };
  };
  return deepOpponentsRefusal(store, attacker.game_id, side(attacker), side(defender));
}

export function armyOpponentsRefusal(
  store: Pick<NativeFactStore, "require">,
  game_id: number,
  attacker: ArmySide,
  defender: ArmySide,
): "outside-deep" | "allied" | undefined {
  return limitsArmyCombat(store, game_id) ? deepOpponentsRefusal(store, game_id, attacker, defender) : undefined;
}

const limitsArmyCombat = (store: Pick<NativeFactStore, "require">, game_id: number): boolean =>
  store.require("SliceRules", { game_id }).day_unit_seconds !== 0;

function deepOpponentsRefusal(
  store: Pick<NativeFactStore, "require">,
  game_id: number,
  attacker: ArmySide,
  defender: ArmySide,
): "outside-deep" | "allied" | undefined {
  const { spacing } = store.require("SettlementRules", { game_id });
  if (![attacker, defender].every((side) => isDeepTile(spacing, side.tile))) return "outside-deep";
  const aspect = (side: ArmySide) => store.require("HomeAspect", { game_id, home: side.home }).aspect;
  return aspect(attacker) === aspect(defender) ? "allied" : undefined;
}

interface ArmySide {
  home: bigint;
  tile: { col: number; row: number; alt: boolean };
}

/** Whether a home stands in the Aspect of one of the viewer's own realms: an Aspect's armies are allies in the Deep. */
export function isAspectAlly(
  store: Pick<NativeFactStore, "get" | "structuresOwnedBy">,
  game_id: number,
  viewer: bigint | null,
  home: number | bigint,
): boolean {
  if (viewer === null) return false;
  const aspect = store.get("HomeAspect", { game_id, home })?.aspect;
  if (aspect === undefined) return false;
  for (const realm of store.structuresOwnedBy(game_id, viewer)) {
    if (store.get("HomeAspect", { game_id, home: realm.entity_id })?.aspect === aspect) return true;
  }
  return false;
}
