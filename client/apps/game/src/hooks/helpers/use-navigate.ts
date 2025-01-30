import { Position } from "@/types/position";
import { useQuery } from "@bibliothecadao/react";
import { useUIStore } from "../store/use-ui-store";

export const useNavigateToHexView = () => {
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
    showBlankOverlay(false);
    setPreviewBuilding(null);
    handleUrlChange(position.toMapLocationUrl());
    if (!isMapView) {
      setIsLoadingScreenEnabled(true);
    }
  };
};
