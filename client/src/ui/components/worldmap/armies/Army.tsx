import { ArmyInfo } from "@/hooks/helpers/useArmies";
import useRealmStore from "@/hooks/store/useRealmStore";
import { getRealmOrderNameById } from "@/ui/utils/realms";
import { Box } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Vector3 } from "three";
import useUIStore from "../../../../hooks/store/useUIStore";
import { soundSelector, useUiSounds } from "../../../../hooks/useUISound";
import { getUIPositionFromColRow } from "../../../utils/utils";
import { WarriorModel } from "../../models/armies/WarriorModel";
import { BannerFlag } from "../BannerFlag";
import { SelectedUnit } from "../hexagon/SelectedUnit";
import { ArmyInfoLabel } from "./ArmyInfoLabel";
import { CombatLabel } from "./CombatLabel";
import { Position, UIPosition } from "@bibliothecadao/eternum";
import { findShortestPathBFS } from "../hexagon/utils";
import { useExploredHexesStore } from "../hexagon/WorldHexagon";

type ArmyProps = {
  army: ArmyInfo;
};

export function Army({ army }: ArmyProps & JSX.IntrinsicElements["group"]) {
  const { play: playBuildMilitary } = useUiSounds(soundSelector.hoverClick);
  const startAnimationTimeRef = useRef<number | null>(null);
  const prevPositionRef = useRef<Position | null>(null);
  const exploredHexes = useExploredHexesStore((state) => state.exploredHexes);
  const [animationPath, setAnimationPath] = useState<UIPosition[] | null>(null);

  useEffect(() => {
    if (!prevPositionRef.current) {
      prevPositionRef.current = { x: army.x, y: army.y };
      return;
    }
    if (prevPositionRef.current.x !== army.x || prevPositionRef.current.y !== army.y) {
      const startPos = { x: prevPositionRef.current.x, y: prevPositionRef.current.y };
      const endPos = { x: army.x, y: army.y };
      const uiPath = findShortestPathBFS(startPos, endPos, exploredHexes).map((pos) =>
        getUIPositionFromColRow(pos.x, pos.y),
      );
      setAnimationPath(uiPath.map((pos) => applyOffset(pos)));
      prevPositionRef.current = { x: army.x, y: army.y };
    }
  }, [army]);

  const selectedEntity = useUIStore((state) => state.selectedEntity);
  const setSelectedEntity = useUIStore((state) => state.setSelectedEntity);
  const showAllArmies = useUIStore((state) => state.showAllArmies);

  // Deterministic rotation based on the id
  const deterministicRotation = useMemo(() => {
    return (Number(army.entity_id) % 12) * (Math.PI / 6); // Convert to one of 12 directions in radians
  }, []);

  const [rotationY, setRotationY] = useState(deterministicRotation);
  const [hovered, setHovered] = useState(false);

  const [position, setPosition] = useState<Vector3>(
    new Vector3(army.uiPos.x + army.offset.x, 0.32, -army.uiPos.y - army.offset.y),
  );

  useFrame(() => {
    if (!animationPath) return;

    const now = Date.now();
    const startTime = startAnimationTimeRef.current ?? now;
    if (!startAnimationTimeRef.current) {
      startAnimationTimeRef.current = now;
    }

    const timeElapsed = now - startTime;
    const timeToComplete = animationPath.length * 1000;
    const progress = Math.min(timeElapsed / timeToComplete, 1);
    const pathIndex = Math.floor(progress * animationPath.length);
    const currentPath = animationPath.slice(pathIndex, pathIndex + 2);

    if (progress >= 1 || currentPath.length < 2) {
      setAnimationPath(null);
      startAnimationTimeRef.current = null;
      return;
    }

    const progressBetweenPoints = (progress - (1 / animationPath.length) * pathIndex) * animationPath.length;

    const startPoint = currentPath[0];
    const endPoint = currentPath[1];
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

  const onRightClick = useCallback(() => {
    if (!animationPath && (selectedEntity?.id || 0n) !== BigInt(army.entity_id) && army.isMine) {
      setSelectedEntity({ id: BigInt(army.entity_id), position: { x: army.x, y: army.y } });
    }
  }, [animationPath, army.entity_id, army.x, army.y, selectedEntity, playBuildMilitary, setSelectedEntity]);

  const onPointerEnter = useCallback((e: any) => {
    e.stopPropagation();
    setHovered(true);
  }, []);

  const onPointerOut = useCallback((e: any) => {
    e.stopPropagation();
    setHovered(false);
  }, []);

  const applyOffset = useCallback(
    (point: UIPosition) => ({
      x: point.x + army.offset.x,
      y: point.y + army.offset.y,
      z: point.z,
    }),
    [army],
  );

  const showArmyInfo = useMemo(() => {
    return showAllArmies || hovered;
  }, [showAllArmies, hovered]);

  const isSelected = useMemo(() => {
    return (selectedEntity?.id || 0n) === BigInt(army.entity_id);
  }, [selectedEntity, army.entity_id]);

  const showCombatLabel = useMemo(() => {
    return selectedEntity !== undefined && selectedEntity.id === BigInt(army.entity_id);
  }, [selectedEntity]);

  return (
    <>
      <group position={position}>
        {showArmyInfo && <ArmyInfoLabel army={army} />}
        {army.isMine && <ArmyFlag rotationY={rotationY} position={position} />}

        {showCombatLabel && <CombatLabel />}

        <WarriorModel rotationY={rotationY} />
        <mesh
          position={[0, 1.6, 0]}
          onContextMenu={onRightClick}
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
