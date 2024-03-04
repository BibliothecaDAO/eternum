import { Environment } from "@react-three/drei";
import { createHexagonGeometry } from "./components/three/HexagonBackground";
import { MutableRefObject, useCallback, useEffect, useMemo, useRef } from "react";
// @ts-ignore
import { Flags } from "../../components/worldmap/Flags.jsx";
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
import useUIStore from "../../hooks/store/useUIStore";
import { useDojo } from "../../DojoContext";
import { Subscription } from "rxjs";
import { getEntityIdFromKeys, getUIPositionFromColRow } from "../../utils/utils";
import { MyCastles, OtherCastles } from "./Castles";
import { Hyperstructures } from "./Hyperstructures";
import { Position, biomes, neighborOffsetsEven, neighborOffsetsOdd } from "@bibliothecadao/eternum";
import { getComponentValue } from "@dojoengine/recs";
import { Armies, TravelingArmies } from "./armies/Armies";

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
  hexMeshRef: MutableRefObject<InstancedMesh<ExtrudeGeometry, MeshBasicMaterial> | undefined>;
};

export const HexagonGrid = ({ startRow, endRow, startCol, endCol, hexMeshRef }: HexagonGridProps) => {
  const hexData = useUIStore((state) => state.hexData);

  const {
    setup: {
      account: { account },
      components: { Owner },
      updates: {
        eventUpdates: { exploreMapEvents },
      },
    },
  } = useDojo();

  const highlightedHexesRef = useRef<{ hexId: number; color: Color | null }[]>([]);
  // const highlightedHexesRef = useRef<{ hexId: number; color: Color | null }>({ hexId: -1, color: null });
  useHighlightHex(hexMeshRef, highlightedHexesRef);

  // use effect to change the color of the selected hex if it's been successfuly explored
  useEffect(() => {
    let subscription: Subscription | undefined;

    const subscribeToExploreEvents = async () => {
      const observable = await exploreMapEvents();
      const sub = observable.subscribe((event) => {
        if (event && hexData) {
          const col = Number(event.keys[2]);
          const row = Number(event.keys[3]);
          const hexIndex = hexData.findIndex((h) => h.col === col && h.row === row);
          if (hexIndex !== -1 && hexMeshRef?.current) {
            // store which hex has been explored
            hexData[hexIndex].explored = true;
            const keys = [BigInt(Number(event.keys[1]))];
            const owner = getComponentValue(Owner, getEntityIdFromKeys(keys));
            if (owner) {
              hexData[hexIndex].exploredBy = owner.address;
            }

            const color = new Color(BIOMES[hexData[hexIndex].biome].color);
            const colors = getColorFromMesh(hexMeshRef.current);
            if (!colors) return;
            color.toArray(colors, hexIndex * 3);

            // Assert that colorAttribute is of type BufferAttribute
            if (!(hexMeshRef.current.geometry.attributes.color instanceof BufferAttribute)) {
              console.error("colorAttribute is not an instance of THREE.BufferAttribute.");
              return null;
            }

            if (owner && account && owner.address === BigInt(account.address)) {
              // also change to gray scale all hex that are neighbors
              // if they are not already explored
              const neighborOffsets = row % 2 === 0 ? neighborOffsetsEven : neighborOffsetsOdd;

              for (const { i, j } of neighborOffsets) {
                const neighborIndex = hexData.findIndex((h) => h.col === col + i && h.row === row + j);
                if (hexData[neighborIndex] && !hexData[neighborIndex].explored) {
                  const color = new Color(BIOMES[hexData[neighborIndex].biome].color);
                  const grayscaleColor = getGrayscaleColor(color);
                  grayscaleColor.toArray(colors, neighborIndex * 3);
                }
              }
            }

            hexMeshRef.current.geometry.attributes.color.array = new Float32Array(colors);
            hexMeshRef.current.geometry.attributes.color.needsUpdate = true;

            // add the depth to the position
            const matrix = new Matrix4();
            hexMeshRef.current.getMatrixAt(hexIndex, matrix);
            matrix.setPosition(matrix.elements[12], matrix.elements[13], BIOMES[hexData[hexIndex].biome].depth * DEPTH);
            hexMeshRef.current.setMatrixAt(hexIndex, matrix);
            // needs update
            hexMeshRef.current.instanceMatrix.needsUpdate = true;

            // todo; check later
            // if (highlightedHexRef.current.length === hexIndex) {
            //   highlightedHexRef.current.color = new Color(BIOMES[hexData[hexIndex].biome].color);
            // }
            // if (highlightedHexesRef.current.hexId === hexIndex) {
            //   highlightedHexesRef.current.color = new Color(BIOMES[hexData[hexIndex].biome].color);
            // }
          }
        }
      });
      subscription = sub;
    };
    subscribeToExploreEvents();

    return () => {
      subscription?.unsubscribe();
    };
  }, [hexData]);

  // Calculate group and colors only once when the component is mounted
  const { group, colors } = useMemo(() => {
    if (!hexData) return { group: [], colors: [] };
    const filteredGroup = hexData.filter((hex) => {
      const col = hex.col - 2147483647;
      const row = hex.row - 2147483647;
      return col >= startCol && col <= endCol && row >= startRow && row <= endRow;
    });

    let colorValues: number[] = [];
    let idx = 0;

    filteredGroup.forEach((hex) => {
      // const color = new Color("#202124");
      const color = new Color(BIOMES[hex.biome].color);
      const grayScaleColor = getGrayscaleColor(color);
      // color.toArray(colorValues, idx * 3);
      grayScaleColor.toArray(colorValues, idx * 3);
      idx++;
    });

    return { group: filteredGroup, colors: colorValues };
  }, [startRow, endRow, startCol, endCol, HEX_RADIUS, hexData]);

  // Create the mesh only once when the component is mounted
  const mesh = useMemo(() => {
    const hexagonGeometry = createHexagonGeometry(HEX_RADIUS, DEPTH);
    // const hexMaterial = new MeshStandardMaterial({
    //   color: 0xffffff,
    //   vertexColors: true,
    //   wireframe: false,
    //   roughness: 0.5, // Adjust this value between 0.0 and 1.0 to control the roughness
    //   metalness: 0.5, // Adjust this value between 0.0 and 1.0 to control the metalness/reflection
    // });
    const hexMaterial = new MeshBasicMaterial({
      color: 0xffffff,
      vertexColors: true,
      wireframe: false,
    });

    const instancedMesh = new InstancedMesh(hexagonGeometry, hexMaterial, group.length);

    let idx = 0;
    group.forEach((hex) => {
      const { x, y } = getUIPositionFromColRow(hex.col, hex.row);

      let matrix = new Matrix4();
      // set the z position with math.random to have a random height
      matrix.setPosition(x, y, Math.random() * 0.3);
      // matrix.setPosition(x, y, BIOMES[hex.biome].depth * 10);
      instancedMesh.setMatrixAt(idx, matrix);
      idx++;
    });

    const colorAttribute = new InstancedBufferAttribute(new Float32Array(colors), 3);
    instancedMesh.geometry.setAttribute("color", colorAttribute);

    return instancedMesh;
  }, [group, colors]);

  return (
    <>
      <primitive ref={hexMeshRef} object={mesh} />
    </>
  );
};

