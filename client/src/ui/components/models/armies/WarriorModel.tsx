import { useGLTF } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";

type WarriorModelProps = {
  rotationY: number;
};

export function WarriorModel({ rotationY, ...props }: WarriorModelProps) {
  const groupRef = useRef<THREE.Group>(null);

  const model = useMemo(() => {
    return useGLTF("/models/chess_piece_king.glb").scene.clone();
  }, []);

  return (
    <group {...props} ref={groupRef} scale={12} rotation={[0, rotationY, 0]}>
      <primitive castShadow receiveShadow object={model} />
    </group>
  );
}
