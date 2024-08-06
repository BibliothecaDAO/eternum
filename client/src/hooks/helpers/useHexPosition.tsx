import useUIStore from "@/hooks/store/useUIStore";
import { getNeighborHexes } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { Has, HasValue, getComponentValue } from "@dojoengine/recs";
import { useEffect, useMemo } from "react";
import { useSearch } from "wouter/use-location";
import { useDojo } from "../context/DojoContext";
import useLeaderBoardStore from "../store/useLeaderBoardStore";
import { FELT_CENTER } from "@/ui/config";
import useRealmStore from "../store/useRealmStore";

export enum HexType {
  BANK = "bank",
  REALM = "realm",
  SHARDSMINE = "shardsmine",
  HYPERSTRUCTURE = "Hyperstructure",
  UNFINISHEDHYPERSTRUCTURE = "UnfinishedHyperstructure",
  EMPTY = "empty",
}

export const useHexPosition = () => {
  const {
    setup: {
      components: { Structure, Position, Owner },
    },
  } = useDojo();

  const searchString = useSearch();
  const setRealmEntityId = useRealmStore((state) => state.setRealmEntityId);

  const hexPosition = useMemo(() => {
    const params = new URLSearchParams(searchString);
    const x = params.get("col");
    const y = params.get("row");
    return { col: Number(x), row: Number(y) };
  }, [searchString]);

  const structures = useEntityQuery([
    Has(Structure),
    HasValue(Position, { x: hexPosition.col + FELT_CENTER, y: hexPosition.row + FELT_CENTER }),
  ]);

  const structure = useMemo(() => {
    if (structures?.length === 0) return null;
    return getComponentValue(Structure, structures[0]);
  }, [structures]);

  useEffect(() => {
    const owner = getComponentValue(Owner, structures[0]);
    if (owner) {
      setRealmEntityId(owner.entity_id);
    }
  }, [structure]);
};
