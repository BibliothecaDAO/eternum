import type { NativeFactStore } from "../client/native-fact-store";
import { ID } from "@bibliothecadao/types";
import { calculateDistance } from "./utils";
import { configManager } from "../managers/config-manager";

export const computeTravelTime = (fromId: ID, toId: ID, secPerKm: number, store: NativeFactStore, pickup?: boolean) => {
  const fromPosition = store.get("Structure", { game_id: configManager.getActiveGameId(), entity_id: fromId });
  const toPosition = store.get("Structure", { game_id: configManager.getActiveGameId(), entity_id: toId });
  if (!fromPosition || !toPosition) return;
  const distanceFromPosition =
    calculateDistance(
      { x: Number(fromPosition.base.coord_x), y: Number(fromPosition.base.coord_y) },
      { x: Number(toPosition.base.coord_x), y: Number(toPosition.base.coord_y) },
    ) ?? 0;

  const onewayTime = Math.floor((distanceFromPosition * secPerKm) / 60);
  return pickup ? onewayTime * 2 : onewayTime;
};
