import React, { useMemo, useRef } from "react";
import { Image } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import useUIStore from "@/hooks/store/useUIStore";
import { getUIPositionFromColRow } from "@/ui/utils/utils";
import { PointLight } from "three";

interface SelectedUnitProps {
  position: {
    x: number;
    y: number;
  };
}

export const SelectedUnit = ({ position }: SelectedUnitProps) => {
  const imageRef = useRef<any>();

  useFrame(() => {
    if (imageRef.current) {
      imageRef.current.rotation.z += 0.01;
    }
  });

  const selectedUnitPosition = useMemo(() => {
    if (!position) return { x: 0, y: 0 };
    return getUIPositionFromColRow(position.x, position.y);
  }, [position]);

  return (
    <group position={[selectedUnitPosition.x, 0, -selectedUnitPosition.y]}>
      <Image
        ref={imageRef}
        position={[0, 0.6, 0]}
        zoom={1}
        opacity={0.2}
        transparent
        scale={5}
        url="/textures/aura.png"
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={1}
        color={"yellow"}
      />
      <pointLight position={[0, 1.5, 0]} power={25} />
    </group>
  );
};
