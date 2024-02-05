import { Environment } from "@react-three/drei";
import { createHexagonGeometry } from "./components/three/HexagonBackground";
import useUIStore from "../../hooks/store/useUIStore";
import { MutableRefObject, Ref, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const highlightMode = true;

  // const hexMeshRefs = useRef<InstancedMesh<ExtrudeGeometry, MeshBasicMaterial>[]>([]);

  useEffect(() => {
    setTimeout(() => {
      setIsLoadingScreenEnabled(false);
      setMapHasLoaded(true);
    }, 300);
  }, []);

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

  // need to optimize further
  // useHighlightHex(hexMeshRefs);

  //  Create instanced meshes for each group
  // Divide hexData into groups based on columns
  // why are they in a differnet
  const hexGroups = [];
  for (let i = 0; i < cols; i += 100) {
    const startCol = i + 2147483647;
    const groupData = hexData.filter((hex) => hex.col >= startCol && hex.col < startCol + 100);
    hexGroups.push(groupData);
  }

  const hexMeshes = hexGroups.map((group, index) => {
    const mesh = new InstancedMesh(hexagonGeometry, hexMaterial, group.length);
    mesh.name = `hexMesh_${index}`;

    // hexMeshRefs.current[index] = mesh;

    let idx = 0;
    let colors: number[] = []; // Initialize the colors array

    group.forEach((hex) => {
      const col = hex.col - 2147483647;
      const row = hex.row - 2147483647;
      const x = col * horizDist + ((row % 2) * horizDist) / 2;
      const y = row * vertDist;

      const color = new Color(hex.color);
      color.toArray(colors, idx * 3);

      let matrix = new Matrix4();
      matrix.setPosition(x, y, hex.depth * 10);
      mesh.setMatrixAt(idx, matrix);
      idx++;
    });

    const colorAttribute = new InstancedBufferAttribute(new Float32Array(colors), 3);
    mesh.geometry.setAttribute("color", colorAttribute);

    return mesh;
  });

  // print each color attribute
  hexMeshes.forEach((mesh) => {
    console.log(mesh.geometry.getAttribute("color"));
  });

  return (
    <>
      {hexMeshes.map((mesh, index) => (
        <primitive key={index} object={mesh} />
      ))}
    </>
  );
};

export const Map = () => {
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

const useHighlightHex = (hexMeshRefs: Ref<InstancedMesh<ExtrudeGeometry, MeshBasicMaterial>>[]) => {
  const camera = useThree((state) => state.camera);

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

      hexMeshRefs.current.forEach((ref) => {
        const mesh = ref;
        if (!mesh) return;

        // Calculate objects intersecting the picking ray. Assume hexMeshRef.current is the instanced mesh
        const intersects = raycaster.intersectObject(mesh);

        if (intersects.length > 0) {
          // Get the first intersected object
          const intersectedHex = intersects[0];
          const hexIndex = intersectedHex.instanceId;

          let colors = getColorFromMesh(mesh);

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
          mesh.geometry.attributes.color.array = new Float32Array(colors);
          mesh.geometry.attributes.color.needsUpdate = true;
        }
      });
    },
    [camera],
  );

  useEffect(() => {
    // only add it
    // Add event listener for mouse move
    document.addEventListener("mousemove", onMouseMove);

    return () => {
      // Remove event listener when the component is unmounted
      document.removeEventListener("mousemove", onMouseMove);
    };
  }, []);
};

const getColorFromMesh = (mesh) => {
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
