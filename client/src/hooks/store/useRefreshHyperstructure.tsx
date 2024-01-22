import { UIPosition } from "@bibliothecadao/eternum";
import { useHyperstructure } from "../helpers/useHyperstructure";
import useUIStore from "./useUIStore";
import hyperStructures from "../../data/hyperstructures.json";
import { useCallback, useMemo, useState } from "react";
import useRealmStore from "./useRealmStore";
import { useDojo } from "../../DojoContext";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys, getUIPositionFromContractPosition } from "../../utils/utils";
import { getRealm } from "../../utils/realms";

export const useRefreshHyperstructure = () => {
  const {
    setup: {
      components: { Position },
    },
  } = useDojo();

  const { getHyperstructure } = useHyperstructure();
  const hyperstructures = useUIStore((state) => state.hyperstructures);
  const realmId = useRealmStore((state) => state.realmId);
  const setHyperstructures = useUIStore((state) => state.setHyperstructures);

  const [isLoading, setIsLoading] = useState(false);

  const playerOrder = useMemo(() => {
    if (realmId) {
      const realm = getRealm(realmId);
      return realm?.order;
    }
  }, [realmId]);

  const refreshHyperstructure = useCallback(
    (hyperstructureId: bigint) => {
      const position = getComponentValue(Position, getEntityIdFromKeys([hyperstructureId]));
      const uiPosition = position ? getUIPositionFromContractPosition({ x: position.x, y: position.y }) : undefined;
      if (!uiPosition) return;
      const info = getHyperstructure({ x: uiPosition.x, z: uiPosition.y, y: 0 });
      let updated = false;
      const updatedHyperstructures = hyperstructures.map((h) => {
        if (h?.hyperstructureId === info?.hyperstructureId) {
          updated = true;
          return info; // Return updated info
        }
        return h; // Return original hyperstructure if not the one being updated
      });

      const conqueredHyperstructureNumber = updatedHyperstructures.filter(
        (struct) => struct?.completed && struct.orderId === playerOrder,
      ).length;

      if (updated) {
        setHyperstructures(updatedHyperstructures, conqueredHyperstructureNumber);
      }
    },
    [getHyperstructure, setHyperstructures],
  );

  const refreshAllHyperstructures = () => {
    setIsLoading(true);
    setTimeout(() => {
      const newHyperstructures = hyperStructures
        .slice(0, 11)
        .map((hyperstructure) => getHyperstructure({ x: hyperstructure.x, y: hyperstructure.y, z: hyperstructure.z }));
      const conqueredHyperstructureNumber = newHyperstructures.filter(
        (struct) => struct?.completed && struct.orderId === playerOrder,
      ).length;
      setHyperstructures(newHyperstructures, conqueredHyperstructureNumber);
      setIsLoading(false);
    }, 1000);
    setIsLoading(false);
  };

  return { refreshHyperstructure, refreshAllHyperstructures, isLoading };
};
