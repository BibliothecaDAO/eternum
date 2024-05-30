import useUIStore from "../../../../hooks/store/useUIStore";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";

const HighlightedHexes = () => {
  const highlightPath = useUIStore((state) => state.highlightPath);
  const highlightPositions = useUIStore((state) => state.highlightPositions);

  useEffect(() => {
    meshRefs.current.forEach((mesh, index) => {
      if (mesh) {
        const pos = highlightPositions.pos[index];
        const isHighlighted = highlightPath.pos.some(
          (highlightPos) => highlightPos[0] === pos[0] && highlightPos[1] === pos[1] && highlightPos[2] === pos[2],
        );
        const color = isHighlighted ? highlightPath.color : highlightPositions.color;
        mesh.material.color.set(color);
      }
    });
  }, [highlightPath, highlightPositions]);

  const hexagonGeometry = new THREE.RingGeometry(2, 1.5, 6, 1);

  const meshRefs = useRef<any[]>([]);
  useFrame(({ clock }) => {
    const elapsedTime = clock.getElapsedTime();
    const pulseFactor = Math.sin(elapsedTime * Math.PI * 1.5) * 0.3 + 1;
    meshRefs.current.forEach((mesh) => {
      if (mesh?.material) {
        mesh.material.emissiveIntensity = pulseFactor;
        mesh.scale.set(pulseFactor, pulseFactor, pulseFactor);
      }
    });
  });

  return (
    <>
      {highlightPositions.pos.map((pos, index) => {
        return (
          <mesh
            key={index}
            ref={(el) => (meshRefs.current[index] = el)}
            geometry={hexagonGeometry}
            rotation={[Math.PI / 2, 0, Math.PI / 2]}
            position={[pos[0], 0.4, pos[1]]}
          >
            <meshStandardMaterial color={highlightPositions.color} emissive={"green"} />
          </mesh>
        );
      })}
    </>
  );
};
export default HighlightedHexes;
