import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { ArmyHitBox } from "../../worldmap/armies/ArmyHitBox";
import { ArmyInfo } from "@/hooks/helpers/useArmies";

type WarriorModelProps = {
  army: ArmyInfo;
  isAnimating: boolean;
};

export function WarriorModel({ army, isAnimating }: WarriorModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const gltf = useGLTF("/models/chess_piece_king.glb");

  const [hovered, setHovered] = useState(false);

  const model = useMemo(() => {
    gltf.scene.traverse((child: any) => {
      if (child.isMesh) {
        child.material = child.material.clone(); // Clone the material to avoid mutating the original material
        child.material.userData.originalColor = child.material.color.getHex();
      }
    });
    return gltf.scene.clone();
  }, []);

  useEffect(() => {
    if (hovered) {
      handlePointerEnter();
    } else {
      handlePointerOut();
    }
  }, [hovered]);

  const handlePointerEnter = () => {
    model.traverse((child: any) => {
      if (child.isMesh) {
        child.material.color.set(2, 2, 1); // Change color to yellow on hover
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
    <group ref={groupRef}>
      <primitive castShadow receiveShadow object={model} renderOrder={1} scale={12} />
      <ArmyHitBox hovered={hovered} setHovered={setHovered} army={army} isAnimating={isAnimating} />
    </group>
  );
}
