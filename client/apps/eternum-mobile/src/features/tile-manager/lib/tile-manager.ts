import { TileManager } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { BuildingType, HexPosition } from "@bibliothecadao/types";
import { useCallback, useState } from "react";

export const useTileManager = () => {
  const {
    setup: { components, systemCalls },
  } = useDojo();

  const [tileManager, setTileManager] = useState<TileManager | null>(null);

  const initializeTileManager = useCallback(
    (position: HexPosition) => {
      const manager = new TileManager(components, systemCalls, position);
      setTileManager(manager);
      return manager;
    },
    [components, systemCalls],
  );

  const setTile = useCallback(
    (position: HexPosition) => {
      if (!tileManager) {
        initializeTileManager(position);
      } else {
        tileManager.setTile(position);
      }
    },
    [tileManager, initializeTileManager],
  );

  const isHexOccupied = useCallback(
    (position: HexPosition) => {
      return tileManager?.isHexOccupied(position) ?? false;
    },
    [tileManager],
  );

  const placeBuilding = useCallback(
    async (
      account: any,
      structureEntityId: number,
      buildingType: BuildingType,
      position: HexPosition,
      useSimpleCost: boolean,
    ) => {
      if (!tileManager) {
        throw new Error("TileManager not initialized");
      }
      return tileManager.placeBuilding(account, structureEntityId, buildingType, position, useSimpleCost);
    },
    [tileManager],
  );

  const existingBuildings = useCallback(() => {
    return tileManager?.existingBuildings() ?? [];
  }, [tileManager]);

  const getHexCoords = useCallback(() => {
    return tileManager?.getHexCoords() ?? { col: 0, row: 0 };
  }, [tileManager]);

  const structureType = useCallback(() => {
    return tileManager?.structureType();
  }, [tileManager]);

  const getRealmLevel = useCallback(
    (structureEntityId: number) => {
      return tileManager?.getRealmLevel(structureEntityId) ?? 0;
    },
    [tileManager],
  );

  const getWonder = useCallback(
    (structureEntityId: number) => {
      return tileManager?.getWonder(structureEntityId) ?? false;
    },
    [tileManager],
  );

  return {
    tileManager,
    setTile,
    isHexOccupied,
    placeBuilding,
    existingBuildings,
    getHexCoords,
    structureType,
    getRealmLevel,
    getWonder,
  };
};
