import { useFrame } from "@react-three/fiber";
import { useCallback, useMemo, useRef, useState } from "react";
import useUIStore from "../../../../hooks/store/useUIStore";
import { soundSelector, useUiSounds } from "../../../../hooks/useUISound";
import { Position, UIPosition } from "@bibliothecadao/eternum";
import { WarriorModel } from "../../models/armies/WarriorModel";
import { Vector3 } from "three";
import { getUIPositionFromColRow } from "../../../utils/utils";
import { ArmyInfoLabel } from "./ArmyInfoLabel";
import { BannerFlag } from "../BannerFlag";
import { Box } from "@react-three/drei";
import { useDojo } from "@/hooks/context/DojoContext";
import { ArmyAndName } from "@/hooks/helpers/useArmies";
import { AttackOrPillageLabel } from "./AttackOrPillageLabel";

type ArmyProps = {
  info: ArmyAndName & { order: string; id: bigint; isMine: boolean; contractPos: Position; uiPos: UIPosition };
  offset: { x: number; y: number };
};

export function Army({ info, offset, ...props }: ArmyProps & JSX.IntrinsicElements["group"]) {
  const { play: playBuildMilitary } = useUiSounds(soundSelector.buildMilitary);
  const { account } = useDojo();

  const animationPaths = useUIStore((state) => state.animationPaths);
  const setAnimationPaths = useUIStore((state) => state.setAnimationPaths);
  const setSelectedEntity = useUIStore((state) => state.setSelectedEntity);
  const selectedEntity = useUIStore((state) => state.selectedEntity);
  const showAllArmies = useUIStore((state) => state.showAllArmies);

  const animationPath = animationPaths.find((path) => path.id === info.id);

  const startAnimationTimeRef = useRef<number | null>(null);

  // Deterministic rotation based on the id
  const deterministicRotation = useMemo(() => {
    return (Number(info.id) % 12) * (Math.PI / 6); // Convert to one of 12 directions in radians
  }, []);
  const [rotationY, setRotationY] = useState(deterministicRotation);

  const [hovered, setHovered] = useState(false);
  const [position, setPosition] = useState<Vector3>(
    new Vector3(info.uiPos.x + offset.x, 0.32, -info.uiPos.y - offset.y),
  );
  const [isRunning, setIsRunning] = useState(false);

  useFrame(() => {
    if (!animationPath) return;

    const now = Date.now();
    const startTime = startAnimationTimeRef.current ?? now;
    if (!startAnimationTimeRef.current) {
      setIsRunning(true);
      startAnimationTimeRef.current = now;
    }

    const uiPath = animationPath.path.map((pos) => getUIPositionFromColRow(pos.x, pos.y));
    const timeElapsed = now - startTime;
    const timeToComplete = uiPath.length * 1000;
    const progress = Math.min(timeElapsed / timeToComplete, 1);
    const pathIndex = Math.floor(progress * uiPath.length);
    const currentPath = uiPath.slice(pathIndex, pathIndex + 2);

    if (progress >= 1 || currentPath.length < 2) {
      setIsRunning(false);
      setAnimationPaths(animationPaths.filter((path) => path.id !== animationPath.id));
      startAnimationTimeRef.current = null;
      return;
    }

    const progressBetweenPoints = (progress - (1 / uiPath.length) * pathIndex) * uiPath.length;
    const applyOffset = (point: { x: number; y: number }, isFirstOrLast: boolean) => ({
      x: point.x + (isFirstOrLast ? offset.x : 0),
      y: point.y + (isFirstOrLast ? offset.y : 0),
    });

    const startPoint = applyOffset(currentPath[0], pathIndex === 0);
    const endPoint = applyOffset(currentPath[1], pathIndex === uiPath.length - 2);
    const currentPos = {
      x: startPoint.x + (endPoint.x - startPoint.x) * progressBetweenPoints,
      y: startPoint.y + (endPoint.y - startPoint.y) * progressBetweenPoints,
    };

    const direction = new Vector3(endPoint.x - startPoint.x, 0, -(endPoint.y - startPoint.y)).normalize();
    setPosition(new Vector3(currentPos.x, 0.32, -currentPos.y));

    if (!direction.equals(new Vector3(0, 0, 0))) {
      const rotation = Math.atan2(direction.x, direction.z);
      setRotationY(rotation);
    }
  });

  const isAttackable = useMemo(() => {
    if (
      selectedEntity &&
      selectedEntity!.position.x === info.contractPos.x &&
      selectedEntity!.position.y === info.contractPos.y &&
      info.id !== selectedEntity.id
    ) {
      return true;
    }
    return false;
  }, [selectedEntity]);

  const onClick = useCallback(() => {
    if (!isRunning && info.isMine) {
      playBuildMilitary();
    }
    if (selectedEntity?.id !== info.id && info.isMine) {
      setSelectedEntity({ id: info.id, position: info.contractPos });
    }
  }, [info.id, info.contractPos, selectedEntity, playBuildMilitary, setSelectedEntity]);

  const onPointerEnter = useCallback((e: any) => {
    e.stopPropagation();
    setHovered(true);
  }, []);
  const onPointerOut = useCallback((e: any) => {
    e.stopPropagation();
    setHovered(false);
  }, []);

  const showArmyInfo = useMemo(() => {
    return showAllArmies || hovered;
  }, [showAllArmies, hovered]);

  return (
    <>
      <group position={position}>
        {showArmyInfo && <ArmyInfoLabel info={info} accountAddress={account.account.address} />}
        {info.isMine && <ArmyFlag rotationY={rotationY} position={position} order={info.order} />}
        {isAttackable && (
          <AttackOrPillageLabel attackerEntityId={selectedEntity!.id} attackedInfo={info}></AttackOrPillageLabel>
        )}
        <WarriorModel
          {...props}
          id={Number(info.id)}
          rotationY={rotationY}
          isRunning={isRunning}
          isFriendly={info.isMine}
        />
        <mesh
          position={[0, 1.6, 0]}
          onContextMenu={onClick}
          onPointerEnter={onPointerEnter}
          onPointerOut={onPointerOut}
          visible={false}
        >
          <Box
            // material-color="hotpink"
            args={[1, 3, 1]} // Args for the buffer geometry
          />
        </mesh>
      </group>
    </>
  );
}

export const ArmyFlag = ({ position, order, rotationY }: { position: Vector3; order: string; rotationY: number }) => {
  return (
    <group position={[0, 0, 0]} rotation={[0, rotationY - Math.PI / 2, 0]} scale={0.7}>
      <BannerFlag angle={rotationY} order={order} position={[position.x, position.y, position.z + 10]}></BannerFlag>
    </group>
  );
};
