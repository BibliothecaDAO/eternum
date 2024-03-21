import { Bvh } from "@react-three/drei";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Color, InstancedMesh, Matrix4 } from "three";
import { biomes } from "@bibliothecadao/eternum";
import { createHexagonGeometry } from "./HexagonGeometry";
import useUIStore from "../../../hooks/store/useUIStore";
import { getColRowFromUIPosition, getUIPositionFromColRow } from "../../../utils/utils";
import { throttle } from "lodash";
import * as THREE from "three";
import { DesertBiome } from "../biomes/DesertBiome";
import { SnowBiome } from "../biomes/SnowBiome";
import { GrasslandBiome } from "../biomes/GrasslandBiome";
import { TaigaBiome } from "../biomes/TaigaBiome";
import { OceanBiome } from "../biomes/OceanBiome";
import { DeepOceanBiome } from "../biomes/DeepOceanBiome";
import { TemperateDesertBiome } from "../biomes/TemperateDesertBiome";
import { BeachBiome } from "../biomes/BeachBiome";
import { ScorchedBiome } from "../biomes/ScorchedBiome";
import { ShrublandBiome } from "../biomes/ShrublandBiome";
import { SubtropicalDesertBiome } from "../biomes/SubtropicalDesertBiome";
import { DeciduousForestBiome } from "../biomes/DeciduousForestBiome";
import { TropicalRainforestBiome } from "../biomes/TropicalRainforestBiome";
import { TropicalSeasonalForestBiome } from "../biomes/TropicalSeasonalForestBiome";
import { TundraBiome } from "../biomes/TundraBiome.js";
import { TemperateRainforestBiome } from "../biomes/TemperateRainforestBiome";
import { Hexagon } from "../../../types/index";

import { findShortestPathBFS, getGrayscaleColor, getPositionsAtIndex, isNeighbor } from "./utils";
import { DEPTH, FELT_CENTER, HEX_RADIUS } from "./WorldHexagon";

const BIOMES = biomes as Record<string, { color: string; depth: number }>;

type HexagonGridProps = {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
  explored: Map<number, Set<number>>;
};

type BiomeComponentType = React.ComponentType<{ hexes: Hexagon[] }>;

interface BiomeComponentsMap {
  [key: string]: BiomeComponentType;
}

const color = new Color();

export const neighborOffsets = [
  [1, 0], // East
  [0, 1], // South-East
  [-1, 1], // South-West
  [-1, 0], // West
  [-1, -1], // North-West
  [0, -1], // North-East
];

export const BiomesGrid = ({ startRow, endRow, startCol, endCol, explored }: HexagonGridProps) => {
  const hexData = useUIStore((state) => state.hexData);

  const { group } = useMemo(() => {
    if (!hexData) return { group: [], colors: [] };

    return {
      group: hexData.filter(({ col, row }) => {
        const adjustedCol = col - FELT_CENTER;
        const adjustedRow = row - FELT_CENTER;
        return adjustedCol >= startCol && adjustedCol <= endCol && adjustedRow >= startRow && adjustedRow <= endRow;
      }),
      colors: [],
    };
  }, [startRow, endRow, startCol, endCol, hexData]);

  const biomeComponents: BiomeComponentsMap = useMemo(
    () => ({
      snow: SnowBiome,
      bare: DesertBiome,
      grassland: GrasslandBiome,
      taiga: TaigaBiome,
      ocean: OceanBiome,
      deep_ocean: DeepOceanBiome,
      temperate_desert: TemperateDesertBiome,
      beach: BeachBiome,
      scorched: ScorchedBiome,
      shrubland: ShrublandBiome,
      subtropical_desert: SubtropicalDesertBiome,
      temperate_deciduous_forest: DeciduousForestBiome,
      tropical_rain_forest: TropicalRainforestBiome,
      tropical_seasonal_forest: TropicalSeasonalForestBiome,
      tundra: TundraBiome,
      temperate_rain_forest: TemperateRainforestBiome,
    }),
    [],
  );

  const biomeHexes = useMemo(() => {
    const biomesAccumulator = Object.keys(biomeComponents).reduce((acc: any, biome) => {
      acc[biome] = [];
      return acc;
    }, {});

    // Function to safely add a hex to the accumulator without duplicates
    const addHexToBiomeAccumulator = (hex: any) => {
      if (!biomesAccumulator[hex.biome].includes(hex)) {
        biomesAccumulator[hex.biome].push(hex);
      }
    };

    group.forEach((hex) => {
      const col = hex.col - FELT_CENTER;
      const row = hex.row - FELT_CENTER;
      // Check if the hex is within the specified range
      if (col >= startCol && col <= endCol && row >= startRow && row <= endRow) {
        // Check if the hex or any of its neighbors are explored
        if (
          explored.get(col)?.has(row) ||
          neighborOffsets.some(([dCol, dRow]) => explored.get(col + dCol)?.has(row + dRow))
        ) {
          addHexToBiomeAccumulator(hex);
        }
      }
    });

    return biomesAccumulator;
  }, [explored, group, biomeComponents, neighborOffsets, startCol, endCol, startRow, endRow]);

  const { hoverHandler, clickHandler } = useEventHandlers(explored);

  const throttledHoverHandler = useMemo(() => throttle(hoverHandler, 50), []);

  return (
    <>
      {Object.entries(biomeHexes).map(([biome, hexes]: any) => {
        const BiomeComponent = biomeComponents[biome];
        return hexes.length ? (
          <mesh onPointerEnter={(e) => throttledHoverHandler(e)} onClick={clickHandler}>
            <BiomeComponent key={biome} hexes={hexes} />
          </mesh>
        ) : null;
      })}
    </>
  );
};

