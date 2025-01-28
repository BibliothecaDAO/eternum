import { useUIStore } from "@/hooks/store/use-ui-store";
import { Position as PositionInterface } from "@/types/position";
import { UNDEFINED_STRUCTURE_ENTITY_ID } from "@/ui/constants";
import { useDojo, useQuery } from "@bibliothecadao/react";
import { Entity, Has, HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { useEffect } from "react";

export const useStructureEntityId = () => {
  const {
    setup: {
      components: { Structure, Position },
    },
  } = useDojo();

  const { hexPosition } = useQuery();
  const { setStructureEntityId } = useUIStore();

  useEffect(() => {
    const position = new PositionInterface({
      x: hexPosition.col,
      y: hexPosition.row,
    }).getContract();

    const structureEntity = runQuery([Has(Structure), HasValue(Position, { x: position.x, y: position.y })])
      .values()
      .next().value;

    const structure = getComponentValue(Structure, structureEntity ?? ("0" as Entity));
    const newStructureId = structure?.entity_id;

    setStructureEntityId(newStructureId || UNDEFINED_STRUCTURE_ENTITY_ID);
  }, [hexPosition]);
};
