import { createHexagonGeometry, createHexagonShape } from "./components/three/HexagonBackground";
import { MutableRefObject, useEffect, useMemo, useRef, useState } from "react";
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
  MeshStandardMaterial,
  Vector2,
  Vector3,
} from "three";
import { useThree } from "@react-three/fiber";
import useUIStore from "../../hooks/store/useUIStore";
import { useDojo } from "../../DojoContext";
import { Subscription } from "rxjs";
import { getColRowFromUIPosition, getEntityIdFromKeys, getUIPositionFromColRow } from "../../utils/utils";
import { MyCastles, OtherCastles } from "./Castles";
import { Hyperstructures } from "./Hyperstructures";
import { biomes, neighborOffsetsEven, neighborOffsetsOdd } from "@bibliothecadao/eternum";
import { getComponentValue } from "@dojoengine/recs";
import { throttle } from "lodash";
import * as THREE from "three";

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
  hexMeshRef: MutableRefObject<InstancedMesh<ExtrudeGeometry, MeshBasicMaterial> | undefined>;
};

const color = new Color();

export const HexagonGrid = ({ startRow, endRow, startCol, endCol, hexMeshRef, explored }: HexagonGridProps) => {
  const hexData = useUIStore((state) => state.hexData);

  const { group, colors } = useMemo(() => {
    if (!hexData) return { group: [], colors: [] };
    const filteredGroup = hexData.filter((hex) => {
      const col = hex.col - 2147483647;
      const row = hex.row - 2147483647;
      return col >= startCol && col <= endCol && row >= startRow && row <= endRow;
    });

    let colorValues: number[] = [];
    let idx = 0;

    // filteredGroup.forEach((hex) => {
    //   // const color = new Color("#202124");
    //   color.setStyle(BIOMES[hex.biome].color);
    //   const grayScaleColor = color; //getGrayscaleColor(color);
    //   // color.toArray(colorValues, idx * 3);
    //   grayScaleColor.toArray(colorValues, idx * 3);
    //   idx++;
    // });

    return { group: filteredGroup, colors: colorValues };
  }, [startRow, endRow, startCol, endCol, HEX_RADIUS, hexData]);

  // Create the mesh only once when the component is mounted
  const mesh: InstancedMesh = useMemo(() => {
    const hexagonGeometry = createHexagonGeometry(HEX_RADIUS, DEPTH);
    const hexMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      vertexColors: false,
      wireframe: false,
    });

    const instancedMesh = new InstancedMesh(hexagonGeometry, hexMaterial, group.length);
    let idx = 0;
    let matrix = new Matrix4();
    group.forEach((hex) => {
      const { x, y } = getUIPositionFromColRow(hex.col, hex.row);
      // set the z position with math.random to have a random height
      matrix.setPosition(x, y, BIOMES[hex.biome].depth * 10);
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
    <>
      <primitive ref={hexMeshRef} object={mesh} />
    </>
  );
};

export const WorldMap = () => {
  const {
    setup: {
      account: { account },
      components: { Owner },
      updates: {
        eventUpdates: { exploreMapEvents },
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

  // @dev: in case we want to use multiple smaller mesh instances
  const hexagonGrids = useMemo(() => {
    const hexagonGrids = [];
    for (let i = 0; i < rows; i += 25) {
      const startRow = i;
      const endRow = startRow + 25;
      for (let j = 0; j < cols; j += 25) {
        const startCol = j;
        const endCol = startCol + 25;
        hexagonGrids.push({ startRow, endRow, startCol, endCol });
      }
    }
    return hexagonGrids;
  }, []);

  const hexMeshRef = useRef<InstancedMesh<ExtrudeGeometry, MeshBasicMaterial>>();

  const hexagonGeometry = new THREE.ShapeGeometry(createHexagonShape(HEX_RADIUS));
  const [highlightPosition, setHighlightPosition] = useState<[number, number, number]>([0, 0, 0]);

  const hoverHandler = (e: any) => {
    const intersect = e.intersections.find((intersect: any) => intersect.object instanceof THREE.InstancedMesh);
    if (intersect) {
      const instanceId = intersect.instanceId;
      const mesh = intersect.object;
      const pos = getPositionsAtIndex(mesh, instanceId);
      if (pos) {
        setHighlightPosition([pos.x, -pos.y, pos.z]);
        //mesh.setColorAt(instanceId, color.setHex(0xffffff));
        //mesh.instanceColor.needsUpdate = true;
      }
    }
  };

  const setClickedHex = useUIStore((state) => state.setClickedHex);

  const clickHandler = (e: any) => {
    const intersect = e.intersections.find((intersect: any) => intersect.object instanceof THREE.InstancedMesh);
    if (intersect) {
      const instanceId = intersect.instanceId;
      const mesh = intersect.object;
      const pos = getPositionsAtIndex(mesh, instanceId);
      if (pos) {
        const { col, row } = getColRowFromUIPosition(pos.x, pos.y);
        setClickedHex({ col, row, hexIndex: instanceId });
        //change color
      }
    }
  };

  const throttledHoverHandler = useMemo(() => throttle(hoverHandler, 50), []);
  const flatMode = localStorage.getItem("flatMode");
  const [exploredHexes, setExploredHexes] = useState<Map<number, Set<number>>>(new Map());

  // use effect to change the color of the selected hex if it's been successfuly explored
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
          // const hexIndex = hexData.findIndex((h) => h.col === col && h.row === row);
          // if (hexIndex !== -1 && hexMeshRef?.current) {
          //   // store which hex has been explored
          //   hexData[hexIndex].explored = true;
          //   const keys = [BigInt(Number(event.keys[1]))];
          //   const owner = getComponentValue(Owner, getEntityIdFromKeys(keys));
          //   if (owner) {
          //     hexData[hexIndex].exploredBy = owner.address;
          //   }
          //   const color = new Color(BIOMES[hexData[hexIndex].biome].color);
          // }
        }
      });
      subscription = sub;
    };
    subscribeToExploreEvents();

    return () => {
      subscription?.unsubscribe();
    };
  }, [hexData]);

  return (
    <group onPointerEnter={(e) => throttledHoverHandler(e)}>
      <mesh rotation={[Math.PI / -2, 0, 0]} frustumCulled={true}>
        {/* <HexagonGrid hexMeshRef={hexMeshRef} startRow={0} endRow={rows} startCol={0} endCol={cols} /> */}
        {hexagonGrids.map((grid, index) => {
          return (
            <group onClick={clickHandler}>
              <HexagonGrid {...grid} hexMeshRef={hexMeshRef} explored={exploredHexes} />
            </group>
          );
        })}
      </mesh>
      <mesh
        geometry={hexagonGeometry}
        rotation={[Math.PI / -2, 0, 0]}
        position={[highlightPosition[0], highlightPosition[2] + 10.3, highlightPosition[1]]}
      >
        <meshMatcapMaterial color={0xffffff} transparent opacity={0.75} />
      </mesh>
      {hexData && <MyCastles hexData={hexData} meshRef={hexMeshRef} />}
      {/* {hexData && <OtherCastles hexData={hexData} meshRef={hexMeshRef} />}
      {hexData && <Hyperstructures hexData={hexData} hexMeshRef={hexMeshRef} />} */}
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
      {/* <Environment preset="dawn" /> */}
    </group>
  );
};

