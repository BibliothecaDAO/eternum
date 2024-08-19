import { Has, HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { useEffect, useMemo } from "react";
import { useSearch } from "wouter/use-location";
import { useDojo } from "../context/DojoContext";
import useUIStore from "../store/useUIStore";
import { Position as PositionInterface } from "@/types/Position";
import { useLocation } from "wouter";
import { useEntities } from "./useEntities";

export const useStructureEntityId = () => {
  const {
    setup: {
      components: { Structure, Position, Owner },
    },
    account: {
      account: { address },
    },
  } = useDojo();

  const searchString = useSearch();
  const [location, _] = useLocation();
  const setStructureEntityId = useUIStore((state) => state.setRealmEntityId);
  const structureEntityId = useUIStore((state) => state.realmEntityId);

  const { playerStructures } = useEntities();

  const defaultPlayerStructure = useMemo(() => {
    return playerStructures()[0];
  }, [structureEntityId]);

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const { x, y } = new PositionInterface({
      x: Number(params.get("col")),
      y: Number(params.get("row")),
    }).getContract();

    const structures = runQuery([Has(Structure), HasValue(Position, { x, y })]);
    const structureOwner = structures.size > 0 ? getComponentValue(Owner, structures.values().next().value) : null;

    const isWorldView = location.includes(`/map`);
    if (isWorldView) {
      if (structureOwner?.address !== BigInt(address)) {
        setStructureEntityId(defaultPlayerStructure.entity_id);
        return;
      }
    } else {
      if (structureOwner) {
        setStructureEntityId(structureOwner.entity_id);
      } else {
        setStructureEntityId(0);
      }
    }
  }, [defaultPlayerStructure, searchString, location]);
};
