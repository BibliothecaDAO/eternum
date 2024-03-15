import { Bvh, Environment } from "@react-three/drei";
import { MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BufferAttribute,
  Color,
  ExtrudeGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Vector2,
  Vector3,
} from "three";
import { useThree } from "@react-three/fiber";
import { createHexagonGeometry, createHexagonShape } from "./components/three/HexagonBackground";
// @ts-ignore
import { Flags } from "../../components/worldmap/Flags.jsx";
import useUIStore from "../../hooks/store/useUIStore";
import { useDojo } from "../../DojoContext";
import { Subscription } from "rxjs";
import { getColRowFromUIPosition, getUIPositionFromColRow } from "../../utils/utils";
import { MyCastles, OtherCastles } from "./Castles";
import { Hyperstructures } from "./Hyperstructures";
import { Position, biomes, neighborOffsetsEven, neighborOffsetsOdd } from "@bibliothecadao/eternum";
import { Armies, TravelingArmies } from "./armies/Armies";
import { throttle } from "lodash";
import * as THREE from "three";
import { DesertBiome } from "./biomes/DesertBiome";
import { SnowBiome } from "./biomes/SnowBiome";
import { GrasslandBiome } from "./biomes/GrasslandBiome";
import { TaigaBiome } from "./biomes/TaigaBiome";
import { OceanBiome } from "./biomes/OceanBiome";
import { DeepOceanBiome } from "./biomes/DeepOceanBiome";
import { TemperateDesertBiome } from "./biomes/TemperateDesertBiome";
import { BeachBiome } from "./biomes/BeachBiome";
import { ScorchedBiome } from "./biomes/ScorchedBiome";
import { ShrublandBiome } from "./biomes/ShrublandBiome";
import { SubtropicalDesertBiome } from "./biomes/SubtropicalDesertBiome";
import { DeciduousForestBiome } from "./biomes/DeciduousForestBiome";
import { EnemyArmies } from "./armies/EnemyArmies";

export const DEPTH = 10;
export const HEX_RADIUS = 3;

const BIOMES = biomes as Record<string, { color: string; depth: number }>;

export interface Hexagon {
  idx: number;
  col: number;
  row: number;
  biome: string;
  explored: boolean | undefined;
  // address
  exploredBy: bigint | undefined;
}

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
    </>
  );
};

