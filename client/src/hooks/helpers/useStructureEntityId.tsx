import { Position as PositionInterface } from "@/types/Position";
import { UNDEFINED_STRUCTURE_ENTITY_ID } from "@/ui/constants";
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
  const setStructureEntityId = useUIStore((state) => state.setStructureEntityId);
  const structureEntityId = useUIStore((state) => state.structureEntityId);

  const { playerStructures } = useEntities();

  const structures = useMemo(() => playerStructures(), [playerStructures]);

  const defaultPlayerStructure = useMemo(() => {
    return structures[0];
  }, [structureEntityId, structures]);

  useEffect(() => {
    const { x, y } = new PositionInterface({
      x: hexPosition.col,
      y: hexPosition.row,
    }).getContract();

    const structures = runQuery([Has(Structure), HasValue(Position, { x, y })]);
    const structureOwner = structures.size > 0 ? getComponentValue(Owner, structures.values().next().value) : null;

    const isOwner = structureOwner?.address === BigInt(address);

    if (isMapView) {
      setStructureEntityId(
        isOwner ? structureOwner.entity_id : defaultPlayerStructure?.entity_id || UNDEFINED_STRUCTURE_ENTITY_ID,
      );
    } else {
      setStructureEntityId(structureOwner ? structureOwner.entity_id : UNDEFINED_STRUCTURE_ENTITY_ID);
    }
  }, [defaultPlayerStructure, isMapView, hexPosition, address, structures]);
};
