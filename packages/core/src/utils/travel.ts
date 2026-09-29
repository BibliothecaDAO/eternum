import { structureMapPosition } from "./expeditions";
import type { NativeFactStore } from "../client/native-fact-store";
import { ID } from "@bibliothecadao/types";
import { calculateDistance } from "./utils";
import { configManager } from "../managers/config-manager";

export const computeTravelTime = (fromId: ID, toId: ID, secPerKm: number, store: NativeFactStore, pickup?: boolean) => {
  const from = store.get("Structure", { game_id: configManager.getActiveGameId(), entity_id: fromId });
  const to = store.get("Structure", { game_id: configManager.getActiveGameId(), entity_id: toId });
  if (!from || !to) return;
  const fromPosition = structureMapPosition(store, from);
  const toPosition = structureMapPosition(store, to);
  if (!fromPosition || !toPosition) return;
  const distance = calculateDistance(fromPosition, toPosition);

  const onewayTime = Math.floor((distance * secPerKm) / 60);
  return pickup ? onewayTime * 2 : onewayTime;
};
