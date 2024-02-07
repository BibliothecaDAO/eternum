import { Environment } from "@react-three/drei";
import { createHexagonGeometry } from "./components/three/HexagonBackground";
import { MutableRefObject, useEffect, useMemo, useRef } from "react";
import {
  Color,
  ExtrudeGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Raycaster,
  Vector2,
} from "three";
import hexDataJson from "../../geodata/hex/hexData.json";
import { useThree } from "@react-three/fiber";
import { OutlineEffect } from "three-stdlib";
import useUIStore from "../../hooks/store/useUIStore";
import { remove } from "mobx";
import { useExplore } from "../../hooks/helpers/useExplore";
import { useDojo } from "../../DojoContext";
import { Subscription } from "rxjs";

interface Hexagon {
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
  hexRadius: number;
  selectedHex?: { col: number; row: number };
  index: number;
};

const HexagonGrid = ({ startRow, endRow, startCol, endCol, hexRadius, selectedHex, index }: HexagonGridProps) => {
  const {
    setup: {
      updates: {
        eventUpdates: { exploreMapEvents },
      },
    },
  } = useDojo();

  const hexMeshRef = useRef<InstancedMesh<ExtrudeGeometry, MeshBasicMaterial>>();

  const { exploredColsRows, useExplorationClickedHex } = useExplore();

  useEffect(() => {
    const colsRows = exploredColsRows(startCol, endCol, startRow, endRow);

    // change color back to original for explored hexes
    const colors = getColorFromMesh(hexMeshRef.current);
    if (!colors) return;
    colsRows.forEach((hex) => {
      const hexIndex = hexData.findIndex((h) => h.col === hex.col && h.row === hex.row);
      if (hexIndex !== -1) {
        const color = new Color(hexData[hexIndex].color);
        color.toArray(colors, hexIndex * 3);
      }
    });

    hexMeshRef.current.geometry.attributes.color.array = new Float32Array(colors);
    hexMeshRef.current.geometry.attributes.color.needsUpdate = true;
  }, []);

  // another use effect to change the color of the selected hex if it's been successfuly explored
  useEffect(() => {
    let subscription: Subscription | undefined;

    const subscribeToExploreEvents = async () => {
      const observable = await exploreMapEvents();
      const sub = observable.subscribe((event) => {
        if (event) {
          console.log({ exploreMapEvent: event });
          const col = event.data[0];
          const row = event.data[1];
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

  const depth = 10;
  const radiusPosition = hexRadius;
  const hexagonGeometry = useMemo(() => createHexagonGeometry(radiusPosition, depth), [radiusPosition, depth]);

  const hexHeight = hexRadius * 2;
  const hexWidth = Math.sqrt(3) * hexRadius;
  const vertDist = hexHeight * 0.75;
  const horizDist = hexWidth;

  const hexMaterial = new MeshBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
  });

  const group = hexData.filter((hex) => {
    const col = hex.col - 2147483647;
    const row = hex.row - 2147483647;
    return col >= startCol && col <= endCol && row >= startRow && row <= endRow;
  });

  const mesh = new InstancedMesh(hexagonGeometry, hexMaterial, group.length);

  let idx = 0;
  let colors: number[] = []; // Initialize the colors array

  group.forEach((hex) => {
    const col = hex.col - 2147483647;
    const row = hex.row - 2147483647;
    const x = col * horizDist + ((row % 2) * horizDist) / 2;
    const y = row * vertDist;

    const color = new Color(hex.color);

    // Calculate the luminance of the color
    const luminance = 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;

    const grayScaleColor = new Color(luminance, luminance, luminance);

    grayScaleColor.toArray(colors, idx * 3);

    let matrix = new Matrix4();
    matrix.setPosition(x, y, hex.depth * 10);
    mesh.setMatrixAt(idx, matrix);
    idx++;
  });

  const colorAttribute = new InstancedBufferAttribute(new Float32Array(colors), 3);
  mesh.geometry.setAttribute("color", colorAttribute);

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

  return (
    <mesh>
      <ambientLight color={"white"} intensity={1} />
      <pointLight rotation={[Math.PI / -2, 0, 0]} position={[10, 20, 10]} intensity={20} />
      <mesh rotation={[Math.PI / -2, 0, 0]} frustumCulled={true}>
        <HexagonGrid startRow={0} endRow={rows} startCol={0} endCol={cols} hexRadius={3} index={0} />
      </mesh>
      {/* <mesh>
        {hexagonGrids.map((grid, index) => {
          return (
            <mesh key={index} rotation={[Math.PI / -2, 0, 0]} frustumCulled={true}>
              <HexagonGrid {...grid} hexRadius={3} index={index} />
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

  // store hexId and color of highlighed hex
  const highlightedHexRef = useRef<{ hexId: number; color: Color | null }>({ hexId: -1, color: null });
  const raycaster = new Raycaster();
  const mouse = new Vector2();

  const onMouseMove = (event: any) => {
    const mesh = hexMeshRef?.current;
    let colors = getColorFromMesh(mesh);
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

  useEffect(() => {
    // only add it
    // Add event listener for mouse move
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("click", onMouseClick);

    return () => {
      // Remove event listener when the component is unmounted
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("click", onMouseClick);
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
