import * as THREE from "three";
import { useMemo, useRef } from "react";
import { Vector3 } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";

type WarriorModelProps = {
  id: number;
  position?: Vector3;
  rotationY: number;
  isRunning: boolean;
  isFriendly: boolean;
};

export function WarriorModel({ id, position, rotationY, isRunning, isFriendly, ...props }: WarriorModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const gltf = useGLTF("/models/chess_piece_king.glb");

  const model = useMemo(() => {
    gltf.scene.traverse((child: any) => {
      if (child.isMesh) {
        child.material.userData.originalColor = child.material.color.getHex();
        child.material = child.material.clone(); // Clone the material to avoid mutating the original material
      }
    });
    return gltf.scene.clone();
  }, []);

  const handlePointerEnter = () => {
    model.traverse((child: any) => {
      if (child.isMesh) {
        child.material.color.set("yellow"); // Change color to yellow on hover
      }
    });
  };

  const handlePointerOut = () => {
    model.traverse((child: any) => {
      if (child.isMesh) {
        child.material.color.setHex(child.material.userData.originalColor); // Revert to original color
      }
    });
  };

  return (
    <group
      {...props}
      ref={groupRef}
      scale={12}
      rotation={[0, rotationY, 0]}
      onPointerEnter={handlePointerEnter}
      onPointerOut={handlePointerOut}
    >
      <primitive castShadow receiveShadow object={model} />
    </group>
  );
}
