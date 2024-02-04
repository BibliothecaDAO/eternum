import { Environment } from "@react-three/drei";
import { createHexagonGeometry } from "./components/three/HexagonBackground";
import useUIStore from "../../hooks/store/useUIStore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Color, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, Raycaster, Vector2 } from "three";
import hexDataJson from "../../geodata/hex/hexData.json";
import { useThree } from "@react-three/fiber";

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

const HexagonGrid = ({ rows, cols, hexRadius }: any) => {
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);
  const [mapHasLoaded, setMapHasLoaded] = useState(false);
  const highlightMode = false;

  useEffect(() => {
    setTimeout(() => {
      setIsLoadingScreenEnabled(false);
      setMapHasLoaded(true);
    }, 300);
  }, []);

  // very slow
  // useEffect(() => {
  //   setupHexGrid();
  // }, []);

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
  const hexMesh = new InstancedMesh(hexagonGeometry, hexMaterial, rows * cols);

  let matrix = new Matrix4();
  let idx = 0;

  let colors: number[] = [];

  const setupHexGrid = () => {
    // Loop through each hexagon
    console.log("etup");
    hexData.forEach((hex) => {
      const col = hex.col - 2147483647;
      const row = hex.row - 2147483647;
      const x = col * horizDist + ((hex.row % 2) * horizDist) / 2;
      const y = row * vertDist;

      // Directly use the color and depth from hexData
      const color = new Color(hex.color); // Convert the color to THREE.Color
      color.toArray(colors, idx * 3); // Add color data to the colors array

      matrix.setPosition(x, y, hex.depth * 10);
      hexMesh.setMatrixAt(idx, matrix);

      idx++;
    });

    // Create an InstancedBufferAttribute for colors
    const colorAttribute = new InstancedBufferAttribute(new Float32Array(colors), 3);
    hexMesh.geometry.setAttribute("color", colorAttribute);
  };

  setupHexGrid();

  const { onMouseMove, hexMeshRef } = useHighlightHex(colors);

  useEffect(() => {
    if (!mapHasLoaded || !highlightMode) return;
    // only add it
    // Add event listener for mouse move
    document.addEventListener("mousemove", onMouseMove);

    return () => {
      // Remove event listener when the component is unmounted
      document.removeEventListener("mousemove", onMouseMove);
    };
  }, [mapHasLoaded]);

  return <primitive ref={hexMeshRef} object={hexMesh}></primitive>;
  // return <primitive object={hexMesh}></primitive>;
};

export const Map = () => {
  console.log("rerender");
  return (
    <mesh>
      <ambientLight color={"white"} intensity={1} />
      <pointLight rotation={[Math.PI / -2, 0, 0]} position={[10, 20, 10]} intensity={20} />
      <mesh rotation={[Math.PI / -2, 0, 0]}>
        <HexagonGrid rows={300} cols={500} hexRadius={3} />
      </mesh>
      <Environment preset="dawn" />
    </mesh>
  );
};

const useHighlightHex = (colors: number[]) => {
  const camera = useThree((state) => state.camera);

  const hexMeshRef = useRef();
  // store hexId and color of highlighed hex
  const highlightedHex = useRef<{ hexId: number; color: Color | null }>({ hexId: -1, color: null });
  const raycaster = new Raycaster();
  const mouse = new Vector2();

  const onMouseMove = useCallback(
    (event: any) => {
      // Calculate mouse position in normalized device coordinates (-1 to +1) for both components
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      // Update the ray with the camera and mouse position
      raycaster.setFromCamera(mouse, camera); // assuming 'camera' is your Three.js camera

      // Calculate objects intersecting the picking ray. Assume hexMeshRef.current is the instanced mesh
      const intersects = raycaster.intersectObject(hexMeshRef.current);

      if (intersects.length > 0) {
        // Get the first intersected object
        const intersectedHex = intersects[0];
        const hexIndex = intersectedHex.instanceId;

        // set back previous highlighted hex color to original
        if (highlightedHex.current.hexId !== -1) {
          const color = highlightedHex.current.color;
          if (color) {
            color.toArray(colors, highlightedHex.current.hexId * 3);
          }
        }

        // store new highlight
        highlightedHex.current.hexId = hexIndex;
        const r = colors[hexIndex * 3];
        const g = colors[hexIndex * 3 + 1];
        const b = colors[hexIndex * 3 + 2];
        const prevColor = new Color().setRGB(r, g, b);
        highlightedHex.current.color = prevColor;

        // Change current highlight to red
        // Step 2: Blend with light red
        const lightRed = new Color(0xff6666); // Adjust the shade of red as needed
        const blendFactor = 0.8; // Adjust this value for more or less red
        const blendedColor = prevColor.clone().lerp(lightRed, blendFactor);

        // Step 3: Increase brightness
        const hsl = { h: 0, s: 0, l: 0 };
        blendedColor.getHSL(hsl);
        hsl.l = Math.min(1, hsl.l * 1.2); // Increase lightness, ensure it's no more than 1
        blendedColor.setHSL(hsl.h, hsl.s, hsl.l);

        // Step 4: Apply the new color
        blendedColor.toArray(colors, hexIndex * 3);

        // Update the color attribute
        // hexMeshRef.current.geometry.attributes.color.needsUpdate = true;
        hexMeshRef.current.geometry.attributes.color.array = new Float32Array(colors);
        hexMeshRef.current.geometry.attributes.color.needsUpdate = true;
      }
    },
    [camera, colors],
  );

  return {
    onMouseMove,
    hexMeshRef,
  };
};
