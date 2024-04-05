import { useEffect, useMemo, useState } from "react";
// @ts-ignore
import { Flags } from "../Flags.jsx";
import useUIStore from "../../../hooks/store/useUIStore";
import { useDojo } from "../../../DojoContext";
import { Subscription } from "rxjs";
import { MyCastles, OtherCastles } from "../Castles";
import { Armies } from "../armies/Armies";
import { Hexagon } from "../../../types";
import { BiomesGrid, HexagonGrid } from "./HexLayers";

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

  const [exploredHexes, setExploredHexes] = useState<Map<number, Set<number>>>(new Map());

  useEffect(() => {
    let subscription: Subscription | undefined;

    const subscribeToExploreEvents = async () => {
      const observable = await exploreMapEvents();
      const sub = observable.subscribe((event) => {
        if (event && hexData) {
          const col = Number(event.keys[2]) - FELT_CENTER;
          const row = Number(event.keys[3]) - FELT_CENTER;
          setExploredHexes((prev) => {
            const newMap = new Map(prev);
            const rowSet = newMap.get(col) || new Set();
            rowSet.add(row);
            newMap.set(col, rowSet);
            return newMap;
          });
        }
      });
      subscription = sub;
    };
    subscribeToExploreEvents();

    return () => {
      subscription?.unsubscribe();
    };
  }, [hexData]);

  const models = useMemo(() => {
    return (
      <>
        {hexData && <MyCastles hexData={hexData} />}
        {hexData && <OtherCastles hexData={hexData} />}
        {/* {hexData && <Hyperstructures hexData={hexData} />} */}
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
