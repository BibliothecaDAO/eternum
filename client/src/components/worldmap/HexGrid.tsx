import { Environment } from "@react-three/drei";
import { createHexagonGeometry, getBiome } from "./components/three/HexagonBackground";
import useUIStore from "../../hooks/store/useUIStore";
import { useEffect } from "react";
import { Color, InstancedBufferAttribute, InstancedMesh, Matrix4, ShaderMaterial } from "three";

const HexagonGrid = ({ rows, cols, hexRadius }: any) => {
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);

  useEffect(() => {
    setTimeout(() => {
      setIsLoadingScreenEnabled(false);
    }, 300);
  }, []);

  const depth = 1;
  const radiusPosition = hexRadius;
  const hexagonGeometry = createHexagonGeometry(radiusPosition, depth);

  const hexHeight = hexRadius * 2;
  const hexWidth = Math.sqrt(3) * hexRadius;
  const vertDist = hexHeight * 0.75;
  const horizDist = hexWidth;

  //   const hexMaterial = new MeshBasicMaterial({
  //     color: 0xffffff,
  //     vertexColors: true, // Enable vertex colors
  //   });
  const hexMesh = new InstancedMesh(hexagonGeometry, hexMaterial, rows * cols);

  let matrix = new Matrix4();
  let idx = 0;

  const depths = new Float32Array(rows * cols); // Array to store depth for each instance
  let colors: number[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * horizDist + ((row % 2) * horizDist) / 2;
      const y = row * vertDist;
      const biome = getBiome(col, row);
      // apply different color
      const color = new Color(biome.backgroundColor); // Convert the color to THREE.Color
      color.toArray(colors, idx * 3); // Add color data to the colors array

      // depth
      depths[row * cols + col] = biome.depth; // Assign depth based on biome

      matrix.setPosition(x, y, 0);
      hexMesh.setMatrixAt(idx, matrix);

      idx++;
    }
  }

  // Create an InstancedBufferAttribute for colors
  const colorAttribute = new InstancedBufferAttribute(new Float32Array(colors), 3);
  hexMesh.geometry.setAttribute("color", colorAttribute);

  const depthAttribute = new InstancedBufferAttribute(depths, 1);
  hexMesh.geometry.setAttribute("depth", depthAttribute);

  return <primitive object={hexMesh}></primitive>;
};

export const Map = () => {
  return (
    <mesh>
      <ambientLight color={"white"} intensity={1} />
      <pointLight rotation={[Math.PI / -2, 0, 0]} position={[10, 20, 10]} intensity={20} />
      <mesh rotation={[Math.PI / -2, 0, 0]}>
        <HexagonGrid rows={100} cols={100} hexRadius={3} />
      </mesh>
      <Environment preset="dawn" />
    </mesh>
  );
};

const vertexShader = `
attribute float depth;
varying vec3 vColor;

void main() {
  // Modify vertex position based on depth
  vec3 pos = position;
  pos.z *= depth;

  vColor = color; // Pass color to fragment shader
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(pos, 1.0);
}
`;

const fragmentShader = `
varying vec3 vColor;

void main() {
  gl_FragColor = vec4(vColor, 1.0);
}
`;

const hexMaterial = new ShaderMaterial({
  vertexShader,
  fragmentShader,
  vertexColors: true,
});
