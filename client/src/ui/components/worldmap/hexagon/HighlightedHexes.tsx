import useUIStore from "../../../../hooks/store/useUIStore";
import * as THREE from "three";
import { HEX_RADIUS } from "./WorldHexagon";
import { createHexagonPath } from "./HexagonGeometry";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";

const HighlightedHexes = () => {
  const tubeRadius = 0.1; // Adjust the tube radius (width) as needed
  const radialSegments = 10; // Adjust for smoother or sharper corners
  const tubularSegments = 64; // Adjust for a smoother or more faceted tube
  const hexagonPath = createHexagonPath(HEX_RADIUS);
  const hexagonGeometry = new THREE.RingGeometry(2, 1.5, 8, 1);

  const highlightPositions = useUIStore((state) => state.highlightPositions);

  const meshRefs = useRef<any[]>([]);

  useFrame(({ clock }) => {
    const elapsedTime = clock.getElapsedTime();
    const pulseFactor = Math.sin(elapsedTime * Math.PI) * 0.2 + 0.5;
    meshRefs.current.forEach((mesh) => {
      if (mesh?.material) {
        mesh.material.emissiveIntensity = pulseFactor;
        mesh.rotation.z = elapsedTime * Math.PI;
      }
    });
  });

  return (
    <>
      {highlightPositions.map(({ pos: highlightPosition, color: highlightColor }, index) => {
        return (
          <mesh
            key={index}
            ref={(el) => (meshRefs.current[index] = el)}
            geometry={hexagonGeometry}
            rotation={[Math.PI / 2, 0, Math.PI / 2]}
            position={[highlightPosition[0], 0.3, highlightPosition[1]]}
          >
            <meshStandardMaterial color={highlightColor} emissive={"green"} />
          </mesh>
        );
      })}
    </>
  );
};
export default HighlightedHexes;
