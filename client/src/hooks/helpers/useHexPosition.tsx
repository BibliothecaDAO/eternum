import { useEffect, useMemo } from "react";
import useUIStore from "@/hooks/store/useUIStore";
import useRealmStore from "@/hooks/store/useRealmStore";
import { useGetRealms } from "@/hooks/helpers/useRealm";
import { getNeighborHexes, neighborOffsetsEven, neighborOffsetsOdd } from "@bibliothecadao/eternum";
import { useSearch } from "wouter/use-location";
import { useEntityQuery } from "@dojoengine/react";
import { Has, HasValue, getComponentValue } from "@dojoengine/recs";
import { useDojo } from "../context/DojoContext";

export enum HexType {
  BANK = "bank",
  REALM = "realm",
  SHARDSMINE = "shardsmine",
  EMPTY = "empty",
}

export const useHexPosition = () => {
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);
  const hexData = useUIStore((state) => state.hexData);
  const moveCameraToRealmView = useUIStore((state) => state.moveCameraToRealmView);

  const { setRealmId, setRealmEntityId } = useRealmStore();

  const {
    setup: {
      components: { Structure, Position },
    },
  } = useDojo();

  const realms = useGetRealms();
  const searchString = useSearch();

  const hexPosition = useMemo(() => {
    const params = new URLSearchParams(searchString);
    const x = params.get("col");
    const y = params.get("row");
    return { col: Number(x), row: Number(y) };
  }, [searchString]);

  const structures = useEntityQuery([Has(Structure), HasValue(Position, { x: hexPosition.col, y: hexPosition.row })]);
  const structure = structures[0] ? getComponentValue(Structure, structures[0]) : undefined;
  const realm = structure ? realms.find((realm) => realm.entity_id === structure.entity_id) : undefined;

  const hexType: HexType = useMemo(() => {
    if (!structure) return HexType.EMPTY;
    const category = structure.category.toUpperCase();
    return HexType[category as keyof typeof HexType];
  }, [structure]);

  // useEffect(() => {
  //   if (realm) {
  //     setRealmId(realm.realmId);
  //     setRealmEntityId(realm.entity_id);
  //   }
  // }, [hexType, searchString, realm]);

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

  useEffect(() => {
    moveCameraToRealmView();
    setIsLoadingScreenEnabled(false);
  }, []);

  return {
    realm,
    mainHex,
    neighborHexesInsideView,
    hexType,
  };
};
