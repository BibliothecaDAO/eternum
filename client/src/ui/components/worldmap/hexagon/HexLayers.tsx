import { Bvh } from "@react-three/drei";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Color, InstancedMesh, Matrix4 } from "three";
import { Resource, biomes, neighborOffsetsEven, neighborOffsetsOdd } from "@bibliothecadao/eternum";
import { createHexagonGeometry } from "./HexagonGeometry";
import useUIStore from "../../../../hooks/store/useUIStore";
import { findDirection, getColRowFromUIPosition, getUIPositionFromColRow } from "../../../utils/utils";
import { throttle } from "lodash";
import * as THREE from "three";
import { DesertBiome } from "../../models/biomes/DesertBiome";
import { SnowBiome } from "../../models/biomes/SnowBiome";
import { GrasslandBiome } from "../../models/biomes/GrasslandBiome";
import { TaigaBiome } from "../../models/biomes/TaigaBiome";
import { OceanBiome } from "../../models/biomes/OceanBiome";
import { DeepOceanBiome } from "../../models/biomes/DeepOceanBiome";
import { TemperateDesertBiome } from "../../models/biomes/TemperateDesertBiome";
import { BeachBiome } from "../../models/biomes/BeachBiome";
import { ScorchedBiome } from "../../models/biomes/ScorchedBiome";
import { ShrublandBiome } from "../../models/biomes/ShrublandBiome";
import { SubtropicalDesertBiome } from "../../models/biomes/SubtropicalDesertBiome";
import { DeciduousForestBiome } from "../../models/biomes/DeciduousForestBiome";
import { TropicalRainforestBiome } from "../../models/biomes/TropicalRainforestBiome";
import { TropicalSeasonalForestBiome } from "../../models/biomes/TropicalSeasonalForestBiome";
import { TundraBiome } from "../../models/biomes/TundraBiome.js";
import { TemperateRainforestBiome } from "../../models/biomes/TemperateRainforestBiome";
import { Hexagon, HighlightPosition } from "../../../../types/index";

import { findShortestPathBFS, getPositionsAtIndex, isNeighbor } from "./utils";
import { DEPTH, FELT_CENTER, HEX_RADIUS } from "./WorldHexagon";
import { useExplore } from "../../../../hooks/helpers/useExplore";
import { useTravel } from "../../../../hooks/helpers/useTravel";
import { useNotificationsStore } from "../../../../hooks/store/useNotificationsStore";
import { soundSelector, useUiSounds } from "../../../../hooks/useUISound";
import { useLocation } from "wouter";
import { useFrame } from "@react-three/fiber";

const BIOMES = biomes as Record<string, { color: string; depth: number }>;

const EXPLORE_COLOUR = 0xbc85e1;
const TRAVEL_COLOUR = 0x3cb93c;
const CLICKED_HEX_COLOR = 0xff5733;

type HexagonGridProps = {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
  explored: Map<number, Set<number>>;
};

type BiomeComponentType = React.ComponentType<{ hexes: Hexagon[]; zOffsets?: boolean }>;

interface BiomeComponentsMap {
  [key: string]: BiomeComponentType;
}

