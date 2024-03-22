import { Bvh } from "@react-three/drei";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Color, InstancedMesh, Matrix4 } from "three";
import { Resource, biomes, neighborOffsetsEven, neighborOffsetsOdd } from "@bibliothecadao/eternum";
import { createHexagonGeometry } from "./HexagonGeometry";
import useUIStore from "../../../hooks/store/useUIStore";
import { findDirection, getColRowFromUIPosition, getUIPositionFromColRow } from "../../../utils/utils";
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

import { findShortestPathBFS, getPositionsAtIndex, isNeighbor } from "./utils";
import { DEPTH, FELT_CENTER, HEX_RADIUS } from "./WorldHexagon";
import { useExplore } from "../../../hooks/helpers/useExplore";

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
          const neighborOffsets = row % 2 !== 0 ? neighborOffsetsEven : neighborOffsetsOdd;
          neighborOffsets.forEach((neighbor: { i: number; j: number; direction: number }) => {
            const tmpCol = col + neighbor.i + FELT_CENTER;
            const tmpRow = row + neighbor.j + FELT_CENTER;
            const ind = group.findIndex((hex) => hex.col === tmpCol && hex.row === tmpRow);
            if (group[ind] && !revealed.some((hex) => hex.col === tmpCol && hex.row === tmpRow)) {
              revealed.push(group[ind]);
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
    const hexMaterial = new THREE.MeshStandardMaterial({
      color: "darkgrey",
      vertexColors: false,
      transparent: true,
      opacity: 0.5,
    });

    const instancedMesh = new InstancedMesh(hexagonGeometry, hexMaterial, revealedHexes.length);
    let idx = 0;
    let matrix = new Matrix4();
    revealedHexes.forEach((hex) => {
      const { x, y } = getUIPositionFromColRow(hex.col, hex.row);
      // set the z position with math.random to have a random height
      matrix.setPosition(x, y, 0.31);

      instancedMesh.setMatrixAt(idx, matrix);

      // color.setStyle(BIOMES[hex.biome].color);
      color.setRGB(0.4, 0.4, 0.4);
      instancedMesh.setColorAt(idx, color);
      idx++;
    });

    instancedMesh.computeBoundingSphere();
    instancedMesh.frustumCulled = true;
    return instancedMesh;
  }, [revealedHexes]);

  const throttledHoverHandler = useMemo(() => throttle(hoverHandler, 50), []);

  return (
    <Bvh firstHitOnly>
      <group onPointerEnter={(e) => throttledHoverHandler(e)} onClick={clickHandler}>
        <primitive object={mesh} />
      </group>
    </Bvh>
  );
};

const useEventHandlers = (explored: Map<number, Set<number>>) => {
  const {
    hexData,
    highlightPositions,
    isTravelMode,
    isExploreMode,
    selectedPath,
    selectedEntity,
    isAttackMode,
    setIsAttackMode,
    setIsTravelMode,
    setIsExploreMode,
    setSelectedEntity,
  } = useUIStore();
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

  const { exploreHex } = useExplore();

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
            if (path.length > 1) {
              setSelectedPath({
                id: selectedEntityRef.current.id,
                path,
              });
              handleExploreModeClick({
                id: selectedEntityRef.current.id,
                path,
              });
            } else {
              setSelectedEntity(undefined);
              setIsAttackMode(false);
              setIsTravelMode(false);
              setIsExploreMode(false);
              setSelectedPath(undefined);
            }
          } else {
            setSelectedEntity(undefined);
          }
        }
      }
    },
    [setHighlightPositions],
  );

  async function handleExploreModeClick({ id, path }: { id: bigint; path: any[] }) {
    if (!selectedPathRef) return;
    const direction =
      path.length === 2
        ? findDirection({ col: path[0].x, row: path[0].y }, { col: path[1].x, row: path[1].y })
        : undefined;
    await exploreHex({
      explorerId: id,
      direction,
    });
  }

  return { hoverHandler, clickHandler };
};