const useHighlightHex = (
  hexMeshRef: MutableRefObject<InstancedMesh<ExtrudeGeometry, MeshBasicMaterial> | undefined>,
  highlightedHexRef: MutableRefObject<{ hexId: number; color: Color | null }>,
) => {
  const camera = useThree((state) => state.camera);
  const hexData = useUIStore((state) => state.hexData);

  const hexDataRef = useRef(hexData);
  useEffect(() => {
    hexDataRef.current = hexData;
  }, [hexData]);

  const setClickedHex = useUIStore((state) => state.setClickedHex);

  const { raycaster } = useThree();
  raycaster.firstHitOnly = true;

  // store hexId and color of highlighed hex
  const mouse = new Vector2();

  const onMouseMove = (event: any) => {
    if (!hexMeshRef?.current) return;
    const mesh = hexMeshRef?.current;
    let colors = getColorFromMesh(mesh);
    if (!colors) return;
    // Calculate mouse position in normalized device coordinates (-1 to +1) for both components
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Update the ray with the camera and mouse position
    raycaster.setFromCamera(mouse, camera); // assuming 'camera' is your Three.js camera

    // Calculate objects intersecting the picking ray. Assume hexMeshRef.current is the instanced mesh
    const intersects = raycaster.intersectObject(hexMeshRef.current, false);

    if (intersects.length > 0) {
      // Get the first intersected object
      const intersectedHex = intersects[0];
      const hexIndex = intersectedHex.instanceId;
      if (!hexIndex) return;
      updateHighlight(highlightedHexRef, hexIndex, colors, mesh);
    } else {
      // resetHighlight(highlightedHexRef, colors, mesh);
    }
  };

  const onMouseClick = (event: any) => {
    if (!hexMeshRef?.current || !hexDataRef.current) return;
    // Calculate mouse position in normalized device coordinates (-1 to +1) for both components
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Update the ray with the camera and mouse position
    raycaster.setFromCamera(mouse, camera); // assuming 'camera' is your Three.js camera

    // Calculate objects intersecting the picking ray. Assume hexMeshRef.current is the instanced mesh
    const intersects = raycaster.intersectObject(hexMeshRef.current, false);

    if (intersects.length > 0) {
      // Get the first intersected object
      const intersectedHex = intersects[0];

      const hexIndex = intersectedHex.instanceId;
      const hex = hexIndex ? hexDataRef.current[hexIndex] : undefined;

      console.log({ hex, hexIndex });
      if (hex && hexIndex) {
        setClickedHex({ col: hex.col, row: hex.row, hexIndex });
      }
    }
  };

  /**
   * Detects if the user clicked or dragged the mouse (depending on time mouse down)
   */
  let mouseDownTime = 0;
  const onMouseDown = () => {
    mouseDownTime = new Date().getTime();
  };
  const onMouseUp = (event: any) => {
    const mouseUpTime = new Date().getTime();
    const timeDiff = mouseUpTime - mouseDownTime;

    // Assume it's a click if the time difference is less than 200ms (adjust as needed)
    if (timeDiff < 200) {
      onMouseClick(event);
    }
  };

  // useEffect(() => {
  //   const scene = document.querySelector(".main-scene");
  //   // only add it
  //   // Add event listener for mouse move
  //   scene?.addEventListener("mousemove", onMouseMove);
  //   scene?.addEventListener("mousedown", onMouseDown);
  //   scene?.addEventListener("mouseup", onMouseUp);

  //   return () => {
  //     // Remove event listener when the component is unmounted
  //     scene?.removeEventListener("mousemove", onMouseMove);
  //     scene?.removeEventListener("mousedown", onMouseDown);
  //     scene?.removeEventListener("mouseup", onMouseUp);
  //   };
  // }, []);
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

const updateHighlight = (
  highlightedHexRef: MutableRefObject<{ hexId: number; color: Color | null }>,
  hexIndex: number,
  colors: number[],
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
  const lightRed = new Color(0xff6666);
  const blendFactor = 0.8;
  const blendedColor = prevColor.clone().lerp(lightRed, blendFactor);

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
  return luminance;
};