export const HexMap = () => {
  const hexData = useUIStore((state) => state.hexData);
  const setHexData = useUIStore((state) => state.setHexData);

  useEffect(() => {
    fetch("/jsons/hexData.json")
      .then((response) => response.json())
      .then((data) => setHexData(data as Hexagon[]));
  }, []);

  const rows = 300;
  const cols = 500;

  // @dev: in case we want to use multiple smaller mesh instances
  // const hexagonGrids = useMemo(() => {
  //   const hexagonGrids = [];
  //   for (let i = 0; i < rows; i += 100) {
  //     const startRow = i;
  //     const endRow = startRow + 100;
  //     for (let j = 0; j < cols; j += 100) {
  //       const startCol = j;
  //       const endCol = startCol + 100;
  //       hexagonGrids.push({ startRow, endRow, startCol, endCol });
  //     }
  //   }
  //   return hexagonGrids;
  // }, []);

  const hexMeshRef = useRef<InstancedMesh<ExtrudeGeometry, MeshBasicMaterial>>();

  return (
    <mesh>
      <mesh rotation={[Math.PI / -2, 0, 0]} position={[0, 0, 0]} frustumCulled={true}>
        <HexagonGrid hexMeshRef={hexMeshRef} startRow={0} endRow={rows} startCol={0} endCol={cols} />
      </mesh>
      {hexData && <MyCastles hexData={hexData} meshRef={hexMeshRef} />}
      {hexData && <OtherCastles hexData={hexData} meshRef={hexMeshRef} />}
      {hexData && <Hyperstructures hexData={hexData} hexMeshRef={hexMeshRef} />}
      {hexData && <Armies hexData={hexData} />}
      {hexData && <TravelingArmies hexData={hexData} />}
      {/* <Flags></Flags> */}
      {/* <mesh>
        {hexagonGrids.map((grid, index) => {
          return (
            <mesh key={index} rotation={[Math.PI / -2, 0, 0]} frustumCulled={true}>
              <HexagonGrid {...grid} index={index} />
            </mesh>
          );
        })}
      </mesh> */}
      <Environment preset="dawn" />
    </mesh>
  );
};