export const HexagonGrid = ({ startRow, endRow, startCol, endCol, explored }: HexagonGridProps) => {
  const hexData = useUIStore((state) => state.hexData);

  const highlightPositions = useUIStore((state) => state.highlightPositions);
  const highlightColor = useUIStore((state) => state.highlightColor);
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
  const isAttackModeRef = useRef(false);
  const selectedPathRef = useRef(selectedPath);
  const selectedEntityRef = useRef(selectedEntity);
  const hexDataRef = useRef(hexData);
  const exploredHexesRef = useRef(explored);

  useEffect(() => {
    isTravelModeRef.current = isTravelMode;
    isExploreModeRef.current = isExploreMode;
    isAttackModeRef.current = isAttackMode;
    selectedPathRef.current = selectedPath;
    selectedEntityRef.current = selectedEntity;
    hexDataRef.current = hexData;
    exploredHexesRef.current = explored;
  }, [isTravelMode, isExploreMode, isAttackMode, selectedPath, selectedEntity, hexData, explored]);

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
      matrix.setPosition(x, y, 0.31);
      // set height of hex
      // matrix.setPosition(x, y, BIOMES[hex.biome].depth);

      instancedMesh.setMatrixAt(idx, matrix);

      color.setStyle(BIOMES[hex.biome].color);
      const luminance = getGrayscaleColor(color);
      color.setRGB(luminance, luminance, luminance);
      instancedMesh.setColorAt(idx, color);
      idx++;
    });

    // const colorAttribute = new InstancedBufferAttribute(new Float32Array(colors), 3);
    // instancedMesh.geometry.setAttribute("color", colorAttribute);
    instancedMesh.computeBoundingSphere();
    instancedMesh.frustumCulled = true;
    return instancedMesh;
  }, [group, colors]);

  const hoverHandler = (e: any) => {
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
            (h) => h.col === selectedEntityRef!.current!.position.x && h.row === selectedEntityRef!.current!.position.y,
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
  };

  const clickHandler = (e: any) => {
    const intersect = e.intersections.find((intersect: any) => intersect.object instanceof THREE.InstancedMesh);
    if (intersect) {
      const instanceId = intersect.instanceId;
      const mesh = intersect.object;
      const pos = getPositionsAtIndex(mesh, instanceId);
      if (pos && selectedEntityRef.current) {
        if (isTravelModeRef.current || isExploreModeRef.current) {
          const path = highlightPositions.map((p) => {
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
  };

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

export const WorldMap = () => {
  const {
    setup: {
      updates: {
        eventUpdates: { createExploreMapEvents: exploreMapEvents },
      },
    },
  } = useDojo();

  const hexData = useUIStore((state) => state.hexData);
  const setHexData = useUIStore((state) => state.setHexData);

  useEffect(() => {
    fetch("/jsons/hexData.json")
      .then((response) => response.json())
      .then((data) => setHexData(data as Hexagon[]));
  }, []);

  const rows = 300;
  const cols = 500;

  const hexagonGrids = useMemo(() => {
    const hexagonGrids = [];
    for (let i = 0; i < rows; i += 50) {
      const startRow = i;
      const endRow = startRow + 50;
      for (let j = 0; j < cols; j += 50) {
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
          const col = Number(event.keys[2]) - 2147483647;
          const row = Number(event.keys[3]) - 2147483647;
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
        {hexData && <Hyperstructures hexData={hexData} />}
        <EnemyArmies />
        <Armies />
        <TravelingArmies />
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
      <Flags></Flags>
    </>
  );
};

const matrix = new Matrix4();
const positions = new Vector3();

export const getPositionsAtIndex = (mesh: InstancedMesh<any, any>, index: number) => {
  if (!mesh || !mesh.isInstancedMesh) {
    console.error("The provided mesh is not an InstancedMesh.");
    return null;
  }

  mesh.getMatrixAt(index, matrix);
  positions.setFromMatrixPosition(matrix);

  return positions;
};

const findShortestPathBFS = (
  startPos: Position,
  endPos: Position,
  hexData: Hexagon[],
  exploredHexes: Map<number, Set<number>>,
  maxHex: number,
) => {
  const queue: { position: Position; distance: number }[] = [{ position: startPos, distance: 0 }];
  const visited = new Set<string>();
  const path = new Map<string, Position>();

  const posKey = (pos: Position) => `${pos.x},${pos.y}`;

  while (queue.length > 0) {
    const { position: current, distance } = queue.shift()!;
    if (current.x === endPos.x && current.y === endPos.y) {
      // Reconstruct the path upon reaching the end position
      let temp = current;
      const result = [];
      while (temp) {
        result.unshift(temp); // Add to the beginning of the result array
        //@ts-ignore:
        temp = path.get(posKey(temp)); // Move backwards through the path
      }
      return result;
    }

    if (distance > maxHex) {
      break; // Stop processing if the current distance exceeds maxHex
    }

    const currentKey = posKey(current);
    if (!visited.has(currentKey)) {
      visited.add(currentKey);
      const neighbors = getNeighbors(current, hexData); // Assuming getNeighbors is defined elsewhere
      for (const neighbor of neighbors) {
        const neighborKey = posKey(neighbor);
        const isExplored = exploredHexes.get(neighbor.x - 2147483647)?.has(neighbor.y - 2147483647);
        if (!visited.has(neighborKey) && !queue.some((e) => posKey(e.position) === neighborKey) && isExplored) {
          path.set(neighborKey, current); // Map each neighbor back to the current position
          queue.push({ position: neighbor, distance: distance + 1 });
        }
      }
    }
  }

  return []; // Return empty array if no path is found within maxHex distance
};

const findShortestPathDFS = (startPos: Position, endPos: Position, hexData: Hexagon[], maxHex: number) => {
  const stack = [startPos];
  const visited = new Set<Position>();
  const path = new Map<string, Position>();
  let count = 0;

  const posKey = (pos: Position) => `${pos.x},${pos.y}`; // Create a unique string key for each position

  while (stack.length > 0 && count <= maxHex) {
    const current = stack.pop() as Position; // Use pop to take from the stack
    if (current.x === endPos.x && current.y === endPos.y) {
      const result = [current];
      let next = path.get(posKey(current));
      while (next) {
        result.push(next);
        next = path.get(posKey(next));
      }
      return result.reverse();
    }

    if (!visited.has(current)) {
      visited.add(current);
      const neighbors = getNeighbors(current, hexData);
      count++;
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          path.set(posKey(neighbor), current);
          stack.push(neighbor); // Push neighbors onto the stack
        }
      }
    }
  }

  return [];
};

const isNeighbor = (pos1: Position, pos2: Position) => {
  const neighborOffsets = pos1.y % 2 === 0 ? neighborOffsetsEven : neighborOffsetsOdd;
  for (const { i, j } of neighborOffsets) {
    if (pos1.x + i === pos2.x && pos1.y + j === pos2.y) {
      return true;
    }
  }
  return false;
};

const getNeighbors = (pos: Position, hexData: Hexagon[]) => {
  const neighborOffsets = pos.y % 2 === 0 ? neighborOffsetsEven : neighborOffsetsOdd;

  return neighborOffsets
    .map((offset) => {
      const col = pos.x + offset.i;
      const row = pos.y + offset.j;
      const hex = hexData.find((h) => h.col === col && h.row === row);
      return hex ? { x: hex.col, y: hex.row } : null;
    })
    .filter(Boolean) as Position[];
};

const getGrayscaleColor = (color: Color) => {
  const luminance = 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
  return luminance;
};
