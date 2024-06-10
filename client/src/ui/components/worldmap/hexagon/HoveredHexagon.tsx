import React, { useEffect, useMemo, useRef } from "react";
import { Image } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import useUIStore from "@/hooks/store/useUIStore";
import { getUIPositionFromColRow } from "@/ui/utils/utils";
import * as THREE from "three";

export const HoveredHexagon = () => {
  const imageRef = useRef<any>();
  const { hoveredHex, highlightPositions } = useUIStore((state) => ({
    hoveredHex: state.hoveredHex,
    highlightPositions: state.highlightPositions,
  }));

  useFrame(() => {
    if (imageRef.current) {
      imageRef.current.rotation.z += 0.01;
    }
  });

  const hoveredHexPosition = useMemo(() => {
    if (!hoveredHex) return { x: 0, y: 0 };
    return getUIPositionFromColRow(hoveredHex.col, hoveredHex.row);
  }, [hoveredHex]);

  const isHighlighted = useMemo(() => {
    return highlightPositions.pos.some(
      (highlightPos) => highlightPos[0] === hoveredHexPosition.x && highlightPos[1] === -hoveredHexPosition.y,
    );
  }, [highlightPositions, hoveredHexPosition]);

  useEffect(() => {
    if (imageRef.current) {
      imageRef.current.material.color.set(isHighlighted ? highlightPositions.color : 0xffffff);
    }
  }, [isHighlighted, highlightPositions.color]);

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