const useHighlightHex = (
  hexMeshRef: MutableRefObject<InstancedMesh<ExtrudeGeometry, MeshBasicMaterial> | undefined>,
  highlightedHexesRef: MutableRefObject<{ hexId: number; color: Color | null }[]>,
) => {
  const { camera, raycaster } = useThree((state) => ({ camera: state.camera, raycaster: state.raycaster }));
  const hexData = useUIStore((state) => state.hexData);
  const setSelectedPath = useUIStore((state) => state.setSelectedPath);
  const selectedPath = useUIStore((state) => state.selectedPath);
  const setClickedHex = useUIStore((state) => state.setClickedHex);
  const setSelectedDestination = useUIStore((state) => state.setSelectedDestination);
  const selectedEntity = useUIStore((state) => state.selectedEntity);
  const isTravelMode = useUIStore((state) => state.isTravelMode);
  const isExploreMode = useUIStore((state) => state.isExploreMode);
  const isAttackMode = useUIStore((state) => state.isAttackMode);

  const hexDataRef = useRef(hexData);
  const currentHoveredHex = useRef<number | undefined>(undefined);
  const selectedEntityRef = useRef(selectedEntity);
  const selectedPathRef = useRef(selectedPath);
  const isTravelModeRef = useRef(false);
  const isExploreModeRef = useRef(false);
  const isAttackModeRef = useRef(false);
  const selectedEntityHexIndex = useRef<number | undefined>(undefined);
  const mouse = new Vector2();

  useEffect(() => {
    hexDataRef.current = hexData;
    selectedEntityRef.current = selectedEntity;
    selectedPathRef.current = selectedPath;
    isTravelModeRef.current = isTravelMode;
    isExploreModeRef.current = isExploreMode;
    isAttackModeRef.current = isAttackMode;
  }, [hexData, selectedEntity, selectedPath, isTravelMode, isExploreMode, isAttackMode]);

  useEffect(() => {
    const hexIndex = hexData?.findIndex(
      (h) => h.col === selectedEntity?.position.x && h.row === selectedEntity?.position.y,
    );
    hexIndex !== -1 ? (selectedEntityHexIndex.current = hexIndex) : (selectedEntityHexIndex.current = undefined);
  }, [selectedEntity]);

  const updateHighlighting = useCallback(
    (event: any) => {
      if (!hexMeshRef.current) return;
      const mesh = hexMeshRef.current;
      let colors = getColorFromMesh(mesh);
      if (!colors) return;

      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(mesh, false);

      if (intersects.length > 0) {
        const { instanceId: hexIndex } = intersects[0];
        if (hexIndex !== currentHoveredHex.current) {
          currentHoveredHex.current = hexIndex;
          handleHexInteraction(hexIndex, colors, mesh);
        }
      }
    },
    [camera, hexMeshRef, raycaster],
  );

  const handleHexInteraction = (
    hexIndex: number | undefined,
    colors: number[],
    mesh: InstancedMesh<ExtrudeGeometry, MeshBasicMaterial>,
  ) => {
    if (!hexDataRef.current || !hexIndex) return;
    const hex = hexDataRef.current[hexIndex];
    const hoverColor = new Color(0xff6666);
    const clickColor = new Color(0x3cb93c);

    if (isTravelModeRef.current) {
      if (!selectedPathRef.current) {
        let start = selectedEntityRef!.current!.position;
        let end = { x: hex.col, y: hex.row };
        let path = findShortestPathBFS(start, end, hexDataRef.current, 3);
        updateHighlightHexes(
          highlightedHexesRef,
          path.map(({ x, y }) => hexDataRef!.current!.findIndex((h) => h.col === x && h.row === y)),
          colors,
          clickColor,
          mesh,
        );
      }
      // if exploring
    } else if (isExploreModeRef.current) {
      // needs to be neighbor and not explored
      if (
        selectedEntityHexIndex.current &&
        !selectedPathRef.current &&
        isNeighbor(
          { x: hex.col, y: hex.row },
          {
            x: hexDataRef.current[selectedEntityHexIndex.current].col,
            y: hexDataRef.current[selectedEntityHexIndex.current].row,
          },
        ) &&
        !hex.explored
      ) {
        let path = !hex.explored ? [selectedEntityHexIndex.current, hexIndex] : [selectedEntityHexIndex.current];
        updateHighlightHexes(highlightedHexesRef, path, colors, hoverColor, mesh);
      }
    } else if (selectedEntityHexIndex.current) {
      updateHighlightHexes(highlightedHexesRef, [selectedEntityHexIndex.current], colors, hoverColor, mesh);
    } else {
      updateHighlightHexes(highlightedHexesRef, [hexIndex], colors, hoverColor, mesh);
    }
  };

  const handleMouseClick = useCallback(
    (event: any) => {
      if (!hexMeshRef.current || !hexDataRef.current) return;
      updateHighlighting(event);
      const hexIndex = currentHoveredHex.current;
      if (hexIndex === undefined) return;
      const hex = hexDataRef.current[hexIndex];
      if (hex) {
        if (selectedEntityRef.current) {
          let start = selectedEntityRef.current.position;
          let end = { x: hex.col, y: hex.row };
          let path = findShortestPathBFS(start, end, hexDataRef.current, 3);
          setSelectedPath({ id: selectedEntityRef.current.id, path });
          setSelectedDestination({ col: hex.col, row: hex.row, hexIndex });
        } else if (isExploreModeRef.current) {
          if (
            selectedEntityHexIndex.current &&
            !selectedPathRef.current &&
            isNeighbor(
              { x: hex.col, y: hex.row },
              {
                x: hexDataRef.current[selectedEntityHexIndex.current].col,
                y: hexDataRef.current[selectedEntityHexIndex.current].row,
              },
            ) &&
            !hex.explored
          ) {
            setClickedHex({ col: hex.col, row: hex.row, hexIndex });
          }
        } else {
          setClickedHex({ col: hex.col, row: hex.row, hexIndex });
        }
      }
    },
    [hexMeshRef, setSelectedPath, setClickedHex, setSelectedDestination],
  );

  useEffect(() => {
    const scene = document.querySelector(".main-scene");
    scene?.addEventListener("mousemove", updateHighlighting);
    scene?.addEventListener("click", handleMouseClick);

    return () => {
      scene?.removeEventListener("mousemove", updateHighlighting);
      scene?.removeEventListener("click", handleMouseClick);
    };
  }, [updateHighlighting, handleMouseClick]);
};

