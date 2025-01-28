import { useUIStore } from "@/hooks/store/use-ui-store";
import { Position as PositionInterface } from "@/types/position";
import { UNDEFINED_STRUCTURE_ENTITY_ID } from "@/ui/constants";
import { getRandomRealmEntity } from "@/utils/realms";
import { ContractAddress, getStructure } from "@bibliothecadao/eternum";
import { useDojo, usePlayerStructures, useQuery } from "@bibliothecadao/react";
import { Entity, Has, HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { useEffect, useMemo } from "react";

export const useStructureEntityId = () => {
  const {
    setup: {
      components,
      components: { Structure, Position, Owner },
    },
    account: { account },
  } = useDojo();

  const { hexPosition, isMapView } = useQuery();
  const setStructureEntityId = useUIStore((state) => state.setStructureEntityId);
  const structureEntityId = useUIStore((state) => state.structureEntityId);

  console.log("im am in the use structure entity id hook");

  const structures = usePlayerStructures(ContractAddress(account.address));

  console.log({ account: account.address });

  // don't to that here, find where
  const defaultPlayerStructure = useMemo(() => {
    if (!structures.length) {
      const randomRealm = getRandomRealmEntity(components);
      console.log({ randomRealm });
      return getStructure(randomRealm!, ContractAddress(account.address), components);
    }
    return structures[0];
    // todo: pay attention to this, lots of rerenders
  }, [structureEntityId, structures]);

  console.log({ defaultPlayerStructure });

  useEffect(() => {
    const { x, y } = new PositionInterface({
      x: hexPosition.col,
      y: hexPosition.row,
    }).getContract();

    const structureEntity = runQuery([Has(Structure), HasValue(Position, { x, y })])
      .values()
      .next().value;

    const structure = getComponentValue(Structure, structureEntity ?? ("0" as Entity));
    const structureOwner = getComponentValue(Owner, structureEntity ?? ("0" as Entity));

    const isOwner = structureOwner?.address === ContractAddress(account.address);

    if (isMapView) {
      setStructureEntityId(
        isOwner ? structureOwner.entity_id : defaultPlayerStructure?.entity_id || UNDEFINED_STRUCTURE_ENTITY_ID,
      );
    } else {
      setStructureEntityId(structure?.entity_id || UNDEFINED_STRUCTURE_ENTITY_ID);
    }
  }, [defaultPlayerStructure, isMapView, hexPosition, account.address]);
};
