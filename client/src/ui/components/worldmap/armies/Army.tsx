import { useFrame } from "@react-three/fiber";
import { useCallback, useMemo, useRef, useState } from "react";
import useUIStore from "../../../../hooks/store/useUIStore";
import { soundSelector, useUiSounds } from "../../../../hooks/useUISound";
import { Position, UIPosition } from "@bibliothecadao/eternum";
import { WarriorModel } from "../../models/armies/WarriorModel";
import { Vector3 } from "three";
import { getUIPositionFromColRow } from "../../../utils/utils";
import { ArmyInfoLabel } from "./ArmyInfoLabel";
import { Flag } from "../Flag";
import { ArmyMenu } from "./ArmyMenu";

type ArmyProps = {
  info: { contractPos: Position; uiPos: UIPosition; id: bigint; isDead: boolean; order: string; isMine: boolean };
  offset: { x: number; y: number };
};

export function Army({ info, offset, ...props }: ArmyProps & JSX.IntrinsicElements["group"]) {
  const { play: playBuildMilitary } = useUiSounds(soundSelector.buildMilitary);
  const animationPaths = useUIStore((state) => state.animationPaths);
  const setAnimationPaths = useUIStore((state) => state.setAnimationPaths);
  const setSelectedEntity = useUIStore((state) => state.setSelectedEntity);
  const selectedEntity = useUIStore((state) => state.selectedEntity);

  const animationPath = useMemo(() => animationPaths.find((path) => path.id === info.id), [animationPaths]);

  const startAnimationTimeRef = useRef<number | null>(null);

  const [hovered, setHovered] = useState(false);
  const [position, setPosition] = useState<Vector3>(
    new Vector3(info.uiPos.x + offset.x, 0.32, -info.uiPos.y - offset.y),
  );
  const [rotationY, setRotationY] = useState<number>(0);
  const [isRunning, setIsRunning] = useState(false);

  useFrame(() => {
    // animate
    if (animationPath) {
      const uiPath = animationPath.path.map((pos) => getUIPositionFromColRow(pos.x, pos.y));
      const now = Date.now();
      let timeElapsed = 0;
      const startTime = startAnimationTimeRef.current;
      const timeToComplete = uiPath.length * 1000;
      if (!startTime) {
        setIsRunning(true);
        startAnimationTimeRef.current = now;
      } else {
        timeElapsed = now - startTime;
      }
      const progress = Math.min(timeElapsed / timeToComplete, 1);

      const pathIndex = Math.floor(progress * uiPath.length);
      const currentPath: Position[] = uiPath.slice(pathIndex, pathIndex + 2);

      // stop if progress is >= 1
      if (progress >= 1 || currentPath.length < 2) {
        setIsRunning(false);
        // reset all
        const paths = [...animationPaths];
        const index = paths.indexOf(animationPath);
        if (index > -1) {
          paths.splice(index, 1);
        }
        setAnimationPaths(paths);
        // reset time
        startAnimationTimeRef.current = null;
        return;
      }

      // calculate progress between 2 points
      const progressBetweenPoints = (progress - (1 / uiPath.length) * pathIndex) / (1 / uiPath.length);

      // add offset if currentPath[1] is the last point
      if (pathIndex === uiPath.length - 2) {
        currentPath[1].x += offset.x;
        currentPath[1].y += offset.y;
      }

      // add offset if currentPath[0] is the first point
      if (pathIndex === 0) {
        currentPath[0].x += offset.x;
        currentPath[0].y += offset.y;
      }

      const currentPos = {
        x: currentPath[0].x + (currentPath[1].x - currentPath[0].x) * progressBetweenPoints,
        y: currentPath[0].y + (currentPath[1].y - currentPath[0].y) * progressBetweenPoints,
      };

      // Determine the direction of movement
      const direction = new Vector3(
        currentPath[1].x - currentPath[0].x,
        0,
        -(currentPath[1].y - currentPath[0].y), // Negate Y to match the Three.js coordinate system
      ).normalize();

      const z = 0.32;
      setPosition(new Vector3(currentPos.x, z, -currentPos.y));

      // Calculate and update rotation to face the direction of movement
      if (!direction.equals(new Vector3(0, 0, 0))) {
        const angle = Math.atan2(direction.x, direction.z);
        setRotationY(angle);
      }
    }
  });

  const onClick = useCallback(() => {
    if (!info.isDead && !isRunning && info.isMine) {
      playBuildMilitary();
    }
    setSelectedEntity({ id: info.id, position: info.contractPos });
  }, [info.isDead, info.id, info.contractPos, playBuildMilitary, setSelectedEntity]);

  const onPointerIn = useCallback((e: any) => {
    e.stopPropagation();
    setHovered(true);
  }, []);
  const onPointerOut = useCallback((e: any) => {
    e.stopPropagation();
    setHovered(false);
  }, []);

  return (
    <>
      {hovered && <ArmyInfoLabel position={info.uiPos} armyId={info.id} />}
      {/* {!info.isDead && info.isMine && <Flag angle={rotationY} order={info.order} position={position}></Flag>} */}
      <group position={position}>
        {selectedEntity && selectedEntity.id == info.id && <ArmyMenu entityId={info.id} />}
        <WarriorModel
          {...props}
          id={Number(info.id)}
          rotationY={rotationY}
          onClick={onClick}
          onPointerEnter={onPointerIn}
          onPointerOut={onPointerOut}
          isRunning={isRunning}
          hovered={hovered}
          isDead={info.isDead}
          isFriendly={info.isMine}
        />
      </group>
    </>
  );
}