export const biomeComponents: BiomeComponentsMap = {
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
};

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

    // Object.keys(biomeComponents).forEach((biome) => {
    //   biomesAccumulator[biome] = group.filter((hex) => hex.biome === biome);
    // });

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
  const moveCameraToTarget = useUIStore((state) => state.moveCameraToTarget);
  const moveCameraToColRow = useUIStore((state) => state.moveCameraToColRow);
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);

  const { hoverHandler, clickHandler } = useEventHandlers(explored);

  const { group } = useMemo(() => {
    if (!hexData) return { group: [], colors: [] };
    const filteredGroup = hexData.filter((hex) => {
      const col = hex.col - FELT_CENTER;
      const row = hex.row - FELT_CENTER;
      return col >= startCol && col <= endCol && row >= startRow && row <= endRow;
    });

    return { group: filteredGroup };
  }, [startRow, endRow, startCol, endCol, hexData]);

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
      color: "green",
      vertexColors: false,
      transparent: true,
      opacity: 0.4, // Start fully transparent
      wireframe: false,
    });

    const edgesGeometry = new THREE.EdgesGeometry(hexagonGeometry);
    const edgesMaterial = new THREE.LineBasicMaterial({
      color: "black",
      linewidth: 1,
      transparent: true,
      opacity: 0.4,
    });
    const edgesMesh = new THREE.LineSegments(edgesGeometry, edgesMaterial);

    const instancedMesh = new InstancedMesh(hexagonGeometry, hexMaterial, revealedHexes.length);
    let idx = 0;
    let matrix = new Matrix4();
    revealedHexes.forEach((hex) => {
      const { x, y } = getUIPositionFromColRow(hex.col, hex.row);
      matrix.setPosition(x, y, 0.31);

      instancedMesh.setMatrixAt(idx, matrix);
      instancedMesh.setColorAt(idx, color.setRGB(0.4, 0.4, 0.4));

      // Add edges to each hexagon instance
      const edges = edgesMesh.clone();
      edges.applyMatrix4(matrix);
      instancedMesh.add(edges);

      idx++;
    });

    instancedMesh.computeBoundingSphere();
    instancedMesh.frustumCulled = true;
    return instancedMesh;
  }, [revealedHexes]);

  // // Animation logic
  // useFrame((state, delta) => {
  //   const opacityIncrease = delta * 0.5; // Adjust speed here
  //   mesh.material.opacity = Math.min(mesh.material.opacity + opacityIncrease, 0.4); // Ensure it does not exceed the maximum
  // });
  const throttledHoverHandler = useMemo(() => throttle(hoverHandler, 50), []);

  const [_, setLocation] = useLocation();

  const goToHex = useCallback(
    (e: any) => {
      const intersect = e.intersections.find((intersect: any) => intersect.object instanceof THREE.InstancedMesh);
      if (!intersect) return;
      const instanceId = intersect.instanceId;
      const mesh = intersect.object;
      const pos = getPositionsAtIndex(mesh, instanceId);
      if (!pos) return;
      const colRow = getColRowFromUIPosition(pos.x, pos.y);
      moveCameraToColRow(colRow.col, colRow.row, 1.5, true);
      setTimeout(() => {
        setIsLoadingScreenEnabled(true);
      }, 1000);
      setTimeout(() => {
        setLocation(`/hex?col=${colRow.col}&row=${colRow.row}`);
      }, 1300);
    },
    [moveCameraToTarget],
  );
  return (
    <Bvh firstHitOnly>
      <group onPointerEnter={(e) => throttledHoverHandler(e)} onClick={clickHandler}>
        <primitive object={mesh} onDoubleClick={goToHex} />
      </group>
    </Bvh>
  );
};

