import { useEffect, useMemo, useState } from "react";
// @ts-ignore
import { Flags } from "@/ui/components/worldmap/Flags.jsx";
import useUIStore from "../../../../hooks/store/useUIStore.js";
import { useDojo } from "../../../../hooks/context/DojoContext.js";
import { Subscription } from "rxjs";
import { MyCastles, OtherCastles } from "../../models/buildings/worldmap/Castles.js";
import { BiomesGrid, HexagonGrid } from "./HexLayers.js";
import { Banks } from "../../models/buildings/worldmap/Banks.js";
import { Armies } from "../armies/Armies.js";
import { create } from "zustand";

interface ExploredHexesState {
  exploredHexes: Map<number, Set<number>>;
  setExploredHexes: (col: number, row: number) => void;
}

export const useExploredHexesStore = create<ExploredHexesState>((set) => ({
  exploredHexes: new Map(),

  setExploredHexes: (col, row) =>
    set((state) => {
      const newMap = new Map(state.exploredHexes);
      const rowSet = newMap.get(col) || new Set();
      rowSet.add(row);
      newMap.set(col, rowSet);
      return { exploredHexes: newMap };
    }),
}));

export const DEPTH = 10;
export const HEX_RADIUS = 3;
export const ROWS = 300;
export const COLS = 500;
export const FELT_CENTER = 2147483647;

export const WorldMap = () => {
  const {
    setup: {
      updates: {
        eventUpdates: { createExploreMapEvents: exploreMapEvents },
      },
    },
  } = useDojo();

  const hexData = useUIStore((state) => state.hexData);

  const hexagonGrids = useMemo(() => {
    const hexagonGrids = [];
    for (let i = 0; i < ROWS; i += 50) {
      const startRow = i;
      const endRow = startRow + 50;
      for (let j = 0; j < COLS; j += 50) {
        const startCol = j;
        const endCol = startCol + 50;
        hexagonGrids.push({ startRow, endRow, startCol, endCol });
      }
    }
    return hexagonGrids;
  }, []);

  const setExploredHexes = useExploredHexesStore((state) => state.setExploredHexes);
  const exploredHexes = useExploredHexesStore((state) => state.exploredHexes);

  useEffect(() => {
    let subscription: Subscription | undefined;

    const subscribeToExploreEvents = async () => {
      const observable = await exploreMapEvents();
      const sub = observable.subscribe((event) => {
        if (event && hexData) {
          const col = Number(event.keys[2]) - FELT_CENTER;
          const row = Number(event.keys[3]) - FELT_CENTER;
          setExploredHexes(col, row);
        }
      });
      subscription = sub;
    };
    subscribeToExploreEvents();

    return () => {
      subscription?.unsubscribe();
    };
  }, [hexData, setExploredHexes]);

  const models = useMemo(() => {
    return (
      <>
        {hexData && <MyCastles hexData={hexData} />}
        {hexData && <OtherCastles hexData={hexData} />}
        <Banks />
        <Armies />
      </>
    );
  }, [hexData]);

  return (
    <>
      <group rotation={[Math.PI / -2, 0, 0]} frustumCulled={true}>
        {hexagonGrids.map((grid, index) => {
          return <BiomesGrid key={index} {...grid} explored={exploredHexes} />;
        })}
        {hexagonGrids.map((grid, index) => {
          return <HexagonGrid key={index} {...grid} explored={exploredHexes} />;
        })}
      </group>
      {models}
      <Flags />
    </>
  );
};
