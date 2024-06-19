import useUIStore from "@/hooks/store/useUIStore";
import { useShovelSound } from "@/hooks/useUISound";
import { EXPLORE_COLOUR, TRAVEL_COLOUR } from "@/ui/config";
import { getUIPositionFromColRow } from "@/ui/utils/utils";
import { Image } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";

export const HoveredHexagon = () => {
  const { play: playShovelSound } = useShovelSound();

  const imageRef = useRef<any>();
  const { hoveredHex, travelPaths } = useUIStore((state) => ({
    hoveredHex: state.hoveredHex,
    travelPaths: state.travelPaths,
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

  const travelPath = useMemo(() => {
    return hoveredHex ? travelPaths.get(`${hoveredHex.col},${hoveredHex.row}`) : undefined;
  }, [travelPaths, hoveredHex]);

  useEffect(() => {
    const color = travelPath ? (travelPath.isExplored ? TRAVEL_COLOUR : EXPLORE_COLOUR) : 0xffffff;
    if (imageRef.current) {
      imageRef.current.material.color.set(color);
    }
    if (travelPath) playShovelSound();
  }, [travelPath]);

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
