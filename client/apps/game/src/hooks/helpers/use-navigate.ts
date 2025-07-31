import { Position } from "@/types/position";
import { useQuery } from "@bibliothecadao/react";
import { ClientComponents, ID } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useUIStore } from "../store/use-ui-store";

const useNavigateToHexView = () => {
  const showBlankOverlay = useUIStore((state) => state.setShowBlankOverlay);
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);
  const setPreviewBuilding = useUIStore((state) => state.setPreviewBuilding);
  const { handleUrlChange } = useQuery();

  return (position: Position) => {
    const url = position.toHexLocationUrl();

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
    if (!isMapView) {
      setIsLoadingScreenEnabled(true);
    }
    showBlankOverlay(false);
    setPreviewBuilding(null);
    handleUrlChange(position.toMapLocationUrl());
  };
};

export const useSpectatorModeClick = (components: ClientComponents) => {
  const spectatorRealmEntityId = useUIStore((state) => state.spectatorRealmEntityId);
  const setFollowArmyMoves = useUIStore((state) => state.setFollowArmyMoves);
  const goToStructure = useGoToStructure();

  return () => {
    const structure =
      spectatorRealmEntityId &&
      getComponentValue(components.Structure, getEntityIdFromKeys([BigInt(spectatorRealmEntityId)]));
    if (structure) {
      goToStructure(structure.entity_id, new Position({ x: structure.base.coord_x, y: structure.base.coord_y }), true);
      setFollowArmyMoves(true);
    }
  };
};

export const useGoToStructure = () => {
  const setStructureEntityId = useUIStore((state) => state.setStructureEntityId);
  const navigateToHexView = useNavigateToHexView();
  const navigateToMapView = useNavigateToMapView();

  return (structureEntityId: ID, position: Position, isMapView: boolean) => {
    setStructureEntityId(structureEntityId);
    isMapView ? navigateToMapView(position) : navigateToHexView(position);
  };
};
