import { Position as PositionInterface } from "@/types/Position";
import { Has, HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { useEffect, useMemo } from "react";
import { useDojo } from "../context/DojoContext";
import useUIStore from "../store/useUIStore";
import { useEntities } from "./useEntities";
import { useQuery } from "./useQuery";

export const useStructureEntityId = () => {
  const {
    setup: {
      components: { Structure, Position, Owner },
    },
    account: {
      account: { address },
    },
  } = useDojo();

  const { hexPosition, isMapView } = useQuery();
  const setStructureEntityId = useUIStore((state) => state.setRealmEntityId);
  const structureEntityId = useUIStore((state) => state.realmEntityId);

  const { playerStructures } = useEntities();

  const defaultPlayerStructure = useMemo(() => {
    return playerStructures()[0];
  }, [structureEntityId]);

  useEffect(() => {
    const { x, y } = new PositionInterface({
      x: hexPosition.col,
      y: hexPosition.row,
    }).getContract();

    const structures = runQuery([Has(Structure), HasValue(Position, { x, y })]);
    const structureOwner = structures.size > 0 ? getComponentValue(Owner, structures.values().next().value) : null;

    const isOwner = structureOwner?.address === BigInt(address);

    if (isMapView) {
      setStructureEntityId(isOwner ? structureOwner.entity_id : defaultPlayerStructure?.entity_id || 0);
    } else {
      setStructureEntityId(structureOwner ? structureOwner.entity_id : 0);
    }
  }, [defaultPlayerStructure, isMapView, hexPosition, address]);
};
