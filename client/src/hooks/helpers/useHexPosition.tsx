import { useEffect, useMemo } from "react";
import useUIStore from "@/hooks/store/useUIStore";
import useRealmStore from "@/hooks/store/useRealmStore";
import { useGetRealms } from "@/hooks/helpers/useRealm";
import { neighborOffsetsEven, neighborOffsetsOdd } from "@bibliothecadao/eternum";
import { useSearch } from "wouter/use-location";
import { useEntityQuery } from "@dojoengine/react";
import { Has, HasValue } from "@dojoengine/recs";
import { useDojo } from "../context/DojoContext";

export enum HexType {
  BANK = "bank",
  REALM = "realm",
  EMPTY = "empty",
}

export const useHexPosition = () => {
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);
  const hexData = useUIStore((state) => state.hexData);
  const moveCameraToRealmView = useUIStore((state) => state.moveCameraToRealmView);

  const { setRealmId, setRealmEntityId } = useRealmStore();

  const {
    setup: {
      components: { Bank, Position },
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

  const realm = useMemo(() => {
    const _tmp = realms.find((realm) => realm.position.x === hexPosition.col && realm.position.y === hexPosition.row);
    if (!_tmp) return undefined;
    return _tmp;
  }, [hexPosition, realms]);

  const banks = useEntityQuery([Has(Bank), HasValue(Position, { x: hexPosition.col, y: hexPosition.row })]);

  const hexType: HexType = useMemo(() => {
    if (banks.length > 0) return HexType.BANK;
    if (realm) return HexType.REALM;
    return HexType.EMPTY;
  }, [banks, realm]);

  useEffect(() => {
    if (realm) {
      setRealmId(realm.realmId);
      setRealmEntityId(realm.entity_id);
    }
  }, [realm, searchString, realms]);

  const { neighborHexes, mainHex } = useMemo(() => {
    const mainHex = hexData?.find((hex) => hex.col === hexPosition.col && hex.row === hexPosition.row);

    const neighborOffsets = hexPosition.row % 2 !== 0 ? neighborOffsetsEven : neighborOffsetsOdd;
    const neighborHexes = neighborOffsets.map((neighbor: { i: number; j: number; direction: number }) => {
      const tmpCol = hexPosition.col + neighbor.i;
      const tmpRow = hexPosition.row + neighbor.j;
      return { col: tmpCol, row: tmpRow };
    });
    return { neighborHexes, mainHex };
  }, [hexPosition]);

  const neighborHexesInsideView = useMemo(() => {
    return hexData?.filter((hex) =>
      neighborHexes?.some((neighborHex: any) => neighborHex.col === hex.col && neighborHex.row === hex.row),
    );
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
