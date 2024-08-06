import { useEffect, useMemo, useRef } from "react";
// @ts-ignore
import { Flags } from "@/ui/components/worldmap/Flags.jsx";
import { COLS, FELT_CENTER, ROWS } from "@/ui/config.js";
import { Subscription } from "rxjs";
import { create } from "zustand";
import { useDojo } from "../../../../hooks/context/DojoContext";
import { Banks } from "../../models/buildings/worldmap/Banks";
import { Battles } from "../../models/buildings/worldmap/Battles";
import { Structures } from "../../models/buildings/worldmap/Structures.js";
import { Armies } from "../armies/Armies.js";
import { BiomesGrid, HexagonGrid } from "./HexLayers.js";

interface ExploredHexesState {
  exploredHexes: Map<number, Set<number>>;
  setExploredHexes: (col: number, row: number) => void;
  removeHex: (col: number, row: number) => void;
}

export const useExploredHexesStore = create<ExploredHexesState>((set) => ({
  exploredHexes: new Map<number, Set<number>>(),

  setExploredHexes: (col: number, row: number) =>
    set((state) => {
      const newMap = new Map(state.exploredHexes);
      if (!newMap.has(col)) {
        newMap.set(col, new Set());
      }
      newMap.get(col)!.add(row);
      return { exploredHexes: newMap };
    }),
  removeHex: (col: number, row: number) =>
    set((state) => {
      const newMap = new Map(state.exploredHexes);
      if (newMap.has(col)) {
        const rowSet = newMap.get(col);
        rowSet?.delete(row);
        if (rowSet?.size === 0) {
          newMap.delete(col);
        }
      }
      return { exploredHexes: newMap };
    }),
}));

export const WorldMap = () => {
  const {
    setup: {
      updates: {
        eventUpdates: { createExploreMapEvents: exploreMapEvents },
      },
    },
  } = useDojo();

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

  const subscriptionRef = useRef<Subscription | undefined>();
  const isComponentMounted = useRef(true);

  useEffect(() => {
    if (!exploreMapEvents) return;

    const subscribeToExploreEvents = async () => {
      const observable = await exploreMapEvents();
      const subscription = observable.subscribe((event) => {
        if (!isComponentMounted.current) {
          return;
        }
        if (event) {
          const col = Number(event.keys[2]) - FELT_CENTER;
          const row = Number(event.keys[3]) - FELT_CENTER;
          setExploredHexes(col, row);
        }
      });
      subscriptionRef.current = subscription;
    };

    subscribeToExploreEvents();

    return () => {
      isComponentMounted.current = false;
      subscriptionRef.current?.unsubscribe(); // Ensure to unsubscribe on component unmount
    };
  }, [setExploredHexes, exploreMapEvents]);

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
      <Armies />
      <Structures />
      <Battles />
      <Flags />
      <Banks />
    </>
  );
};