const getColorFromMesh = (mesh: InstancedMesh<ExtrudeGeometry, MeshBasicMaterial>): number[] | null => {
  if (!mesh || !mesh.isInstancedMesh) {
    console.error("The provided mesh is not an InstancedMesh.");
    return null;
  }

  const colorAttribute = mesh.geometry.getAttribute("color");
  if (!colorAttribute) {
    console.error("No color attribute found in the mesh.");
    return null;
  }

  // Assert that colorAttribute is of type BufferAttribute
  if (!(colorAttribute instanceof BufferAttribute)) {
    console.error("colorAttribute is not an instance of THREE.BufferAttribute.");
    return null;
  }

  const colors = colorAttribute.array; // This is a Float32Array

  return Array.from(colors);
};

export const getPositionsAtIndex = (mesh: InstancedMesh<ExtrudeGeometry, MeshBasicMaterial>, index: number) => {
  if (!mesh || !mesh.isInstancedMesh) {
    console.error("The provided mesh is not an InstancedMesh.");
    return null;
  }

  const matrix = new Matrix4();
  mesh.getMatrixAt(index, matrix);
  const positions = new Vector3();
  positions.setFromMatrixPosition(matrix);

  return positions;
};

const updateHighlightHexes = (
  highlightedHexesRef: MutableRefObject<{ hexId: number; color: Color | null }[]>,
  hexIndices: number[],
  colors: number[],
  highlightColor: Color,
  mesh: InstancedMesh<ExtrudeGeometry, MeshBasicMaterial>,
) => {
  // Assuming highlightColor is already a THREE.Color
  const blendFactor = 0.8;
  const increaseFactor = 1.2; // Factor to increase brightness

  // Reset previous highlight
  if (highlightedHexesRef.current.length !== 0) {
    highlightedHexesRef.current.forEach(({ color, hexId }) => {
      if (color) {
        color.toArray(colors, hexId * 3);
      }
    });
  }

  let newValue = [];
  const tempColor = new Color(); // Reuse this color object

  for (let i = 0; i < hexIndices.length; i++) {
    const hexIndex = hexIndices[i];
    const colorIndex = hexIndex * 3;
    tempColor.fromArray(colors, colorIndex);

    newValue.push({ hexId: hexIndex, color: tempColor.clone() });

    // Blending and adjusting brightness could be optimized further by manipulating
    // the color's r, g, b properties directly, if applicable to your use case.

    // Apply new color directly to avoid additional toArray() call
    tempColor.lerp(highlightColor, blendFactor);
    const hsl = tempColor.getHSL({ h: 0, s: 0, l: 0 });
    hsl.l = Math.min(1, hsl.l * increaseFactor);
    tempColor.setHSL(hsl.h, hsl.s, hsl.l).toArray(colors, colorIndex);
  }

  highlightedHexesRef.current = newValue;

  // Assert that colorAttribute is of type BufferAttribute
  if (!(mesh.geometry.attributes.color instanceof BufferAttribute)) {
    console.error("colorAttribute is not an instance of THREE.BufferAttribute.");
    return null;
  }

  // Update the color attribute of the mesh
  mesh.geometry.attributes.color.array = new Float32Array(colors);
  mesh.geometry.attributes.color.needsUpdate = true;
};

