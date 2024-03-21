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

export const DEPTH = 10;
export const HEX_RADIUS = 3;

const BIOMES = biomes as Record<string, { color: string; depth: number }>;

type HexagonGridProps = {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
  explored: Map<number, Set<number>>;
};

const color = new Color();

export const BiomesGrid = ({ startRow, endRow, startCol, endCol, explored }: HexagonGridProps) => {
  const hexData = useUIStore((state) => state.hexData);

  const { group } = useMemo(() => {
    if (!hexData) return { group: [], colors: [] };
    const filteredGroup = hexData.filter((hex) => {
      const col = hex.col - 2147483647;
      const row = hex.row - 2147483647;
      return col >= startCol && col <= endCol && row >= startRow && row <= endRow;
    });

    let colorValues: number[] = [];

    return { group: filteredGroup, colors: colorValues };
  }, [startRow, endRow, startCol, endCol, HEX_RADIUS, hexData]);

  // Create the mesh only once when the component is mounted

  //biomes: grassland, snow, temperate_desert, taiga, deciduous_forest
  const biomes = [
    "grassland",
    "snow",
    "bare",
    "taiga",
    "temperate_deciduous_forest",
    "ocean",
    "deep_ocean",
    "temperate_desert",
    "beach",
    "scorched",
    "shrubland",
    "subtropical_desert",
    "tropical_rain_forest",
    "tropical_seasonal_forest",
    "tundra",
    "temperate_rain_forest",
  ];

  // useEffect(() => {
  //   explored.forEach((rowSet, col) => {
  //     if (col < startCol || col > endCol) return;
  //     rowSet.forEach((row) => {
  //       if (row < startRow || row > endRow) return;
  //       const tmpCol = col + 2147483647;
  //       const tmpRow = row + 2147483647;
  //       const hexIndex = group.findIndex((hex) => hex.col === tmpCol && hex.row === tmpRow);
  //       if (group[hexIndex] && mesh) {
  //         color.setStyle(BIOMES[group[hexIndex].biome].color);
  //         mesh.setColorAt(hexIndex, color);
  //         if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  //       }
  //     });
  //   });
  // }, [startRow, startCol, endRow, endCol, explored, group, mesh]);

  const biomeHexes = useMemo(() => {
    const biomeHexes = {
      deep_ocean: [],
      ocean: [],
      beach: [],
      scorched: [],
      bare: [],
      tundra: [],
      snow: [],
      temperate_desert: [],
      shrubland: [],
      taiga: [],
      grassland: [],
      temperate_deciduous_forest: [],
      temperate_rain_forest: [],
      subtropical_desert: [],
      tropical_seasonal_forest: [],
      tropical_rain_forest: [],
    } as Record<string, Hexagon[]>;
    explored.forEach((rowSet, col) => {
      if (col < startCol || col > endCol) return;
      rowSet.forEach((row) => {
        if (row < startRow || row > endRow) return;
        const tmpCol = col + 2147483647;
        const tmpRow = row + 2147483647;
        const hexIndex = group.findIndex((hex) => hex.col === tmpCol && hex.row === tmpRow);
        if (group[hexIndex]) {
          biomeHexes[group[hexIndex].biome].push(group[hexIndex]);
        }
      });
    });
    return biomeHexes;
  }, [explored]);

  return (
    <>
      {biomeHexes["snow"].length ? <SnowBiome hexes={biomeHexes["snow"]} /> : <></>}
      {biomeHexes["bare"].length ? <DesertBiome hexes={biomeHexes["bare"]} /> : <></>}
      {biomeHexes["grassland"].length ? <GrasslandBiome hexes={biomeHexes["grassland"]} /> : <></>}
      {biomeHexes["taiga"].length ? <TaigaBiome hexes={biomeHexes["taiga"]} /> : <></>}
      {biomeHexes["ocean"].length ? <OceanBiome hexes={biomeHexes["ocean"]} /> : <></>}
      {biomeHexes["deep_ocean"].length ? <DeepOceanBiome hexes={biomeHexes["deep_ocean"]} /> : <></>}
      {biomeHexes["temperate_desert"].length ? <TemperateDesertBiome hexes={biomeHexes["temperate_desert"]} /> : <></>}
      {biomeHexes["beach"].length ? <BeachBiome hexes={biomeHexes["beach"]} /> : <></>}
      {biomeHexes["scorched"].length ? <ScorchedBiome hexes={biomeHexes["scorched"]} /> : <></>}
      {biomeHexes["shrubland"].length ? <ShrublandBiome hexes={biomeHexes["shrubland"]} /> : <></>}
      {biomeHexes["subtropical_desert"].length ? (
        <SubtropicalDesertBiome hexes={biomeHexes["subtropical_desert"]} />
      ) : (
        <></>
      )}
      {biomeHexes["temperate_deciduous_forest"].length ? (
        <DeciduousForestBiome hexes={biomeHexes["temperate_deciduous_forest"]} />
      ) : (
        <></>
      )}
      {biomeHexes["tropical_rain_forest"].length ? (
        <TropicalRainforestBiome hexes={biomeHexes["tropical_rain_forest"]} />
      ) : (
        <></>
      )}
      {biomeHexes["tropical_seasonal_forest"].length ? (
        <TropicalSeasonalForestBiome hexes={biomeHexes["tropical_seasonal_forest"]} />
      ) : (
        <></>
      )}
      {biomeHexes["tundra"].length ? <TundraBiome hexes={biomeHexes["tundra"]} /> : <></>}
      {biomeHexes["temperate_rain_forest"].length ? (
        <TemperateRainforestBiome hexes={biomeHexes["temperate_rain_forest"]} />
      ) : (
        <></>
      )}
    </>
  );
};

