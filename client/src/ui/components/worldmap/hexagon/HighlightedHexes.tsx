import useUIStore from "../../../../hooks/store/useUIStore";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { placeholderMaterial } from "@/shaders/placeholderMaterial";
import { createHexagonShape } from "./HexagonGeometry";

const hexMaterial = placeholderMaterial.clone();
hexMaterial.depthTest = false;

const bigHexagonShape = createHexagonShape(3);
const hexagonGeometry = new THREE.ShapeGeometry(bigHexagonShape);

const HighlightedHexes = () => {
  const highlightPositions = useUIStore((state) => state.highlightPositions);

  const meshRefs = useRef<any[]>([]);

  useFrame(({ clock }) => {
    const elapsedTime = clock.getElapsedTime();
    const pulseFactor = Math.abs(Math.sin(elapsedTime * 2) / 16);
    meshRefs.current.forEach((mesh) => {
      if (mesh?.material) {
        mesh.material.uniforms.opacity.value = pulseFactor;
      }
    });
  });

  // useEffect(() => {
  //   hexMaterial.uniforms.color.value = new THREE.Color(highlightPath.color || highlightPositions.color);
  // }, [highlightPositions, highlightPath]);

  return (
    <>
      {highlightPositions.pos.map((pos, index) => {
        return (
          <mesh
            key={index}
            ref={(el) => (meshRefs.current[index] = el)}
            name="free-cell-placeholder"
            rotation={[-Math.PI / 2, 0, 0]}
            position={[pos[0], 0.32, pos[1]]}
            geometry={hexagonGeometry}
            material={hexMaterial}
          />
        );
      })}
    </>
  );
};
export default HighlightedHexes;
