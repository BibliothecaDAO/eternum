import { Bvh } from "@react-three/drei";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Color, InstancedMesh, Matrix4 } from "three";
import { EternumGlobalConfig, neighborOffsetsEven, neighborOffsetsOdd } from "@bibliothecadao/eternum";
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
import { Hexagon, HighlightPositions } from "../../../../types/index";

import { findAccessiblePositions, findShortestPathBFS, getPositionsAtIndex, isNeighbor } from "./utils";
import { DEPTH, FELT_CENTER, HEX_RADIUS } from "./WorldHexagon";
import { useExplore } from "../../../../hooks/helpers/useExplore";
import { useTravel } from "../../../../hooks/helpers/useTravel";
import { useNotificationsStore } from "../../../../hooks/store/useNotificationsStore";
import { soundSelector, useUiSounds } from "../../../../hooks/useUISound";
import { useLocation } from "wouter";
import { HexGrid } from "../../models/biomes/HexGrid";
import { ArmyMode } from "@/hooks/store/_mapStore";
import { useStamina } from "@/hooks/helpers/useStamina";
import useBlockchainStore from "@/hooks/store/useBlockchainStore";

export const EXPLORE_COLOUR = 0x2563eb;
export const TRAVEL_COLOUR = 0x3cb93c;
const CLICKED_HEX_COLOR = 0xff5733;
const ACCESSIBLE_POSITIONS_COLOUR = 0xffffff;

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
          const { x, y, z } = getUIPositionFromColRow(group[hexIndex].col, group[hexIndex].row);
          addHexToBiomeAccumulator({ ...group[hexIndex], x, y, z });
        }
      });
    });

    // Object.keys(biomeComponents).forEach((biome) => {
    //   biomesAccumulator[biome] = group.filter((hex) => hex.biome === biome);
    //   biomesAccumulator[biome] = biomesAccumulator[biome].map((hex: any) => {
    //     const { x, y, z } = getUIPositionFromColRow(hex.col, hex.row);
    //     return { ...hex, x, y, z };
    //   });
    // });

    return biomesAccumulator;
  }, [explored]);

  return (
    <>
      {Object.entries(biomeHexes).map(([biome, hexes]: any) => {
        const BiomeComponent = biomeComponents[biome];
        return hexes.length ? <BiomeComponent key={biome} hexes={hexes} /> : null;
      })}
      <HexGrid hexes={group} />
    </>
  );
};

export const HexagonGrid = ({ startRow, endRow, startCol, endCol, explored }: HexagonGridProps) => {
  const hexData = useUIStore((state) => state.hexData);
  const moveCameraToTarget = useUIStore((state) => state.moveCameraToTarget);
  const moveCameraToColRow = useUIStore((state) => state.moveCameraToColRow);
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);
  const previewBuilding = useUIStore((state) => state.previewBuilding);

  const { hoverHandler, clickHandler, mouseOutHandler } = useEventHandlers(explored);

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
      <group onPointerEnter={(e) => throttledHoverHandler(e)} onClick={clickHandler} onPointerOut={mouseOutHandler}>
        <primitive object={mesh} onDoubleClick={goToHex} />
      </group>
    </Bvh>
  );
};

export const useSetPossibleActions = (explored: Map<number, Set<number>>) => {
  const selectedEntity = useUIStore((state) => state.selectedEntity);
  const setHighlightPositions = useUIStore((state) => state.setHighlightPositions);
  const hexData = useUIStore((state) => state.hexData);
  const { useStaminaByEntityId } = useStamina();

  const stamina = useStaminaByEntityId({ travelingEntityId: selectedEntity?.id || 0n });

  useMemo(() => {
    if (selectedEntity && hexData && stamina) {
      const maxTravelPossible = Math.floor((stamina?.amount || 0) / EternumGlobalConfig.stamina.travelCost);
      const canExplore = (stamina?.amount || 0) >= EternumGlobalConfig.stamina.exploreCost;
      const path = findAccessiblePositions(selectedEntity.position, hexData, explored, maxTravelPossible, canExplore);
      if (path.length > 1) {
        const uiPath = {
          pos: path.map(({ x, y }) => {
            const pos = getUIPositionFromColRow(x, y);
            return [pos.x, -pos.y];
          }),
          color: ACCESSIBLE_POSITIONS_COLOUR,
        } as HighlightPositions;
        setHighlightPositions(uiPath);
      }
    }
  }, [selectedEntity?.id, hexData, stamina]);
};

