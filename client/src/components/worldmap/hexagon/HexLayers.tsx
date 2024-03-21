import { Bvh } from "@react-three/drei";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Color, InstancedMesh, Matrix4 } from "three";
import { biomes } from "@bibliothecadao/eternum";
import { createHexagonGeometry } from "./HexagonGeometry";
import useUIStore from "../../../hooks/store/useUIStore";
import { getColRowFromUIPosition, getUIPositionFromColRow } from "../../../utils/utils";
import { add, throttle } from "lodash";
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

const EXPLORE_COLOUR = 0x3cb93c;
const TRAVEL_COLOUR = 0xbc85e1;

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

    explored.forEach((rowSet, col) => {
      if (col < startCol || col > endCol) return;
      rowSet.forEach((row) => {
        if (row < startRow || row > endRow) return;
        const tmpCol = col + FELT_CENTER;
        const tmpRow = row + FELT_CENTER;
        const hexIndex = group.findIndex((hex) => hex.col === tmpCol && hex.row === tmpRow);
        if (group[hexIndex]) {
          addHexToBiomeAccumulator(group[hexIndex]);
        }
      });
    });

    return biomesAccumulator;
  }, [explored]);

  return (
    <>
      {Object.entries(biomeHexes).map(([biome, hexes]: any) => {
        const BiomeComponent = biomeComponents[biome];
        return hexes.length ? <BiomeComponent key={biome} hexes={hexes} /> : null;
      })}
    </>
  );
};

export const HexagonGrid = ({ startRow, endRow, startCol, endCol, explored }: HexagonGridProps) => {
  const hexData = useUIStore((state) => state.hexData);

  const { hoverHandler, clickHandler } = useEventHandlers(explored);

  const { group } = useMemo(() => {
    if (!hexData) return { group: [], colors: [] };
    const filteredGroup = hexData.filter((hex) => {
      const col = hex.col - FELT_CENTER;
      const row = hex.row - FELT_CENTER;
      return col >= startCol && col <= endCol && row >= startRow && row <= endRow;
    });

    return { group: filteredGroup };
  }, [startRow, endRow, startCol, endCol, HEX_RADIUS, hexData]);

  const revealedHexes = useMemo(() => {
    const revealed: Hexagon[] = [];
    explored.forEach((rowSet, col) => {
      if (col < startCol || col > endCol) return;
      rowSet.forEach((row) => {
        if (row < startRow || row > endRow) return;
        const tmpCol = col + FELT_CENTER;
        const tmpRow = row + FELT_CENTER;
        const hexIndex = group.findIndex((hex) => hex.col === tmpCol && hex.row === tmpRow);
        if (group[hexIndex]) {
          revealed.push(group[hexIndex]);
          neighborOffsets.forEach(([dCol, dRow]) => {
            const tmpCol = col + dCol + FELT_CENTER;
            const tmpRow = row + dRow + FELT_CENTER;
            const hexIndex = group.findIndex((hex) => hex.col === tmpCol && hex.row === tmpRow);
            if (group[hexIndex]) {
              revealed.push(group[hexIndex]);
            }
          });
        }
      });
    });
    return revealed;
  }, [group, explored]);

  // Create the mesh only once when the component is mounted
  const mesh: InstancedMesh = useMemo(() => {
    const hexagonGeometry = createHexagonGeometry(HEX_RADIUS, DEPTH);
    const hexMaterial = new THREE.MeshPhysicalMaterial({
      color: "darkgrey",
      vertexColors: false,
    });

    const instancedMesh = new InstancedMesh(hexagonGeometry, hexMaterial, revealedHexes.length);
    let idx = 0;
    let matrix = new Matrix4();
    revealedHexes.forEach((hex) => {
      const { x, y } = getUIPositionFromColRow(hex.col, hex.row);
      // set the z position with math.random to have a random height
      matrix.setPosition(x, y, 0.31);

      instancedMesh.setMatrixAt(idx, matrix);

      color.setStyle(BIOMES[hex.biome].color);
      const luminance = getGrayscaleColor(color);
      color.setRGB(luminance, luminance, luminance);
      instancedMesh.setColorAt(idx, color);
      idx++;
    });

    instancedMesh.computeBoundingSphere();
    instancedMesh.frustumCulled = true;
    return instancedMesh;
  }, [revealedHexes]);

  const throttledHoverHandler = useMemo(() => throttle(hoverHandler, 50), []);

  useEffect(() => {
    explored.forEach((rowSet, col) => {
      if (col < startCol || col > endCol) return;
      rowSet.forEach((row) => {
        if (row < startRow || row > endRow) return;
        const tmpCol = col + FELT_CENTER;
        const tmpRow = row + FELT_CENTER;
        const hexIndex = revealedHexes.findIndex((hex) => hex.col === tmpCol && hex.row === tmpRow);
        if (revealedHexes[hexIndex] && mesh) {
          color.setStyle(BIOMES[revealedHexes[hexIndex].biome].color);
          mesh.setColorAt(hexIndex, color);
          if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        }
      });
    });
  }, [startRow, startCol, endRow, endCol, explored, revealedHexes, mesh]);

  return (
    <Bvh firstHitOnly>
      <group onPointerEnter={(e) => throttledHoverHandler(e)} onClick={clickHandler}>
        <primitive object={mesh} />
      </group>
    </Bvh>
  );
};

