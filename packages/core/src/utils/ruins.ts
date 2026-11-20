import { currentArmy } from "./deep";
import { getBlockTimestamp } from "./timestamp";
import { readExpeditionRules, isCurrentExpeditionArmy } from "./expeditions";
import type { NativeFactStore } from "../client/native-fact-store";
import type { NativeKeys, NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";

export function activeTileOccupancy(
  store: Pick<NativeFactStore, "get">,
  key: NativeKeys["TileOccupancy"],
): NativeRows["TileOccupancy"] | undefined {
  const occupancy = store.get("TileOccupancy", key);
  if (occupancy && store.get("DeepArmy", { game_id: key.game_id, explorer_id: occupancy.entity_id })) {
    const army = store.get("ExplorerTroops", { game_id: key.game_id, explorer_id: occupancy.entity_id });
    const birth = store.get("ArmyDay", { game_id: key.game_id, explorer_id: occupancy.entity_id });
    const calendar = readExpeditionRules(store, key.game_id);
    if (!army || !birth || !calendar) throw new Error("Deep occupancy requires its army and calendar");
    if (
      !isCurrentExpeditionArmy(calendar, birth.day, getBlockTimestamp().currentDefaultTick) ||
      currentArmy(store, army).troops.count === 0n
    )
      return undefined;
  }
  return occupancy;
}
