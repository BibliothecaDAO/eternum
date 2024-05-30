import { useEffect, useMemo } from "react";
import useUIStore from "@/hooks/store/useUIStore";
import { getNeighborHexes } from "@bibliothecadao/eternum";
import { useSearch } from "wouter/use-location";
import { useEntityQuery } from "@dojoengine/react";
import { Has, HasValue, getComponentValue } from "@dojoengine/recs";
import { useDojo } from "../context/DojoContext";
import useRealmStore, { STARTING_ENTITY_ID } from "../store/useRealmStore";
import useLeaderBoardStore from "../store/useLeaderBoardStore";

export enum HexType {
  BANK = "bank",
  REALM = "realm",
  SHARDSMINE = "shardsmine",
  HYPERSTRUCTURE = "Hyperstructure",
  UNFINISHEDHYPERSTRUCTURE = "UnfinishedHyperstructure",
  EMPTY = "empty",
}

export const useHexPosition = () => {
  const hexData = useUIStore((state) => state.hexData);
  const finishedHyperstructures = useLeaderBoardStore((state) => state.finishedHyperstructures);

  const {
    account,
    setup: {
      components: { Structure, Position, Owner },
    },
  } = useDojo();

  const searchString = useSearch();
  const setRealmEntityId = useRealmStore((state) => state.setRealmEntityId);
  const realmEntityId = useRealmStore((state) => state.realmEntityId);

  const hexPosition = useMemo(() => {
    const params = new URLSearchParams(searchString);
    const x = params.get("col");
    const y = params.get("row");
    return { col: Number(x), row: Number(y) };
  }, [searchString]);

  const structures = useEntityQuery([Has(Structure), HasValue(Position, { x: hexPosition.col, y: hexPosition.row })]);

  const structure = useMemo(() => {
    if (structures?.length === 0) return null;
    return getComponentValue(Structure, structures[0]);
  }, [structures]);

  const hexType: HexType = useMemo(() => {
    if (!structure) return HexType.EMPTY;
    let category = structure.category.toUpperCase();
    if (structure.category === HexType.HYPERSTRUCTURE) {
      category = finishedHyperstructures.some((evt) => {
        return evt.hyperstructureEntityId == structure.entity_id;
      })
        ? category
        : HexType.UNFINISHEDHYPERSTRUCTURE.toUpperCase();
      finishedHyperstructures;
    }
    return HexType[category as keyof typeof HexType];
  }, [structure]);

  useEffect(() => {
    const owner = getComponentValue(Owner, structures[0]);
    if (owner) {
      if (owner.address === BigInt(account.account.address) && realmEntityId !== owner.entity_id) {
        setRealmEntityId(owner.entity_id);
      } else if (owner.address !== BigInt(account.account.address)) {
        setRealmEntityId(STARTING_ENTITY_ID);
      }
    }
  }, [structure]);

  const { neighborHexes, mainHex } = useMemo(() => {
    const mainHex = hexData?.find((hex) => hex.col === hexPosition.col && hex.row === hexPosition.row);

    const neighborHexes = getNeighborHexes(hexPosition.col, hexPosition.row);
    return { neighborHexes, mainHex };
  }, [hexPosition]);

  const neighborHexesInsideView = useMemo(() => {
    return neighborHexes.map((neighborHex) => {
      return hexData?.find((hex) => hex.col === neighborHex.col && hex.row === neighborHex.row);
    });
  }, [hexData, neighborHexes]);

  return {
    mainHex,
    neighborHexesInsideView,
    hexType,
  };
};
