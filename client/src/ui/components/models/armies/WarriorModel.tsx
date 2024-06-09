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

  const part1Height = 1; // 1/3 of the total height
  const part2Height = 1; // 1/3 of the total height
  const part3Height = 1; // 1/3 of the total height

  const part1TopRadius = 0.5;
  const part1BottomRadius = 0.6;
  const part2TopRadius = part1TopRadius;
  const part2BottomRadius = 0.5;
  const part3TopRadius = 0.4;
  const part3BottomRadius = part2TopRadius;

  const model = useMemo(() => {
    return useGLTF("/models/chess_piece_king.glb").scene.clone();
  }, []);

  return (
    <group {...props} ref={groupRef} scale={12} rotation={[0, rotationY, 0]}>
      <primitive castShadow receiveShadow object={model} />
      {/* <mesh position={[0, part1Height / 2 + 0.3, 0]} castShadow>
        <cylinderGeometry args={[part1TopRadius, part1BottomRadius, part1Height, 10]} />
        <meshStandardMaterial color={"#582C4D"} />
      </mesh>
      <mesh position={[0, part1Height + part2Height / 2 + 0.3, 0]} castShadow>
        <cylinderGeometry args={[part2TopRadius, part2BottomRadius, part2Height, 10]} />
        <meshStandardMaterial color={"#582C4D"} />
      </mesh>
      <mesh position={[0, part1Height + part2Height + part3Height / 2 + 0.3, 0]} castShadow>
        <cylinderGeometry args={[part3TopRadius, part3BottomRadius, part3Height, 10]} />
        <meshStandardMaterial color={"#582C4D"} />
      </mesh> */}
    </group>
  );
}
