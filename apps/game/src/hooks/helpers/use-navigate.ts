import { useCallback } from "react";

import { Position } from "@bibliothecadao/eternum";

import { buildPlayHref, mapRouteHex, parsePlayRoute, type PlayScene } from "@/play/navigation/play-route";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { useQuery } from "@/hooks/helpers/use-query";
import { ID } from "@bibliothecadao/types";
import { useUIStore } from "../store/use-ui-store";

/** The chain coordinate a navigation selects: the UI store keeps selections as contract hexes. */
const toSelectedHex = (position: Position): { col: number; row: number } => {
  const contract = position.getContract();
  return { col: contract.x, row: contract.y };
};

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

export const useGoToStructure = (setupResult: GameClientSetup | null) => {
  const setStructureEntityId = useUIStore((state) => state.setStructureEntityId);
  const setSelectedHex = useUIStore((state) => state.setSelectedHex);
  const navigateToHexView = useNavigateToHexView();
  const navigateToMapView = useNavigateToMapView();

  const updateSelectedHex = useCallback(
    (nextSelection: { col: number; row: number }) => {
      setSelectedHex(nextSelection);
      // World scene clears selection on URL changes; reapply next tick to keep the tile highlighted.
      setTimeout(() => setSelectedHex(nextSelection), 0);
    },
    [setSelectedHex],
  );

  return async (
    structureEntityId: ID,
    targetPosition: Position,
    isMapView: boolean,
    options?: { spectator?: boolean },
  ) => {
    setStructureEntityId(structureEntityId, {
      spectator: options?.spectator ?? false,
      worldMapPosition: targetPosition,
    });

    updateSelectedHex(toSelectedHex(targetPosition));

    if (isMapView) {
      navigateToMapView(targetPosition);
      return;
    }

    navigateToHexView(targetPosition);
  };
};
