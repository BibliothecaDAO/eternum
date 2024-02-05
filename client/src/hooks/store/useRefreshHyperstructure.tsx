import { useHyperstructure } from "../helpers/useHyperstructure";
import useUIStore from "./useUIStore";
import { useCallback, useMemo, useState } from "react";
import useRealmStore from "./useRealmStore";
import { useDojo } from "../../DojoContext";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys, getUIPositionFromContractPosition } from "../../utils/utils";
import { getRealm } from "../../utils/realms";
import hyperstructuresHex from "../../geodata/hex/hyperstructuresHexPositions.json";

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
      const info = position ? getHyperstructure(position.x, position.y) : undefined;
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
      const newHyperstructures = Object.values(hyperstructuresHex).map((hyperstructure) =>
        getHyperstructure(hyperstructure[0].col, hyperstructure[0].row),
      );
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
