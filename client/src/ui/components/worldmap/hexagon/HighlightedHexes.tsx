import useUIStore from "../../../../hooks/store/useUIStore";
import * as THREE from "three";
import { HEX_RADIUS } from "./WorldHexagon";
import { createHexagonPath } from "./HexagonGeometry";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";

const HighlightedHexes = () => {
  const tubeRadius = 0.01; // Adjust the tube radius (width) as needed
  const radialSegments = 8; // Adjust for smoother or sharper corners
  const tubularSegments = 64; // Adjust for a smoother or more faceted tube
  const hexagonPath = createHexagonPath(HEX_RADIUS);
  const hexagonGeometry = new THREE.TubeGeometry(
    hexagonPath as any,
    tubularSegments,
    tubeRadius,
    radialSegments,
    false,
  );

  const highlightPositions = useUIStore((state) => state.highlightPositions);

  const meshRef = useRef<any>();

  useFrame(({ clock }) => {
    const elapsedTime = clock.getElapsedTime();
    const pulseFactor = Math.sin(elapsedTime * Math.PI) * 0.2 + 0.5;
    if (meshRef.current?.material) {
      meshRef.current.material.emissiveIntensity = pulseFactor;
      meshRef.current.scale.set(pulseFactor, pulseFactor, pulseFactor);
      meshRef.current.castShadow = true;
    }
  });

  return (
    <>
      {highlightPositions.map(({ pos: highlightPosition, color: highlightColor }, index) => {
        return (
          <mesh
            key={index}
            ref={meshRef}
            geometry={hexagonGeometry}
            rotation={[0, 0, 0]}
            position={[highlightPosition[0], 0.3, highlightPosition[1]]}
            castShadow={true}
          >
            <meshPhongMaterial color={highlightColor} emissive={"green"} />
          </mesh>
        );
      })}
    </>
  );
};
export default HighlightedHexes;
