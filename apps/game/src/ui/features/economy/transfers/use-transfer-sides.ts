import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useFactView } from "@/hooks/use-fact-view";
import { playerStructuresView } from "@/sync/fact-views";
import {
  canTransferMilitaryInventoryBetweenStructures,
  canTransferMilitaryInventoryFromStructure,
} from "@/ui/lib/structure-capabilities";
import { configManager, isMilitaryResource, ResourceManager, shipmentTravelSeconds } from "@bibliothecadao/eternum";
import { CapacityConfig, RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import { useMemo } from "react";
import { type Good, type HoldingRole, roleOf } from "./transfer-plan";

export interface TransferSides {
  sourceName: string;
  destinationNames: string[];
  sourceRole: HoldingRole;
  destinationRoles: HoldingRole[];
  /** What the source can send to every chosen destination: troops only where the mode lets them travel. */
  goods: Good[];
  /** Each destination's road from the source in seconds, at the donkeys' pace with goods and with troops aboard. */
  roads: Array<{ goods: number; troops: number }>;
  donkeysHave: number;
  donkeyCapacityKg: number;
}

const whole = (amount: number) => Math.floor(amount / RESOURCE_PRECISION);

/**
 * A transfer's two ends, read from the native fact store through the game's helpers: what the source holds (donkeys
 * included: a realm sends them to a rift), each end's role and name, and the donkeys' road.
 */
export const useTransferSides = (sourceId: number | null, destinationIds: number[]): TransferSides | null => {
  const { setup } = useGame();
  const mode = useGameModeConfig();
  const tick = useCurrentDefaultTick();
  const holdings = useFactView(playerStructuresView);
  const revision = useNativeRevision(["ResourceBalance", "ResourceProduction"]);
  // The destinations by value: their array is new on every render.
  const destinationKey = destinationIds.join(",");

  return useMemo(() => {
    const destinationIds = destinationKey.split(",").filter(Boolean).map(Number);
    const find = (id: number) => holdings.find((holding) => Number(holding.entityId) === id);
    const source = sourceId === null ? undefined : find(sourceId);
    if (!source) return null;
    const destinations = destinationIds.map(find);
    const troopsTravel =
      canTransferMilitaryInventoryFromStructure(mode.id, source.structure) &&
      destinations.every(
        (destination) =>
          destination !== undefined &&
          canTransferMilitaryInventoryBetweenStructures({
            modeId: mode.id,
            source: source.structure,
            destination: destination.structure,
          }),
      );
    const held = new ResourceManager(setup.store, source.entityId).balances(tick) ?? [];
    return {
      sourceName: mode.structure.getName(source.structure).name,
      destinationNames: destinations.map((destination, index) =>
        destination ? mode.structure.getName(destination.structure).name : String(destinationIds[index]),
      ),
      sourceRole: roleOf(source),
      destinationRoles: destinations.map(roleOf),
      goods: held
        .filter(({ resourceId }) => troopsTravel || !isMilitaryResource(resourceId))
        .map(({ resourceId, amount }) => ({
          resource: resourceId,
          have: whole(amount),
          weightKg: configManager.getResourceWeightKg(resourceId) ?? 0,
        })),
      roads: destinationIds.map((id) => ({
        goods: shipmentTravelSeconds(source.entityId, id, setup.store, false) ?? 0,
        troops: shipmentTravelSeconds(source.entityId, id, setup.store, true) ?? 0,
      })),
      donkeysHave: whole(held.find(({ resourceId }) => resourceId === ResourcesIds.Donkey)?.amount ?? 0),
      donkeyCapacityKg: configManager.getCapacityConfigKg(CapacityConfig.Donkey),
    };
  }, [holdings, sourceId, destinationKey, setup.store, tick, mode, revision]);
};