const updateHighlight = (
  highlightedHexRef: MutableRefObject<{ hexId: number; color: Color | null }>,
  hexIndex: number,
  colors: number[],
  highlightColor: Color,
  mesh: InstancedMesh<ExtrudeGeometry, MeshBasicMaterial>,
) => {
  // Reset previous highlight
  if (highlightedHexRef.current.hexId !== -1) {
    const color = highlightedHexRef.current.color;
    if (color) {
      color.toArray(colors, highlightedHexRef.current.hexId * 3);
    }
  }

  // Store new highlight
  highlightedHexRef.current.hexId = hexIndex;
  const prevColor = new Color().fromArray(colors, hexIndex * 3);
  highlightedHexRef.current.color = prevColor;

  // Blend with light red for highlight effect
  const blendFactor = 0.8;
  const blendedColor = prevColor.clone().lerp(highlightColor, blendFactor);

  // Increase brightness
  const hsl = blendedColor.getHSL({ h: 0, s: 0, l: 0 });
  hsl.l = Math.min(1, hsl.l * 1.2);
  blendedColor.setHSL(hsl.h, hsl.s, hsl.l);

  // Apply new color
  blendedColor.toArray(colors, hexIndex * 3);

  // Assert that colorAttribute is of type BufferAttribute
  if (!(mesh.geometry.attributes.color instanceof BufferAttribute)) {
    console.error("colorAttribute is not an instance of THREE.BufferAttribute.");
    return null;
  }

  // Update the color attribute of the mesh
  mesh.geometry.attributes.color.array = new Float32Array(colors);
  mesh.geometry.attributes.color.needsUpdate = true;
};

const findShortestPathBFS = (startPos: Position, endPos: Position, hexData: Hexagon[], maxHex: number) => {
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
        if (!visited.has(neighborKey) && !queue.some((e) => posKey(e.position) === neighborKey)) {
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

// const resetHighlight = (
//   highlightedHexRef: MutableRefObject<{ hexId: number; color: Color | null }>,
//   colors: number[],
//   mesh: InstancedMesh<ExtrudeGeometry, MeshBasicMaterial>,
// ) => {
//   if (highlightedHexRef.current.hexId !== -1) {
//     // Reset to original color
//     const color = highlightedHexRef.current.color;
//     if (color) {
//       color.toArray(colors, highlightedHexRef.current.hexId * 3);

//       // Update the color attribute of the mesh
//       mesh.geometry.attributes.color.array = new Float32Array(colors);
//       mesh.geometry.attributes.color.needsUpdate = true;
//     }
//     highlightedHexRef.current.hexId = -1;
//   }
// };

const getGrayscaleColor = (color: Color) => {
  const luminance = 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
  return new Color(luminance, luminance, luminance);
};
