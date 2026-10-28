import { useGame } from "@/hooks/context/game-context";
import { openPlace } from "@/play/navigation/open-place";
import { leaveRealmVisit } from "@/sync/active-game-client";
import { requestArmyShown } from "@/three/scenes/worldmap-army-select-request";
import { useAccountStore } from "../store/use-account-store";
import { configManager, entityMapPosition, Position } from "@bibliothecadao/eternum";

import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { useQuery } from "@/hooks/helpers/use-query";
import { ID } from "@bibliothecadao/types";
import { useUIStore } from "../store/use-ui-store";

/**
 * Shows one of the player's armies on the world map from any view: on the map at once, framed when out of sight; from
 * another view the map opens at the army's tile and selects it once it is shown. Given a site, the site's card opens
 * with the army as its actor.
 */
export const useSelectArmyOnMap = () => {
  const { setup } = useGame();
  const { isMapView } = useQuery();
  return (entityId: ID, forSite: Position | null = null) => {
    if (!isMapView) {
      openPlace(
        "map",
        Position.fromContract(entityMapPosition(setup.store, configManager.getActiveGameId(), entityId)),
      );
    }
    requestArmyShown(entityId, forSite);
  };
};

/**
 * Opens a structure where it stands, on the world map or in its realm view, selected, as the session's structure: the
 * player's own leaves any visit, another's is watched as a spectator when asked.
 */
export const useGoToStructure = (setupResult: GameClientSetup | null) => {
  const setStructureEntityId = useUIStore((state) => state.setStructureEntityId);

  return async (
    structureEntityId: ID,
    targetPosition: Position,
    isMapView: boolean,
    options?: { spectator?: boolean },
  ) => {
    const owner = setupResult?.store.get("Structure", {
      game_id: configManager.getActiveGameId(),
      entity_id: structureEntityId,
    })?.owner;
    const address = useAccountStore.getState().account?.address;
    if (address && owner === BigInt(address)) leaveRealmVisit();
    setStructureEntityId(structureEntityId, {
      spectator: options?.spectator ?? false,
      worldMapPosition: targetPosition,
    });
    // The map clears its selection as it moves, and a flight into the realm view keeps it: selected once there.
    openPlace(isMapView ? "map" : "hex", targetPosition);
    useUIStore.getState().selectOnMap({ kind: "structure", entityId: structureEntityId });
  };
};
