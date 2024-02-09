import { Environment } from "@react-three/drei";
import { createHexagonGeometry } from "./components/three/HexagonBackground";
import { MutableRefObject, useEffect, useMemo, useRef, useState } from "react";
// @ts-ignore
import { Flags } from "../../components/worldmap/Flags.jsx";
import {
  Color,
  ExtrudeGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Vector2,
  Vector3,
} from "three";
import hexDataJson from "../../geodata/hex/hexData.json";
import { useThree } from "@react-three/fiber";
import useUIStore from "../../hooks/store/useUIStore";
import { useExplore } from "../../hooks/helpers/useExplore";
import { useDojo } from "../../DojoContext";
import { Subscription } from "rxjs";
import { getUIPositionFromColRow } from "../../utils/utils";
import { Castles } from "./Castles";
import { Hyperstructures } from "./Hyperstructures";

export const DEPTH = 10;
export const HEX_RADIUS = 3;

export interface Hexagon {
  idx: number;
  col: number;
  row: number;
  x: number;
  y: number;
  color: string;
  depth: number;
  biome: string;
}

const hexData: Hexagon[] = hexDataJson as Hexagon[];

type HexagonGridProps = {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
  hexMeshRef: MutableRefObject<InstancedMesh<ExtrudeGeometry, MeshBasicMaterial> | undefined>;
};

