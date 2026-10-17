import { structureMapPosition } from "./expeditions";
import type { NativeFactStore } from "../client/native-fact-store";
import { EntityType, ID } from "@bibliothecadao/types";
import { configManager } from "../managers/config-manager";

/** Tiles between two places as the chain counts a journey (geometry::distance): hex steps on its odd-row offset grid. */
export const journeyDistance = (from: { x: number; y: number }, to: { x: number; y: number }): number => {
  const axialColumn = ({ x, y }: { x: number; y: number }) => x - Math.trunc((y + (y % 2)) / 2);
  const dq = axialColumn(from) - axialColumn(to);
  const dr = from.y - to.y;
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
};

/** Seconds on the road between two structures at `secPerKm`; undefined while either is unknown. */
const journeySeconds = (fromId: ID, toId: ID, secPerKm: number, store: NativeFactStore): number | undefined => {
  const from = store.get("Structure", { game_id: configManager.getActiveGameId(), entity_id: fromId });
  const to = store.get("Structure", { game_id: configManager.getActiveGameId(), entity_id: toId });
  if (!from || !to) return;
  const fromPosition = structureMapPosition(store, from);
  const toPosition = structureMapPosition(store, to);
  if (!fromPosition || !toPosition) return;
  return journeyDistance(fromPosition, toPosition) * secPerKm;
};

/**
 * Seconds a shipment between two structures spends on the road, as the chain times it (transport::travel_time): donkeys
 * carrying troops walk at their own, slower pace.
 */
export const shipmentTravelSeconds = (
  fromId: ID,
  toId: ID,
  store: NativeFactStore,
  carriesTroops: boolean,
): number | undefined =>
  journeySeconds(fromId, toId, configManager.getSpeedConfig(EntityType.DONKEY, carriesTroops), store);

/**
 * Seconds a bank pickup spends on the road, as the chain times it (economy::pickup_bank_resources): the donkeys' round
 * trip between the bank and the structure, at the troops' pace when troops are among the goods picked up.
 */
export const bankPickupTravelSeconds = (
  bankId: ID,
  structureId: ID,
  store: NativeFactStore,
  carriesTroops: boolean,
): number | undefined => {
  const oneWay = shipmentTravelSeconds(bankId, structureId, store, carriesTroops);
  return oneWay === undefined ? undefined : oneWay * 2;
};
