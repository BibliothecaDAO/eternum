import { EternumGlobalConfig } from "@bibliothecadao/eternum";
import { canExplore, findAccessiblePositionsAndPaths } from "./utils.js";
import { useStamina } from "@/hooks/helpers/useStamina";
import useUIStore from "@/hooks/store/useUIStore";
import { useEffect } from "react";
import { useExploredHexesStore } from "./WorldHexagon.js";
import { getUIPositionFromColRow } from "@/ui/utils/utils.js";
import { HighlightPositions } from "@/types/index.js";
import { ACCESSIBLE_POSITIONS_COLOUR } from "@/ui/config.js";
import { useResourceBalance } from "@/hooks/helpers/useResources.js";
import { useRealm } from "@/hooks/helpers/useRealm.js";

export const useTravelPath = () => {
  const selectedEntity = useUIStore((state) => state.selectedEntity);
  const setHighlightPositions = useUIStore((state) => state.setHighlightPositions);
  const setTravelPaths = useUIStore((state) => state.setTravelPaths);
  const exploredHexes = useExploredHexesStore((state) => state.exploredHexes);

  const { getFoodResources } = useResourceBalance();
  const { useStaminaByEntityId } = useStamina();
  const { getEntityOwner } = useRealm();

  const stamina = useStaminaByEntityId({ travelingEntityId: selectedEntity?.id || 0n });

  useEffect(() => {
    if (!selectedEntity || !stamina) return;

    const maxTravelPossible = Math.floor((stamina.amount || 0) / EternumGlobalConfig.stamina.travelCost);
    const entityOwner = getEntityOwner(selectedEntity.id);
    const food = getFoodResources(entityOwner!);

    const pathMap = findAccessiblePositionsAndPaths(
      selectedEntity.position,
      exploredHexes,
      maxTravelPossible,
      canExplore(stamina?.amount, food),
    );

    const path = Array.from(pathMap.entries()).map(([key, path]) => {
      const [x, y] = key.split(",").map(Number);
      return { x, y, path };
    });

    if (path.length <= 1) return;

    const uiPath: HighlightPositions = {
      pos: path.map(({ x, y }) => {
        const pos = getUIPositionFromColRow(x, y);
        return [pos.x, -pos.y];
      }),
      color: ACCESSIBLE_POSITIONS_COLOUR,
    };

    setHighlightPositions(uiPath);
    setTravelPaths(pathMap);
  }, [selectedEntity, stamina, exploredHexes]);
};