export const useEventHandlers = (explored: Map<number, Set<number>>) => {
  const { exploreHex } = useExplore();
  const { travelToHex } = useTravel();
  const { play: playExplore } = useUiSounds(soundSelector.explore);
  const setHoveredBuildHex = useUIStore((state) => state.setHoveredBuildHex);
  const setHoveredHex = useUIStore((state) => state.setHoveredHex);
  const currentArmiesTick = useBlockchainStore((state) => state.currentArmiesTick);

  const { getStamina } = useStamina();

  const {
    hexData,
    highlightPath,
    armyMode,
    setArmyMode,
    selectedEntity,
    setClickedHex,
    clickedHex,
    setHighlightPath,
    setHighlightPositions,
    clearSelection,
  } = useUIStore((state) => ({
    hexData: state.hexData,
    highlightPath: state.highlightPath,
    armyMode: state.armyMode,
    setArmyMode: state.setArmyMode,
    selectedEntity: state.selectedEntity,
    setSelectedEntity: state.setSelectedEntity,
    setClickedHex: state.setClickedHex,
    clickedHex: state.clickedHex,
    setHighlightPath: state.setHighlightPath,
    setHighlightPositions: state.setHighlightPositions,
    clearSelection: state.clearSelection,
  }));

  const setExploreNotification = useNotificationsStore((state) => state.setExploreNotification);

  // refs
  const armyModeRef = useRef<ArmyMode | null>(null);
  const selectedEntityRef = useRef(selectedEntity);
  const hexDataRef = useRef(hexData);
  const exploredHexesRef = useRef(explored);
  const highlightPathRef = useRef(highlightPath);
  const clickedHexRef = useRef(clickedHex);
  const currentArmiesTickRef = useRef(currentArmiesTick);

  useEffect(() => {
    armyModeRef.current = armyMode;
    selectedEntityRef.current = selectedEntity;
    clickedHexRef.current = clickedHex;
    hexDataRef.current = hexData;
    exploredHexesRef.current = explored;
    highlightPathRef.current = highlightPath;
    currentArmiesTickRef.current = currentArmiesTick;
  }, [selectedEntity, hexData, explored, highlightPath, clickedHex, currentArmiesTickRef]);

  const hoverHandler = useCallback(
    (e: any) => {
      const intersect = e.intersections.find((intersect: any) => intersect.object instanceof THREE.InstancedMesh);
      if (!intersect) return;

      const instanceId = intersect.instanceId;
      const mesh = intersect.object;
      const pos = getPositionsAtIndex(mesh, instanceId);
      if (!pos || !hexDataRef.current || !exploredHexesRef.current) return;

      const coord = getColRowFromUIPosition(pos.x, pos.y, false);
      setHoveredHex({
        col: coord.col,
        row: coord.row,
      });
      setHoveredBuildHex({
        col: coord.col,
        row: coord.row,
      });

      if (!selectedEntityRef.current) {
        const positions = [[pos.x, -pos.y]];
        if (clickedHexRef.current) {
          positions.push(clickedHexRef.current.uiPos);
        }
        // setHighlightPositions({ pos: positions, color: CLICKED_HEX_COLOR } as HighlightPositions);
        return;
      }

      const selectedEntityPosition = getUIPositionFromColRow(
        selectedEntityRef.current.position.x,
        selectedEntityRef.current.position.y,
      );

      handleTravelMode({ pos });
      handleExploreMode({ pos, selectedEntityPosition });
    },
    [setHighlightPath],
  );

  const mouseOutHandler = useCallback((e: any) => {
    if (clickedHexRef.current) {
      setHighlightPath({
        pos: [[clickedHexRef.current.uiPos[0], clickedHexRef.current.uiPos[1]]],
        color: CLICKED_HEX_COLOR,
      });
    } else {
      setHighlightPositions({ pos: [], color: 0 });
    }
    setHoveredHex(undefined);
  }, []);

  function handleTravelMode({ pos }: any) {
    const stamina = getStamina({
      travelingEntityId: selectedEntityRef!.current!.id || 0n,
      armiesTick: currentArmiesTickRef!.current,
    });
    if (!stamina) return;
    const colRow = getColRowFromUIPosition(pos.x, pos.y);

    let start = selectedEntityRef!.current!.position;
    const maxTravelPossible = Math.floor((stamina.amount || 0) / EternumGlobalConfig.stamina.travelCost);
    let end = { x: colRow.col, y: colRow.row };
    let path = findShortestPathBFS(start, end, hexDataRef.current || [], exploredHexesRef.current, maxTravelPossible);
    if (path.length > 1) {
      setArmyMode(ArmyMode.Travel);
      const colors = {
        pos: path.map(({ x, y }) => {
          const pos = getUIPositionFromColRow(x, y);
          return [pos.x, -pos.y];
        }),
        color: TRAVEL_COLOUR,
      } as HighlightPositions;
      setHighlightPath(colors);
    } else {
      setArmyMode(null);
    }
  }

  function handleExploreMode({ pos, selectedEntityPosition }: any) {
    const stamina = getStamina({
      travelingEntityId: selectedEntityRef!.current!.id || 0n,
      armiesTick: currentArmiesTickRef!.current,
    });
    if (!stamina) return;
    const canExplore = (stamina.amount || 0) >= EternumGlobalConfig.stamina.exploreCost;
    const colRow = getColRowFromUIPosition(pos.x, pos.y);
    if (
      canExplore &&
      selectedEntityRef?.current?.position &&
      isNeighbor(
        { x: colRow.col, y: colRow.row },
        {
          x: selectedEntityRef.current.position.x,
          y: selectedEntityRef.current.position.y,
        },
      ) &&
      !exploredHexesRef.current.get(colRow.col - FELT_CENTER)?.has(colRow.row - FELT_CENTER)
    ) {
      setArmyMode(ArmyMode.Explore);
      const uiPos = getUIPositionFromColRow(colRow.col, colRow.row);
      const colors = {
        pos: [
          [selectedEntityPosition.x, -selectedEntityPosition.y],
          [uiPos.x, -uiPos.y],
        ],
        color: EXPLORE_COLOUR,
      } as HighlightPositions;
      setHighlightPath(colors);
    }
  }

  const clickHandler = useCallback(
    (e: any) => {
      const intersect = e.intersections.find((intersect: any) => intersect.object instanceof THREE.InstancedMesh);
      if (!intersect) {
        clearSelection();
        return;
      }

      const instanceId = intersect.instanceId;
      const mesh = intersect.object;
      const pos = getPositionsAtIndex(mesh, instanceId);

      const handleHexClick = (pos: any, instanceId: any) => {
        const clickedColRow = getColRowFromUIPosition(pos.x, pos.y);
        if (
          clickedHexRef.current?.contractPos.col === clickedColRow.col &&
          clickedHexRef.current?.contractPos.row === clickedColRow.row
        ) {
          setClickedHex(undefined);
          setHighlightPath({ pos: [], color: 0 });
        } else {
          setClickedHex({
            contractPos: { col: clickedColRow.col, row: clickedColRow.row },
            uiPos: [pos.x, -pos.y, pos.z],
            hexIndex: instanceId,
          });
          setHighlightPath({ pos: [pos.x, -pos.y], color: CLICKED_HEX_COLOR });
        }
      };

      const handleArmyModeClick = (id: bigint) => {
        const path = highlightPathRef.current.pos.map((p) => {
          const colRow = getColRowFromUIPosition(p[0], -p[1]);
          return { x: colRow.col, y: colRow.row };
        });
        if (path.length > 1) {
          switch (armyModeRef.current) {
            case ArmyMode.Explore:
              handleExploreModeClick({ id, path });
              break;
            case ArmyMode.Travel:
              handleTravelModeClick({ travelingEntityId: id, path });
              break;
            default:
              clearSelection();
          }
        } else {
          clearSelection();
        }
      };

      if (pos) {
        if (!selectedEntityRef.current) {
          handleHexClick(pos, instanceId);
        } else {
          if (
            armyModeRef?.current !== undefined &&
            [ArmyMode.Travel, ArmyMode.Explore].includes(armyModeRef!.current!)
          ) {
            handleArmyModeClick(selectedEntityRef.current.id);
          } else {
            clearSelection();
          }
        }
      } else {
        clearSelection();
      }
    },
    [setHighlightPath, hexData],
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
    clearSelection();
    await travelToHex({ travelingEntityId, directions, path });
    // reset the state
  }

  async function handleExploreModeClick({ id, path }: { id: bigint; path: any[] }) {
    if (!hexData) return;
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
    clearSelection();
    await exploreHex({
      explorerId: id,
      direction,
      path,
    });
  }

  return { hoverHandler, clickHandler, mouseOutHandler };
};