export const useEventHandlers = (explored: Map<number, Set<number>>) => {
  const hexData = useUIStore((state) => state.hexData);
  const highlightPositions = useUIStore((state) => state.highlightPositions);
  const isTravelMode = useUIStore((state) => state.isTravelMode);
  const isExploreMode = useUIStore((state) => state.isExploreMode);
  const selectedPath = useUIStore((state) => state.selectedPath);
  const selectedEntity = useUIStore((state) => state.selectedEntity);
  const isAttackMode = useUIStore((state) => state.isAttackMode);
  const setIsAttackMode = useUIStore((state) => state.setIsAttackMode);
  const setIsTravelMode = useUIStore((state) => state.setIsTravelMode);
  const setIsExploreMode = useUIStore((state) => state.setIsExploreMode);
  const setSelectedEntity = useUIStore((state) => state.setSelectedEntity);
  const setClickedHex = useUIStore((state) => state.setClickedHex);
  const clickedHex = useUIStore((state) => state.clickedHex);
  const setHighlightPositions = useUIStore((state) => state.setHighlightPositions);
  const setSelectedPath = useUIStore((state) => state.setSelectedPath);
  const setTravelingEntity = useUIStore((state) => state.setSelectedEntity);
  const setExploreNotification = useNotificationsStore((state) => state.setExploreNotification);
  const { play: playExplore } = useUiSounds(soundSelector.explore);
  // refs
  const isTravelModeRef = useRef(false);
  const isExploreModeRef = useRef(false);
  const selectedPathRef = useRef(selectedPath);
  const selectedEntityRef = useRef(selectedEntity);
  const hexDataRef = useRef(hexData);
  const exploredHexesRef = useRef(explored);
  const highlightPositionsRef = useRef(highlightPositions);
  const clickedHexRef = useRef(clickedHex);

  const { exploreHex } = useExplore();
  const { travelToHex } = useTravel();

  useEffect(() => {
    isTravelModeRef.current = isTravelMode;
    isExploreModeRef.current = isExploreMode;
    selectedPathRef.current = selectedPath;
    selectedEntityRef.current = selectedEntity;
    clickedHexRef.current = clickedHex;
    hexDataRef.current = hexData;
    exploredHexesRef.current = explored;
    highlightPositionsRef.current = highlightPositions;
  }, [
    isTravelMode,
    isExploreMode,
    isAttackMode,
    selectedPath,
    selectedEntity,
    hexData,
    explored,
    highlightPositions,
    clickedHex,
  ]);

  const hoverHandler = useCallback(
    (e: any) => {
      const intersect = e.intersections.find((intersect: any) => intersect.object instanceof THREE.InstancedMesh);
      if (!intersect) return;

      const instanceId = intersect.instanceId;
      const mesh = intersect.object;
      const pos = getPositionsAtIndex(mesh, instanceId);
      if (!pos || !hexDataRef.current || !exploredHexesRef.current) return;

      if (!selectedEntityRef.current) {
        const positions = [{ pos: [pos.x, -pos.y, pos.z], color: CLICKED_HEX_COLOR }];
        if (clickedHexRef.current) {
          positions.push({ pos: clickedHexRef.current.uiPos, color: CLICKED_HEX_COLOR });
        }
        setHighlightPositions(positions as HighlightPosition[]);
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
        setHighlightPositions([
          {
            pos: [selectedEntityPosition.x, -selectedEntityPosition.y, BIOMES[selectedEntityHex!.biome].depth * 10],
            color: 0xffffff,
          },
        ]);
      }
    },
    [setHighlightPositions],
  );

  function handleTravelMode({ pos }: any) {
    if (!selectedPathRef.current) {
      const colRow = getColRowFromUIPosition(pos.x, pos.y);
      let start = selectedEntityRef!.current!.position;
      let end = { x: colRow.col, y: colRow.row };
      let path = findShortestPathBFS(start, end, hexDataRef.current || [], exploredHexesRef.current, 3);
      const uiPath = path.map(({ x, y }) => {
        const pos = getUIPositionFromColRow(x, y);
        const hex = hexDataRef?.current?.find((h) => h.col === x && h.row === y);
        return { pos: [pos.x, -pos.y, hex ? BIOMES[hex.biome].depth * 10 : 0], color: TRAVEL_COLOUR };
      }) as HighlightPosition[];
      setHighlightPositions(uiPath);
    }
  }

  function handleExploreMode({ pos, selectedEntityPosition, selectedEntityHex }: any) {
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
          {
            pos: [selectedEntityPosition.x, -selectedEntityPosition.y, BIOMES[selectedEntityHex!.biome].depth * 10],
            color: EXPLORE_COLOUR,
          },
          { pos: [pos.x, -pos.y, pos.z], color: EXPLORE_COLOUR },
        ]);
      }
    }
  }
  const clearSelection = () => {
    setIsAttackMode(false);
    setIsExploreMode(false);
    setIsTravelMode(false);
    setSelectedEntity(undefined);
    setSelectedPath(undefined);
  };

  const clickHandler = useCallback(
    (e: any) => {
      // Logic for click event
      const intersect = e.intersections.find((intersect: any) => intersect.object instanceof THREE.InstancedMesh);
      if (intersect) {
        const instanceId = intersect.instanceId;
        const mesh = intersect.object;
        const pos = getPositionsAtIndex(mesh, instanceId);
        if (pos && !selectedEntityRef.current) {
          const clickedColRow = getColRowFromUIPosition(pos.x, pos.y);
          setClickedHex({
            contractPos: { col: clickedColRow.col, row: clickedColRow.row },
            uiPos: [pos.x, -pos.y, pos.z],
            hexIndex: instanceId,
          });
          setHighlightPositions([{ pos: [pos.x, -pos.y, pos.z], color: CLICKED_HEX_COLOR }]);
        }
        if (pos && selectedEntityRef.current) {
          if (isTravelModeRef.current || isExploreModeRef.current) {
            const path = highlightPositionsRef.current.map((p) => {
              const colRow = getColRowFromUIPosition(p.pos[0], -p.pos[1]);
              return { x: colRow.col, y: colRow.row };
            });
            if (path.length > 1) {
              setSelectedPath({
                id: selectedEntityRef.current.id,
                path,
              });
              if (isExploreModeRef.current) {
                handleExploreModeClick({
                  id: selectedEntityRef.current.id,
                  path,
                });
              } else {
                handleTravelModeClick({
                  travelingEntityId: selectedEntityRef.current.id,
                  path,
                });
              }
            } else {
              clearSelection();
            }
          } else {
            setSelectedEntity(undefined);
          }
        }
      }
    },
    [setHighlightPositions, hexData],
  );

  async function handleTravelModeClick({ travelingEntityId, path }: { travelingEntityId: bigint; path: any[] }) {
    // travelingEntity
    if (!travelingEntityId) return;
    const directions = path
      .map((_, i) => {
        if (path[i + 1] === undefined) return undefined;
        return findDirection({ col: path[i].x, row: path[i].y }, { col: path[i + 1].x, row: path[i + 1].y });
      })
      .filter((d) => d !== undefined) as number[];
    await travelToHex({ travelingEntityId, directions, path });
    // reset the state
    clearSelection();
  }

  async function handleExploreModeClick({ id, path }: { id: bigint; path: any[] }) {
    if (!selectedPathRef || !hexData) return;
    const direction =
      path.length === 2
        ? findDirection({ col: path[0].x, row: path[0].y }, { col: path[1].x, row: path[1].y })
        : undefined;
    const hexIndex = hexData.findIndex((h) => h.col === path[1].x && h.row === path[1].y);
    const biome = hexData[hexIndex].biome;
    setExploreNotification({
      entityId: id,
      biome,
    });
    playExplore();
    await exploreHex({
      explorerId: id,
      direction,
      path,
    });
    clearSelection();
  }

  return { hoverHandler, clickHandler };
};
