import useUIStore from "@/hooks/store/useUIStore";
import { useCallback, useMemo, useState } from "react";
import { ArmyInfoLabel } from "./ArmyInfoLabel";
import { Box } from "@react-three/drei";
import { ArmyInfo } from "@/hooks/helpers/useArmies";

export const ArmyHitBox = ({ army }: { army: ArmyInfo }) => {
  const selectedEntity = useUIStore((state) => state.selectedEntity);
  const setSelectedEntity = useUIStore((state) => state.setSelectedEntity);
  const showAllArmies = useUIStore((state) => state.showAllArmies);
  const [hovered, setHovered] = useState(false);

  const showArmyInfo = useMemo(() => {
    return showAllArmies || hovered;
  }, [showAllArmies, hovered]);

  const onRightClick = useCallback(() => {
    if ((selectedEntity?.id || 0n) !== BigInt(army.entity_id) && army.isMine) {
      setSelectedEntity({ id: BigInt(army.entity_id), position: { x: army.x, y: army.y } });
    }
  }, [army.entity_id, army.x, army.y, selectedEntity, setSelectedEntity]);

  const onPointerEnter = useCallback((e: any) => {
    e.stopPropagation();
    setHovered(true);
  }, []);

  const onPointerOut = useCallback((e: any) => {
    e.stopPropagation();
    setHovered(false);
  }, []);
  return (
    <group>
      <ArmyInfoLabel visible={showArmyInfo} army={army} />
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
  );
};
