import React, { useEffect, useMemo, useRef } from "react";
import { Image } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import useUIStore from "@/hooks/store/useUIStore";
import { getUIPositionFromColRow } from "@/ui/utils/utils";
import * as THREE from "three";

export const HoveredHexagon = () => {
  const imageRef = useRef<any>();
  const hoveredHex = useUIStore((state) => state.hoveredHex);
  const highlightPath = useUIStore((state) => state.highlightPath);

  useFrame(() => {
    if (imageRef.current) {
      imageRef.current.rotation.z += 0.01;
    }
  });

  const hoveredHexPosition = useMemo(() => {
    if (!hoveredHex) return { x: 0, y: 0 };
    return getUIPositionFromColRow(hoveredHex.col, hoveredHex.row);
  }, [hoveredHex]);

  useEffect(() => {
    if (
      highlightPath.pos.some(
        (highlightPos) => highlightPos[0] === hoveredHexPosition.x && highlightPos[1] === -hoveredHexPosition.y,
      )
    ) {
      imageRef.current.material.color.set(highlightPath.color);
    } else {
      imageRef.current.material.color.set(0xffffff);
    }
  }, [highlightPath, hoveredHexPosition]);

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