export const HexagonGrid = ({ startRow, endRow, startCol, endCol, explored }: HexagonGridProps) => {
  const hexData = useUIStore((state) => state.hexData);

  const { hoverHandler, clickHandler } = useEventHandlers(explored);

  // Helper function to check if a hex is a neighbor of any explored hex
  const isNextToExplored = useCallback(
    (col: number, row: number): boolean => {
      return neighborOffsets.some(([dCol, dRow]) => {
        const neighborCol = col + dCol;
        const neighborRow = row + dRow;
        // Check if the neighbor is explored, indicating the original hex is next to an explored one
        if (explored.get(neighborCol)?.has(neighborRow)) {
          return true;
        }
        // Now check the neighbors of the neighbor to see if any of those are explored
        return neighborOffsets.some(([ddCol, ddRow]) => {
          const nextNeighborCol = neighborCol + ddCol;
          const nextNeighborRow = neighborRow + ddRow;
          return explored.get(nextNeighborCol)?.has(nextNeighborRow);
        });
      });
    },
    [explored],
  );

  // Filter to include only unexplored hexes that are next to explored ones
  const { group } = useMemo(() => {
    if (!hexData) return { group: [] };

    const filteredGroup = hexData.filter((hex) => {
      const col = hex.col - FELT_CENTER;
      const row = hex.row - FELT_CENTER;
      const isExplored = explored.get(col)?.has(row);
      const isAdjacentToExplored = isNextToExplored(col, row);
      // Include hexes that are not explored but are adjacent to explored hexes or one step further
      return !isExplored && isAdjacentToExplored;
    });

    return { group: filteredGroup };
  }, [hexData, explored, isNextToExplored]);

  // Create the mesh for only unexplored hexes that are adjacent to explored hexes
  const mesh: InstancedMesh = useMemo(() => {
    const hexMaterial = new THREE.MeshPhysicalMaterial({
      color: "gray",
      vertexColors: false,
      opacity: 0.5,
      transparent: true,
    });
    const hexagonGeometry = createHexagonGeometry(HEX_RADIUS, DEPTH);

    const instancedMesh = new InstancedMesh(hexagonGeometry, hexMaterial, group.length);
    let idx = 0;
    let matrix = new Matrix4();
    group.forEach((hex) => {
      const { x, y } = getUIPositionFromColRow(hex.col, hex.row);
      const zPos = 0.5;
      matrix.setPosition(x, y, zPos);

      instancedMesh.setMatrixAt(idx, matrix);

      color.setStyle(BIOMES[hex.biome].color);
      // const luminance = getGrayscaleColor(color);
      // color.setRGB(luminance, luminance, luminance);
      instancedMesh.setColorAt(idx, color);
      idx++;
    });

    instancedMesh.computeBoundingSphere();
    instancedMesh.frustumCulled = true;
    return instancedMesh;
  }, [group]);

  const throttledHoverHandler = useMemo(() => throttle(hoverHandler, 50), [hoverHandler]);

  return (
    <Bvh firstHitOnly>
      <group onPointerEnter={(e) => throttledHoverHandler(e)} onClick={clickHandler}>
        <primitive object={mesh} />
      </group>
    </Bvh>
  );
};

