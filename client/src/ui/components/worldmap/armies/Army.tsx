import React from "react";
import { ArmyInfo } from "@/hooks/helpers/useArmies";
import useRealmStore from "@/hooks/store/useRealmStore";
import { getRealmOrderNameById } from "@/ui/utils/realms";
import { Box } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Euler, Group, Vector3 } from "three";
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

export const Army = React.memo(({ army }: ArmyProps & JSX.IntrinsicElements["group"]) => {
  const { play: playBuildMilitary } = useUiSounds(soundSelector.hoverClick);
  const exploredHexes = useExploredHexesStore((state) => state.exploredHexes);

  const [animationPath, setAnimationPath] = useState<UIPosition[] | null>(null);
  const [hovered, setHovered] = useState(false);

  const prevPositionRef = useRef<Position | null>(null);
  const groupRef = useRef<Group>(null);
  const currentIndex = useRef(1);

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
  }, [army.x, army.y]);

  const selectedEntity = useUIStore((state) => state.selectedEntity);
  const setSelectedEntity = useUIStore((state) => state.setSelectedEntity);
  const showAllArmies = useUIStore((state) => state.showAllArmies);

  // Deterministic rotation based on the id
  const deterministicRotation = useMemo(() => {
    return (Number(army.entity_id) % 12) * (Math.PI / 6); // Convert to one of 12 directions in radians
  }, []);

  const initialPos = useMemo(() => {
    return new Vector3(army.uiPos.x + army.offset.x, 0.32, -army.uiPos.y - army.offset.y);
  }, []);

  const vec = new Vector3();

  useFrame(() => {
    if (!animationPath || !groupRef.current) return;
    const pos = animationPath[currentIndex.current];
    vec.set(pos.x, 0.32, -pos.y);
    groupRef.current.position.lerp(vec, 0.2);

    if (vec.distanceTo(groupRef.current.position) < 0.1) {
      currentIndex.current++;
    }

    if (currentIndex.current >= animationPath.length) {
      setAnimationPath(null);
      currentIndex.current = 1;
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
      <group position={initialPos} ref={groupRef} rotation={new Euler(0, deterministicRotation, 0)}>
        {showArmyInfo && <ArmyInfoLabel army={army} />}
        {army.isMine && <ArmyFlag rotationY={deterministicRotation} position={initialPos} />}
        {showCombatLabel && <CombatLabel />}
        <WarriorModel />
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
}, arePropsEqual);

// Comparison function to determine if props are equal
function arePropsEqual(
  prevProps: ArmyProps & JSX.IntrinsicElements["group"],
  nextProps: ArmyProps & JSX.IntrinsicElements["group"],
) {
  return prevProps.army.x === nextProps.army.x && prevProps.army.y === nextProps.army.y;
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
      <BannerFlag order={realmOrder} position={[position.x, position.y, position.z + 10]}></BannerFlag>
    </group>
  );
};
