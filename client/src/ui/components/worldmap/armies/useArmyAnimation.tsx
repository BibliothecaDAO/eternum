import { Position, UIPosition } from "@bibliothecadao/eternum";
import { findShortestPathBFS } from "../hexagon/utils";
import { useExploredHexesStore } from "../hexagon/WorldHexagon";
import { applyOffset } from "./utils";
import { getUIPositionFromColRow } from "../../../utils/utils";
import { Group, Vector3 } from "three";
import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { soundSelector, useUiSounds } from "@/hooks/useUISound";

const vec = new Vector3();

export const useArmyAnimation = (position: Position, offset: Position) => {
  const { play: playMarchingSound } = useUiSounds(soundSelector.fly);
  const exploredHexes = useExploredHexesStore((state) => state.exploredHexes);
  const prevPositionRef = useRef<Position | null>(null);
  const [animationPath, setAnimationPath] = useState<UIPosition[] | null>(null);
  const currentIndex = useRef(1);

  const groupRef = useRef<Group>(null);

  const { x, y } = position;

  useEffect(() => {
    if (!prevPositionRef.current) {
      prevPositionRef.current = { x, y };
      return;
    }
    if (prevPositionRef.current.x !== x || prevPositionRef.current.y !== y) {
      const startPos = { x: prevPositionRef.current.x, y: prevPositionRef.current.y };
      const endPos = { x, y };
      const uiPath = findShortestPathBFS(startPos, endPos, exploredHexes).map((pos) =>
        getUIPositionFromColRow(pos.x, pos.y),
      );
      setAnimationPath(uiPath.map((pos) => applyOffset(pos, offset)));
      prevPositionRef.current = { x, y };
      playMarchingSound(); // Play marching sound when animation starts
    }
  }, [position]);

  useFrame((_, delta) => {
    if (!animationPath || !groupRef.current) return;
    const pos = animationPath[currentIndex.current];
    vec.set(pos.x, 0.32, -pos.y);
    groupRef.current.position.lerp(vec, delta * 3);

    if (vec.distanceTo(groupRef.current.position) < 0.1) {
      currentIndex.current++;
      if (currentIndex.current >= animationPath.length) {
        setAnimationPath(null);
        currentIndex.current = 1;
      } else {
        playMarchingSound();
      }
    }
  });

  return groupRef;
};
