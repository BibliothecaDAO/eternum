import { Environment } from "@react-three/drei";
import { createHexagonGeometry } from "./components/three/HexagonBackground";
import { MutableRefObject, useEffect, useMemo, useRef } from "react";
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
import { getEntityIdFromKeys, getUIPositionFromColRow } from "../../utils/utils";
import { MyCastles, OtherCastles } from "./Castles";
import { Hyperstructures } from "./Hyperstructures";
import { biomes, neighborOffsetsEven, neighborOffsetsOdd } from "@bibliothecadao/eternum";
import { getComponentValue } from "@dojoengine/recs";

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

  const highlightedHexRef = useRef<{ hexId: number; color: Color | null }>({ hexId: -1, color: null });
  useHighlightHex(hexMeshRef, highlightedHexRef);

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

            if (highlightedHexRef.current.hexId === hexIndex) {
              highlightedHexRef.current.color = new Color(BIOMES[hexData[hexIndex].biome].color);
            }
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
    const hexMaterial = new MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      wireframe: false,
      roughness: 0.5, // Adjust this value between 0.0 and 1.0 to control the roughness
      metalness: 0.5, // Adjust this value between 0.0 and 1.0 to control the metalness/reflection
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

export const Map = () => {
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

  useEffect(() => {
    const scene = document.querySelector(".main-scene");
    // only add it
    // Add event listener for mouse move
    scene?.addEventListener("mousemove", onMouseMove);
    scene?.addEventListener("mousedown", onMouseDown);
    scene?.addEventListener("mouseup", onMouseUp);

    return () => {
      // Remove event listener when the component is unmounted
      scene?.removeEventListener("mousemove", onMouseMove);
      scene?.removeEventListener("mousedown", onMouseDown);
      scene?.removeEventListener("mouseup", onMouseUp);
    };
  }, []);
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
  return new Color(luminance, luminance, luminance);
};
