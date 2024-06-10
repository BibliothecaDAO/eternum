import { ArmyAndName } from "@/hooks/helpers/useArmies";
import { useStructuresPosition } from "@/hooks/helpers/useStructures";
import useRealmStore from "@/hooks/store/useRealmStore";
import { getRealmOrderNameById } from "@/ui/utils/realms";
import { Position, UIPosition } from "@bibliothecadao/eternum";
import { Box } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useCallback, useMemo, useRef, useState } from "react";
import { Vector3 } from "three";
import useUIStore from "../../../../hooks/store/useUIStore";
import { soundSelector, useUiSounds } from "../../../../hooks/useUISound";
import { getUIPositionFromColRow } from "../../../utils/utils";
import { WarriorModel } from "../../models/armies/WarriorModel";
import { BannerFlag } from "../BannerFlag";
import { SelectedUnit } from "../hexagon/SelectedUnit";
import { ArmyInfoLabel } from "./ArmyInfoLabel";
import { CombatLabel } from "./CombatLabel";

export type FullArmyInfo = ArmyAndName & Position & { isMine: boolean; uiPos: UIPosition };

type ArmyProps = {
  army: FullArmyInfo;
  offset: { x: number; y: number };
};

export function Army({ army, offset }: ArmyProps & JSX.IntrinsicElements["group"]) {
  const { play: playBuildMilitary } = useUiSounds(soundSelector.hoverClick);

  const { formattedStructureAtPosition } = useStructuresPosition({ position: { x: army.x, y: army.y } });

  const startAnimationTimeRef = useRef<number | null>(null);

  const [isRunning, setIsRunning] = useState(false);

  const {
    animationPaths,
    setAnimationPaths,
    selectedEntity,
    setSelectedEntity,
    showAllArmies,
    setTargetEntity,
    targetEntity,
  } = useUIStore(
    ({
      animationPaths,
      setAnimationPaths,
      selectedEntity,
      setSelectedEntity,
      showAllArmies,
      targetEntity,
      setTargetEntity,
    }) => ({
      animationPaths,
      setAnimationPaths,
      selectedEntity,
      setSelectedEntity,
      showAllArmies,
      targetEntity,
      setTargetEntity,
    }),
  );

  const animationPath = animationPaths.find((path) => path.id === BigInt(army.entity_id));

  // Deterministic rotation based on the id
  const deterministicRotation = useMemo(() => {
    return (Number(army.entity_id) % 12) * (Math.PI / 6); // Convert to one of 12 directions in radians
  }, []);

  const [rotationY, setRotationY] = useState(deterministicRotation);
  const [hovered, setHovered] = useState(false);
  const [position, setPosition] = useState<Vector3>(
    new Vector3(army.uiPos.x + offset.x, 0.32, -army.uiPos.y - offset.y),
  );

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

  const actionMenu = useMemo(() => {
    return formattedStructureAtPosition?.entity_id !== null && selectedEntity != null;
  }, [formattedStructureAtPosition, selectedEntity, position]);

  const onRightClick = useCallback(() => {
    setTargetEntity(0n);
    if (!isRunning && army.isMine) {
      playBuildMilitary();
    }
    if ((selectedEntity?.id || 0n) !== BigInt(army.entity_id) && army.isMine) {
      setSelectedEntity({ id: BigInt(army.entity_id), position: { x: army.x, y: army.y } });
    }
  }, [army.entity_id, army.x, army.y, selectedEntity, playBuildMilitary, setSelectedEntity]);

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

  const isSelected = useMemo(() => {
    return (selectedEntity?.id || 0n) === BigInt(army.entity_id);
  }, [selectedEntity, army.entity_id]);

  const onClick = () => {
    setTargetEntity(BigInt(army.entity_id));
  };

  const showCombatLabel = useMemo(() => {
    console.log(targetEntity, BigInt(army.entity_id));

    return (
      selectedEntity !== undefined &&
      targetEntity !== 0n &&
      selectedEntity.position.x === army.x &&
      selectedEntity.position.y === army.y &&
      targetEntity === BigInt(army.entity_id)
    );
  }, [selectedEntity, targetEntity]);

  // Army can be self owned or enemy
  // location can have a structure or no strucutre and this strucutre can be owned by self or enemy

  return (
    <>
      <group position={position}>
        {showArmyInfo && <ArmyInfoLabel army={army} />}
        {army.isMine && <ArmyFlag rotationY={rotationY} position={position} />}

        {showCombatLabel && <CombatLabel visible={actionMenu} targetArmy={army} />}

        <WarriorModel
          id={Number(army.entity_id)}
          rotationY={rotationY}
          isRunning={isRunning}
          isFriendly={army.isMine}
        />
        <mesh
          position={[0, 1.6, 0]}
          onContextMenu={onRightClick}
          onClick={onClick}
          onPointerEnter={onPointerEnter}
          onPointerOut={onPointerOut}
          visible={false}
        >
          <Box args={[1, 3, 1]} />
        </mesh>
      </group>
      {isSelected && <SelectedUnit position={{ x: army.x, y: army.y }} />}
    </>
  );
}

export const ArmyFlag = ({ position, rotationY }: { position: Vector3; rotationY: number }) => {
  const realms = useRealmStore((state) => state.realmEntityIds);
  const realmOrder = useMemo(() => {
    const realmId = realms[0]?.realmId || BigInt(0);
    const orderName = getRealmOrderNameById(realmId);
    return orderName.charAt(0).toUpperCase() + orderName.slice(1);
  }, []);

  return (
    <group position={[0, 3, 0]} rotation={[0, rotationY - Math.PI / 2, 0]} scale={0.7}>
      <BannerFlag
        angle={rotationY}
        order={realmOrder}
        position={[position.x, position.y, position.z + 10]}
      ></BannerFlag>
    </group>
  );
};
