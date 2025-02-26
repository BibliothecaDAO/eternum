import { useUIStore } from "@/hooks/store/use-ui-store";
import { Position as PositionInterface } from "@/types/position";
import { UNDEFINED_STRUCTURE_ENTITY_ID } from "@/ui/constants";
import { useDojo, useQuery } from "@bibliothecadao/react";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useEffect } from "react";

export const useStructureEntityId = () => {
  const {
    setup: {
      components: { Structure, Occupied },
    },
  } = useDojo();

  const { hexPosition } = useQuery();
  const setStructureEntityId = useUIStore((state) => state.setStructureEntityId);

  useEffect(() => {
    const position = new PositionInterface({
      x: hexPosition.col,
      y: hexPosition.row,
    }).getContract();

    const occupier = getComponentValue(Occupied, getEntityIdFromKeys([BigInt(position.x), BigInt(position.y)]));

    const structure = getComponentValue(Structure, getEntityIdFromKeys([BigInt(occupier?.by_id ?? 0n)]));
    console.log({ structure });

    const newStructureId = structure?.entity_id;

    console.log({ occupier, structure, newStructureId });

    setStructureEntityId(newStructureId || UNDEFINED_STRUCTURE_ENTITY_ID);
  }, [hexPosition]);
};
