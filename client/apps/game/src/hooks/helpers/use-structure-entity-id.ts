import { ContractAddress } from "@bibliothecadao/eternum";
import {
  Position as PositionInterface,
  UNDEFINED_STRUCTURE_ENTITY_ID,
  useDojo,
  usePlayerStructures,
  useQuery,
} from "@bibliothecadao/react";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { Entity, Has, HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { useEffect, useMemo } from "react";

export const useStructureEntityId = () => {
  const {
    setup: {
      components: { Structure, Position, Owner },
    },
    account: { account },
  } = useDojo();

  const { hexPosition, isMapView } = useQuery();
  const setStructureEntityId = useUIStore((state) => state.setStructureEntityId);
  const isSpectatorMode = useUIStore((state) => state.isSpectatorMode);
  const structureEntityId = useUIStore((state) => state.structureEntityId);

  const address = isSpectatorMode ? ContractAddress("0x0") : ContractAddress(account.address);

  const structures = usePlayerStructures(ContractAddress(account.address));

  const defaultPlayerStructure = useMemo(() => {
    return structures[0];
  }, [structureEntityId, structures]);

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

    const isOwner = structureOwner?.address === BigInt(address);

    if (isMapView) {
      setStructureEntityId(
        isOwner ? structureOwner.entity_id : defaultPlayerStructure?.entity_id || UNDEFINED_STRUCTURE_ENTITY_ID,
      );
    } else {
      setStructureEntityId(structure?.entity_id || UNDEFINED_STRUCTURE_ENTITY_ID);
    }
  }, [defaultPlayerStructure, isMapView, hexPosition, address]);
};