const useEventHandlers = (explored: Map<number, Set<number>>) => {
  const store = useUIStore();
  const { hexData, highlightPositions, isTravelMode, isExploreMode, selectedPath, selectedEntity, isAttackMode } =
    store;

  const setHighlightColor = useUIStore((state) => state.setHighlightColor);
  const setHighlightPositions = useUIStore((state) => state.setHighlightPositions);
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
      const intersect = e.intersections.find((intersect: any) => intersect.object instanceof THREE.InstancedMesh);
      if (!intersect) return;

      const instanceId = intersect.instanceId;
      const mesh = intersect.object;
      const pos = getPositionsAtIndex(mesh, instanceId);
      if (!pos || !hexDataRef.current || !exploredHexesRef.current) return;

      if (!selectedEntityRef.current) {
        setHighlightColor(0xffffff);
        setHighlightPositions([[pos.x, -pos.y, pos.z]]);
        return;
      }

      const selectedEntityPosition = getUIPositionFromColRow(
        selectedEntityRef.current.position.x,
        selectedEntityRef.current.position.y,
      );
      const selectedEntityHex = hexDataRef.current.find(
        (h) => h.col === selectedEntityRef?.current?.position.x && h.row === selectedEntityRef.current.position.y,
      );

      if (isTravelModeRef.current) {
        handleTravelMode({ pos });
      } else if (isExploreModeRef.current) {
        handleExploreMode({ pos, selectedEntityPosition, selectedEntityHex });
      } else {
        setHighlightColor(0xffffff);
        setHighlightPositions([
          [selectedEntityPosition.x, -selectedEntityPosition.y, BIOMES[selectedEntityHex!.biome].depth * 10],
        ]);
      }
    },
    [setHighlightPositions, setHighlightColor],
  );

  function handleTravelMode({ pos }: any) {
    setHighlightColor(EXPLORE_COLOUR);
    if (!selectedPathRef.current) {
      const colRow = getColRowFromUIPosition(pos.x, pos.y);
      let start = selectedEntityRef!.current!.position;
      let end = { x: colRow.col, y: colRow.row };
      let path = findShortestPathBFS(start, end, hexDataRef.current || [], exploredHexesRef.current, 3);
      const uiPath = path.map(({ x, y }) => {
        const pos = getUIPositionFromColRow(x, y);
        const hex = hexDataRef?.current?.find((h) => h.col === x && h.row === y);
        return [pos.x, -pos.y, hex ? BIOMES[hex.biome].depth * 10 : 0];
      }) as [number, number, number][];
      setHighlightPositions(uiPath);
    }
  }

  function handleExploreMode({ pos, selectedEntityPosition, selectedEntityHex }: any) {
    setHighlightColor(TRAVEL_COLOUR);
    if (!selectedPathRef.current) {
      const colRow = getColRowFromUIPosition(pos.x, pos.y);
      if (
        selectedEntityRef?.current?.position &&
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
  }

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
