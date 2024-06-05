import React, { useMemo, useRef } from "react";
import { Image } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import useUIStore from "@/hooks/store/useUIStore";
import { getUIPositionFromColRow } from "@/ui/utils/utils";

export const HoveredHexagon = () => {
  const imageRef = useRef<any>();
  const hoveredHex = useUIStore((state) => state.hoveredHex);

  useFrame(() => {
    if (imageRef.current) {
      imageRef.current.rotation.z += 0.01;
    }
  });

  const hoveredHexPosition = useMemo(() => {
    if (!hoveredHex) return { x: 0, y: 0 };
    return getUIPositionFromColRow(hoveredHex.col, hoveredHex.row);
  }, [hoveredHex]);

  return (
    <Image
      ref={imageRef}
      position={[hoveredHexPosition.x, 0.5, -hoveredHexPosition.y]}
      zoom={1}
      opacity={0.2}
      transparent
      scale={5}
      url="/textures/aura.png"
      rotation={[-Math.PI / 2, 0, 0]}
      renderOrder={1}
    />
  );
};
