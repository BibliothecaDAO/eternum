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

export const useArmyAnimation = (position: Position, offset: Position, isMine: boolean) => {
  const { play: playMarchingSound } = useUiSounds(soundSelector.fly);
  const prevPositionRef = useRef<Position | null>(null);
  const [animationPath, setAnimationPath] = useState<UIPosition[] | null>(null);
  const currentIndex = useRef(1);
  const isAnimatingRef = useRef(false);

  const groupRef = useRef<Group>(null);

  useEffect(() => {
    if (!prevPositionRef.current) {
      prevPositionRef.current = position;
      return;
    }

    const exploredHexes = useExploredHexesStore.getState().exploredHexes;
    if (prevPositionRef.current.x !== position.x || prevPositionRef.current.y !== position.y) {
      const startPos = { x: prevPositionRef.current.x, y: prevPositionRef.current.y };
      const endPos = position;
      let uiPath = findShortestPathBFS(startPos, endPos, exploredHexes).map((pos) =>
        getUIPositionFromColRow(pos.x, pos.y),
      );
      // in case that there is no path, we will just move to the end position, can apply for pillage for example
      if (uiPath.length === 0) {
        uiPath = [getUIPositionFromColRow(startPos.x, startPos.y), getUIPositionFromColRow(endPos.x, endPos.y)];
      }
      setAnimationPath(uiPath.map((pos) => applyOffset(pos, offset)));
      prevPositionRef.current = position;
      isMine && playMarchingSound(); // Play marching sound when animation starts
      isAnimatingRef.current = true;
    }
  }, [position.x, position.y]);

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
        isAnimatingRef.current = false;
      } else {
        isMine && playMarchingSound();
      }
    }
  });

  return { groupRef, isAnimating: isAnimatingRef };
};
