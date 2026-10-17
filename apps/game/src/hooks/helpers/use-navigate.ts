import { useCallback } from "react";

import { useGame } from "@/hooks/context/game-context";
import { leaveRealmVisit } from "@/sync/active-game-client";
import { requestArmySelection } from "@/three/scenes/worldmap-army-select-request";
import { useAccountStore } from "../store/use-account-store";
import { configManager, entityMapPosition, Position } from "@bibliothecadao/eternum";

import { buildPlayHref, mapRouteHex, parsePlayRoute, type PlayScene } from "@/play/navigation/play-route";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { useQuery } from "@/hooks/helpers/use-query";
import { ID } from "@bibliothecadao/types";
import { useUIStore } from "../store/use-ui-store";

/** The chain coordinate a navigation selects: the UI store keeps selections as contract hexes. */

const resolvePlaySceneHref = (scene: PlayScene, position: Position): string => {
  const playRoute = parsePlayRoute(window.location);
  if (!playRoute) throw new Error(`Cannot navigate scenes outside a game route: ${window.location.pathname}`);
  return buildPlayHref({ ...playRoute, scene, ...mapRouteHex(position) });
};

const useNavigateToHexView = () => {
  const showBlankOverlay = useUIStore((state) => state.setShowBlankOverlay);
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);
  const setPreviewBuilding = useUIStore((state) => state.setPreviewBuilding);
  const { handleUrlChange } = useQuery();

  return (position: Position) => {
    const url = resolvePlaySceneHref("hex", position);

    setIsLoadingScreenEnabled(true);
    showBlankOverlay(false);
    setPreviewBuilding(null);
    handleUrlChange(url);
  };
};

export const useNavigateToMapView = () => {
  const showBlankOverlay = useUIStore((state) => state.setShowBlankOverlay);
  const setPreviewBuilding = useUIStore((state) => state.setPreviewBuilding);
  const { handleUrlChange, isMapView } = useQuery();
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);

  return (position: Position) => {
    const url = resolvePlaySceneHref("map", position);

    if (!isMapView) {
      setIsLoadingScreenEnabled(true);
    }
    showBlankOverlay(false);
    setPreviewBuilding(null);
    handleUrlChange(url);
  };
};

/**
 * Selects one of the player's armies on the world map from any view: on the map at once; from another view the map
 * opens at the army's tile and selects it once it is shown. Given a site, the site's card opens with the army as its
 * actor.
 */
export const useSelectArmyOnMap = () => {
  const { setup } = useGame();
  const { isMapView } = useQuery();
  const navigateToMapView = useNavigateToMapView();
  return (entityId: ID, forSite: { col: number; row: number } | null = null) => {
    if (!isMapView) {
      navigateToMapView(
        Position.fromContract(entityMapPosition(setup.store, configManager.getActiveGameId(), entityId)),
      );
    }
    requestArmySelection(entityId, forSite);
  };
};

export const useGoToStructure = (setupResult: GameClientSetup | null) => {
  const setStructureEntityId = useUIStore((state) => state.setStructureEntityId);
  const selectOnMap = useUIStore((state) => state.selectOnMap);
  const navigateToHexView = useNavigateToHexView();
  const navigateToMapView = useNavigateToMapView();

  const selectStructure = useCallback(
    (entityId: ID) => {
      const structure = { kind: "structure", entityId } as const;
      selectOnMap(structure);
      // World scene clears selection on URL changes; reapply next tick to keep the tile highlighted.
      setTimeout(() => selectOnMap(structure), 0);
    },
    [selectOnMap],
  );

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

    selectStructure(structureEntityId);

    if (isMapView) {
      navigateToMapView(targetPosition);
      return;
    }

    navigateToHexView(targetPosition);
  };
};