const HexagonGrid = ({ startRow, endRow, startCol, endCol, hexMeshRef }: HexagonGridProps) => {
  const {
    setup: {
      updates: {
        eventUpdates: { exploreMapEvents },
      },
    },
  } = useDojo();

  // const hexMeshRef = useRef<InstancedMesh<ExtrudeGeometry, MeshBasicMaterial>>();

  const clickedHex = useUIStore((state) => state.clickedHex);

  const { exploredColsRows, useExplorationClickedHex } = useExplore();

  // useEffect(() => {
  //   const colsRows = exploredColsRows(startCol, endCol, startRow, endRow);

  //   // change color back to original for explored hexes
  //   const colors = getColorFromMesh(hexMeshRef.current);
  //   if (!colors) return;
  //   colsRows.forEach((hex) => {
  //     const hexIndex = hexData.findIndex((h) => h.col === hex.col && h.row === hex.row);
  //     if (hexIndex !== -1) {
  //       const color = new Color(hexData[hexIndex].color);
  //       color.toArray(colors, hexIndex * 3);
  //     }
  //   });

  //   hexMeshRef.current.geometry.attributes.color.array = new Float32Array(colors);
  //   hexMeshRef.current.geometry.attributes.color.needsUpdate = true;
  // }, []);

  // another use effect to change the color of the selected hex if it's been successfuly explored
  useEffect(() => {
    let subscription: Subscription | undefined;

    const subscribeToExploreEvents = async () => {
      const observable = await exploreMapEvents();
      const sub = observable.subscribe((event) => {
        if (event) {
          const col = Number(event.keys[2]);
          const row = Number(event.keys[3]);
          const hexIndex = hexData.findIndex((h) => h.col === col && h.row === row);
          if (hexIndex !== -1) {
            const color = new Color(hexData[hexIndex].color);
            const colors = getColorFromMesh(hexMeshRef.current);
            if (!colors) return;
            color.toArray(colors, hexIndex * 3);
            hexMeshRef.current.geometry.attributes.color.array = new Float32Array(colors);
            hexMeshRef.current.geometry.attributes.color.needsUpdate = true;
          }
        }
      });
      subscription = sub;
    };
    subscribeToExploreEvents();

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  useHighlightHex(hexMeshRef);

  // Calculate group and colors only once when the component is mounted
  const { group, colors } = useMemo(() => {
    const filteredGroup = hexData.filter((hex) => {
      const col = hex.col - 2147483647;
      const row = hex.row - 2147483647;
      return col >= startCol && col <= endCol && row >= startRow && row <= endRow;
    });

    let colorValues: number[] = [];
    let idx = 0;

    filteredGroup.forEach((hex) => {
      const color = new Color(hex.color);
      const luminance = 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
      const grayScaleColor = new Color(luminance, luminance, luminance);
      grayScaleColor.toArray(colorValues, idx * 3);
      idx++;
    });

    return { group: filteredGroup, colors: colorValues };
  }, [startRow, endRow, startCol, endCol, HEX_RADIUS]);

  // Create the mesh only once when the component is mounted
  const mesh = useMemo(() => {
    const hexagonGeometry = createHexagonGeometry(HEX_RADIUS, DEPTH);
    const hexMaterial = new MeshBasicMaterial({
      color: 0xffffff,
      vertexColors: true,
    });

    const instancedMesh = new InstancedMesh(hexagonGeometry, hexMaterial, group.length);
    let idx = 0;

    group.forEach((hex) => {
      const { x, y } = getUIPositionFromColRow(hex.col, hex.row);

      let matrix = new Matrix4();
      matrix.setPosition(x, y, hex.depth * 10);
      instancedMesh.setMatrixAt(idx, matrix);
      idx++;
    });

    const colorAttribute = new InstancedBufferAttribute(new Float32Array(colors), 3);
    instancedMesh.geometry.setAttribute("color", colorAttribute);

    return instancedMesh;
  }, [group, colors, HEX_RADIUS, DEPTH]);

  return (
    <>
      <primitive ref={hexMeshRef} object={mesh} />
    </>
  );
};

export const Map = () => {
  const rows = 300;
  const cols = 500;

  const hexagonGrids = useMemo(() => {
    const hexagonGrids = [];
    for (let i = 0; i < rows; i += 100) {
      const startRow = i;
      const endRow = startRow + 100;
      for (let j = 0; j < cols; j += 100) {
        const startCol = j;
        const endCol = startCol + 100;
        hexagonGrids.push({ startRow, endRow, startCol, endCol });
      }
    }
    return hexagonGrids;
  }, []);

  const hexMeshRef = useRef<InstancedMesh<ExtrudeGeometry, MeshBasicMaterial>>();

  return (
    <mesh>
      <ambientLight color={"white"} intensity={1} />
      <pointLight rotation={[Math.PI / -2, 0, 0]} position={[10, 20, 10]} intensity={20} />
      <mesh rotation={[Math.PI / -2, 0, 0]} frustumCulled={true}>
        <HexagonGrid hexMeshRef={hexMeshRef} startRow={0} endRow={rows} startCol={0} endCol={cols} />
      </mesh>
      <Castles meshRef={hexMeshRef} />
      <Hyperstructures hexMeshRef={hexMeshRef} />
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
) => {
  const camera = useThree((state) => state.camera);
  const setClickedHex = useUIStore((state) => state.setClickedHex);

  const { raycaster } = useThree();
  raycaster.firstHitOnly = true;

  // store hexId and color of highlighed hex
  const highlightedHexRef = useRef<{ hexId: number; color: Color | null }>({ hexId: -1, color: null });
  const mouse = new Vector2();

  const onMouseMove = (event: any) => {
    const mesh = hexMeshRef?.current;
    if (!mesh) return;
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
      resetHighlight(highlightedHexRef, colors, mesh);
    }
  };

  const onMouseClick = (event: any) => {
    const mesh = hexMeshRef?.current;
    if (!mesh) return;
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
      const hex = hexIndex ? hexData[hexIndex] : undefined;

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

  const colors = colorAttribute.array; // This is a Float32Array

  return colors;
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

  // if (!positionAttribute) {
  //   console.error("No position attribute found in the mesh.");
  //   return null;
  // }

  // const positions = positionAttribute.array; // This is a Float32Array

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

  // Update the color attribute of the mesh
  mesh.geometry.attributes.color.array = new Float32Array(colors);
  mesh.geometry.attributes.color.needsUpdate = true;
};

const resetHighlight = (
  highlightedHexRef: MutableRefObject<{ hexId: number; color: Color | null }>,
  colors: number[],
  mesh: InstancedMesh<ExtrudeGeometry, MeshBasicMaterial>,
) => {
  if (highlightedHexRef.current.hexId !== -1) {
    // Reset to original color
    const color = highlightedHexRef.current.color;
    if (color) {
      color.toArray(colors, highlightedHexRef.current.hexId * 3);

      // Update the color attribute of the mesh
      mesh.geometry.attributes.color.array = new Float32Array(colors);
      mesh.geometry.attributes.color.needsUpdate = true;
    }
    highlightedHexRef.current.hexId = -1;
  }
};
