import { getDirectionBetweenAdjacentHexes, StructureType, type Direction } from "@bibliothecadao/types";
import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import type { NativeFactStore } from "../client/native-fact-store";
import { getBlockTimestamp } from "./timestamp";
import { isCurrentExpeditionArmy, readExpeditionRules, structureMapPosition } from "./expeditions";

/** A valid reinforcement direction toward today's home or one of this Realm's cleared camps. */
export const reinforcementDirectionOf = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  explorerId: number,
): Direction | null => {
  const army = store.entityOccupancy(realm.game_id, explorerId);
  const troops = store.get("ExplorerTroops", { game_id: realm.game_id, explorer_id: explorerId });
  if (!army || army.alt || troops?.owner !== realm.entity_id) return null;
  const home = structureMapPosition(store, realm);
  const atHome = home && !home.alt ? getDirectionBetweenAdjacentHexes(army, { col: home.x, row: home.y }) : null;
  if (atHome !== null) return atHome;
  const rules = readExpeditionRules(store, realm.game_id);
  if (
    !rules ||
    !isCurrentExpeditionArmy(
      rules,
      { x: army.col, y: army.row, alt: army.alt },
      getBlockTimestamp().currentBlockTimestamp,
    )
  )
    return null;
  const band = Math.floor(army.row / rules.spacing);
  if (band % 4 === 3) return null;
  for (const site of store.inGame("ExpeditionSite", realm.game_id)) {
    if (
      site.category !== StructureType.Camp ||
      site.clear?.home_id !== realm.entity_id ||
      site.alt ||
      Math.floor(site.row / rules.spacing) !== band ||
      Math.floor(site.col / rules.spacing) !== Math.floor(army.col / rules.spacing)
    )
      continue;
    const direction = getDirectionBetweenAdjacentHexes(army, site);
    if (direction !== null) return direction;
  }
  return null;
};
