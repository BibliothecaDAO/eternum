import { ArmyInfo } from "@/hooks/helpers/useArmies";
import useUIStore from "@/hooks/store/useUIStore";
import { soundSelector, useSelectedArmySound, useUiSounds } from "@/hooks/useUISound";
import { Box } from "@react-three/drei";
import { useCallback, useEffect } from "react";
import { ArmyInfoLabel } from "./ArmyInfoLabel";

type ArmyHitBoxProps = {
  army: ArmyInfo;
  hovered: boolean;
  isAnimating: boolean;
  setHovered: (hovered: boolean) => void;
};

export const ArmyHitBox = ({ army, hovered, isAnimating, setHovered }: ArmyHitBoxProps) => {
  const selectedEntity = useUIStore((state) => state.selectedEntity);
  const setSelectedEntity = useUIStore((state) => state.setSelectedEntity);
  const { play: playSelectedArmy } = useSelectedArmySound();
  const { play: playClick } = useUiSounds(soundSelector.click);
  const { play: playHover } = useUiSounds(soundSelector.hoverClick);

  useEffect(() => {
    if (hovered && !isAnimating) playHover();
  }, [hovered, isAnimating, playHover]);

  const onRightClick = useCallback(() => {
    playClick();
    if ((selectedEntity?.id || 0n) !== army.entity_id && army.isMine && !isAnimating) {
      setSelectedEntity({
        id: army.entity_id,
        position: { x: army.position.x, y: army.position.y },
      });
      playSelectedArmy();
    }
  }, [
    isAnimating,
    army.entity_id,
    army.position.x,
    army.position.y,
    selectedEntity,
    setSelectedEntity,
    playSelectedArmy,
    playClick,
  ]);

  const onPointerEnter = useCallback(
    (e: any) => {
      e.stopPropagation();
      if (!isAnimating) setHovered(true);
    },
    [isAnimating],
  );

  const onPointerOut = useCallback(
    (e: any) => {
      e.stopPropagation();
      if (!isAnimating) setHovered(false);
    },
    [isAnimating],
  );

  return (
    <group>
      {hovered && <ArmyInfoLabel visible={true} army={army} />}
      <Box
        visible={false}
        position={[0, 1.5, 0]}
        onPointerEnter={onPointerEnter}
        onContextMenu={onRightClick}
        onPointerOut={onPointerOut}
        args={[1.5, 4, 1.5]}
      />
    </group>
  );
};