export const HexagonGrid = ({ startRow, endRow, startCol, endCol, explored }: HexagonGridProps) => {
  const hexData = useUIStore((state) => state.hexData);

  const { hoverHandler, clickHandler } = useEventHandlers(explored);

  const { group, colors } = useMemo(() => {
    if (!hexData) return { group: [], colors: [] };
    const filteredGroup = hexData.filter((hex) => {
      const col = hex.col - 2147483647;
      const row = hex.row - 2147483647;
      return col >= startCol && col <= endCol && row >= startRow && row <= endRow;
    });

    return { group: filteredGroup };
  }, [startRow, endRow, startCol, endCol, HEX_RADIUS, hexData]);

  // Create the mesh only once when the component is mounted
  const mesh: InstancedMesh = useMemo(() => {
    const hexagonGeometry = createHexagonGeometry(HEX_RADIUS, DEPTH);
    const hexMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      vertexColors: false,
    });

    const instancedMesh = new InstancedMesh(hexagonGeometry, hexMaterial, group.length);
    let idx = 0;
    let matrix = new Matrix4();
    group.forEach((hex) => {
      const { x, y } = getUIPositionFromColRow(hex.col, hex.row);
      // set the z position with math.random to have a random height
      const zPos = hex.biome === "ocean" ? 0.31 : 0.31 + Math.random() * 0.15;
      matrix.setPosition(x, y, zPos);

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
  }, [group, colors]);

  const throttledHoverHandler = useMemo(() => throttle(hoverHandler, 50), []);

  useEffect(() => {
    explored.forEach((rowSet, col) => {
      if (col < startCol || col > endCol) return;
      rowSet.forEach((row) => {
        if (row < startRow || row > endRow) return;
        const tmpCol = col + 2147483647;
        const tmpRow = row + 2147483647;
        const hexIndex = group.findIndex((hex) => hex.col === tmpCol && hex.row === tmpRow);
        if (group[hexIndex] && mesh) {
          color.setStyle(BIOMES[group[hexIndex].biome].color);
          mesh.setColorAt(hexIndex, color);
          if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        }
      });
    });
  }, [startRow, startCol, endRow, endCol, explored, group, mesh]);

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
