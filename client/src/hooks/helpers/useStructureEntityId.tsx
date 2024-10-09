import { Position as PositionInterface } from "@/types/Position";
import { UNDEFINED_STRUCTURE_ENTITY_ID } from "@/ui/constants";
import { Entity, Has, HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
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
  const { setStructureEntityId } = useUIStore();
  const { playerStructures } = useEntities();

  const structures = playerStructures();
  const defaultPlayerStructure = useMemo(() => structures[0], [structures]);

  useEffect(() => {
    const { x, y } = new PositionInterface({
      x: hexPosition.col,
      y: hexPosition.row,
    }).getContract();

    const structureEntity = runQuery([Has(Structure), HasValue(Position, { x, y })])
      .values()
      .next().value;

    const getEntityValue = (component: any, entity: Entity) => getComponentValue(component, entity ?? ("0" as Entity));

    const structure = getEntityValue(Structure, structureEntity);
    const structureOwner = getEntityValue(Owner, structureEntity);

    const isOwner = structureOwner?.address === BigInt(address);

    const newStructureEntityId = isMapView
      ? isOwner
        ? structureOwner.entity_id
        : defaultPlayerStructure?.entity_id
      : structure?.entity_id;

    setStructureEntityId(newStructureEntityId || UNDEFINED_STRUCTURE_ENTITY_ID);
  }, [defaultPlayerStructure, isMapView, hexPosition, address, setStructureEntityId]);
};