const useEventHandlers = (explored: Map<number, Set<number>>) => {
  const hexData = useUIStore((state) => state.hexData);
  const highlightPositions = useUIStore((state) => state.highlightPositions);
  const setHighlightColor = useUIStore((state) => state.setHighlightColor);
  const setHighlightPositions = useUIStore((state) => state.setHighlightPositions);

  const isTravelMode = useUIStore((state) => state.isTravelMode);
  const isExploreMode = useUIStore((state) => state.isExploreMode);
  const isAttackMode = useUIStore((state) => state.isAttackMode);
  const selectedPath = useUIStore((state) => state.selectedPath);
  const selectedEntity = useUIStore((state) => state.selectedEntity);
  const setSelectedPath = useUIStore((state) => state.setSelectedPath);
  // refs
  const isTravelModeRef = useRef(false);
  const isExploreModeRef = useRef(false);
  const selectedPathRef = useRef(selectedPath);
  const selectedEntityRef = useRef(selectedEntity);
  const hexDataRef = useRef(hexData);
  const exploredHexesRef = useRef(explored);
  const highlightPositionsRef = useRef(highlightPositions);

  useEffect(() => {
    isTravelModeRef.current = isTravelMode;
    isExploreModeRef.current = isExploreMode;
    selectedPathRef.current = selectedPath;
    selectedEntityRef.current = selectedEntity;
    hexDataRef.current = hexData;
    exploredHexesRef.current = explored;
    highlightPositionsRef.current = highlightPositions;
  }, [isTravelMode, isExploreMode, isAttackMode, selectedPath, selectedEntity, hexData, explored, highlightPositions]);

  const hoverHandler = useCallback(
    (e: any) => {
      // Logic for hover event
      const intersect = e.intersections.find((intersect: any) => intersect.object instanceof THREE.InstancedMesh);
      if (intersect) {
        const instanceId = intersect.instanceId;
        const mesh = intersect.object;
        const pos = getPositionsAtIndex(mesh, instanceId);
        if (pos && hexDataRef.current && exploredHexesRef.current) {
          if (selectedEntityRef.current) {
            const selectedEntityPosition = getUIPositionFromColRow(
              selectedEntityRef.current.position.x,
              selectedEntityRef.current.position.y,
            );
            const selectedEntityHex = hexDataRef.current.find(
              (h) =>
                h.col === selectedEntityRef!.current!.position.x && h.row === selectedEntityRef!.current!.position.y,
            );
            // travel mode
            if (isTravelModeRef.current) {
              setHighlightColor(0x3cb93c);
              if (!selectedPathRef.current) {
                const colRow = getColRowFromUIPosition(pos.x, pos.y);
                let start = selectedEntityRef!.current!.position;
                let end = { x: colRow.col, y: colRow.row };
                let path = findShortestPathBFS(start, end, hexDataRef.current, exploredHexesRef.current, 3);
                const uiPath = path.map(({ x, y }) => {
                  const pos = getUIPositionFromColRow(x, y);
                  const hex = hexDataRef!.current!.find((h) => h.col === x && h.row === y);
                  return [pos.x, -pos.y, hex ? BIOMES[hex.biome].depth * 10 : 0];
                }) as [number, number, number][];
                setHighlightPositions(uiPath);
              }
            } else if (isExploreModeRef.current) {
              setHighlightColor(0xbc85e1);
              if (!selectedPathRef.current) {
                // needs to be neighbor and not explored
                const colRow = getColRowFromUIPosition(pos.x, pos.y);
                if (
                  selectedEntityRef.current.position &&
                  isNeighbor(
                    { x: colRow.col, y: colRow.row },
                    {
                      x: selectedEntityRef.current.position.x,
                      y: selectedEntityRef.current.position.y,
                    },
                  ) &&
                  !exploredHexesRef.current.get(colRow.col - 2147483647)?.has(colRow.row - 2147483647)
                ) {
                  setHighlightPositions([
                    [selectedEntityPosition.x, -selectedEntityPosition.y, BIOMES[selectedEntityHex!.biome].depth * 10],
                    [pos.x, -pos.y, pos.z],
                  ]);
                }
              }
            } else {
              setHighlightColor(0xffffff);
              setHighlightPositions([
                [selectedEntityPosition.x, -selectedEntityPosition.y, BIOMES[selectedEntityHex!.biome].depth * 10],
              ]);
            }
          } else {
            setHighlightColor(0xffffff);
            setHighlightPositions([[pos.x, -pos.y, pos.z]]);
          }
        }
      }
    },
    [setHighlightPositions, setHighlightColor],
  );

  const clickHandler = useCallback(
    (e: any) => {
      // Logic for click event
      const intersect = e.intersections.find((intersect: any) => intersect.object instanceof THREE.InstancedMesh);
      if (intersect) {
        const instanceId = intersect.instanceId;
        const mesh = intersect.object;
        const pos = getPositionsAtIndex(mesh, instanceId);
        if (pos && selectedEntityRef.current) {
          if (isTravelModeRef.current || isExploreModeRef.current) {
            const path = highlightPositionsRef.current.map((p) => {
              const colRow = getColRowFromUIPosition(p[0], -p[1]);
              return { x: colRow.col, y: colRow.row };
            });
            console.log({ path });
            if (path.length > 1)
              setSelectedPath({
                id: selectedEntityRef.current.id,
                path,
              });
          }
        }
      }
    },
    [setHighlightPositions],
  );

  return { hoverHandler, clickHandler };
};
