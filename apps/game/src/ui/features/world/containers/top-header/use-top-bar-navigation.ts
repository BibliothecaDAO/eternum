import { useUISound } from "@/audio/hooks/useUISound";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useGame } from "@/hooks/context/game-context";
import { useNativeFacts } from "@/hooks/helpers/use-native-facts";
import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { Position } from "@bibliothecadao/eternum";
import { useCallback, useEffect, useMemo, useState } from "react";

export function useTopBarNavigation() {
  const { setup } = useGame();
  const playClick = useUISound("ui.click");
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const isSpectating = useUIStore((state) => state.isSpectating);
  const mode = useGameModeConfig();
  const isFollowingArmy = useUIStore((state) => state.isFollowingArmy);
  const followingArmyMessage = useUIStore((state) => state.followingArmyMessage);
  const structures = useNativeFacts(["Structure"]);
  const entityInfo = useMemo(
    () => mode.structure.getEntityInfo(structureEntityId, null, structures.store),
    [structureEntityId, structures, mode],
  );
  const selectedStructurePosition = useMemo(
    () => (entityInfo?.position ? Position.fromContract(entityInfo.position) : null),
    [entityInfo],
  );
  const [currentPathname, setCurrentPathname] = useState(() =>
    typeof window !== "undefined" ? window.location.pathname : "/play/hex",
  );
  const goToStructure = useGoToStructure(setup);
  const isLocalView = currentPathname.includes("/hex");
  const mapLayer = useUIStore((state) => state.mapLayer);
  const setMapLayer = useUIStore((state) => state.setMapLayer);
  const showLayerSwitch = mode.id === "eternum" && !isLocalView;

  useEffect(() => {
    const updatePathname = () => {
      setCurrentPathname(window.location.pathname);
    };
    updatePathname();
    window.addEventListener("urlChanged", updatePathname);
    window.addEventListener("popstate", updatePathname);
    return () => {
      window.removeEventListener("urlChanged", updatePathname);
      window.removeEventListener("popstate", updatePathname);
    };
  }, []);

  const switchLayer = useCallback(
    (alt: boolean) => {
      if (alt === mapLayer) return;
      playClick();
      setMapLayer(alt);
    },
    [mapLayer, playClick, setMapLayer],
  );

  const navigateToView = useCallback(
    (world: boolean) => {
      if (!selectedStructurePosition) return;
      playClick();
      goToStructure(structureEntityId, selectedStructurePosition, world, { spectator: isSpectating });
    },
    [goToStructure, isSpectating, playClick, selectedStructurePosition, structureEntityId],
  );

  return {
    isLocalView,
    canOpenLocal: selectedStructurePosition !== null,
    mapLayer,
    showLayerSwitch,
    isFollowingArmy,
    followingArmyMessage,
    navigateToView,
    switchLayer,
  };
}
