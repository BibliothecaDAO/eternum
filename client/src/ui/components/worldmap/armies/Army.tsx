import { ArmyInfo, getArmiesAtPosition } from "@/hooks/helpers/useArmies";
import { getBattlesByPosition } from "@/hooks/helpers/useBattles";
import { getStructureAtPosition } from "@/hooks/helpers/useStructures";
import { Billboard, Image, useTexture } from "@react-three/drei";
import React, { useMemo } from "react";
import * as THREE from "three";
import { Euler, Vector3 } from "three";
import useUIStore from "../../../../hooks/store/useUIStore";
import { WarriorModel } from "../../models/armies/WarriorModel";
import { UnitHighlight } from "../hexagon/UnitHighlight";
import { ArmyFlag } from "./ArmyFlag";
import { BattleLabel } from "./BattleLabel";
import { CombatLabel } from "./CombatLabel";
import { useArmyAnimation } from "./useArmyAnimation";
import { arePropsEqual } from "./utils";

type ArmyProps = {
  army: ArmyInfo;
};

export const Army = React.memo(({ army }: ArmyProps & JSX.IntrinsicElements["group"]) => {
  const armyLabel = useTexture("/textures/army_label.png", (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
  });

  const armyPosition = { x: army.x, y: army.y };

  // animation path for the army
  const { groupRef, isAnimating } = useArmyAnimation(armyPosition, army.offset, army.isMine);

  // Deterministic rotation based on the id
  const deterministicRotation = useMemo(() => {
    return (Number(army.entity_id) % 12) * (Math.PI / 6); // Convert to one of 12 directions in radians
  }, []);

  const initialPos = useMemo(() => {
    return new Vector3(army.uiPos.x + army.offset.x, 0.32, -army.uiPos.y - army.offset.y);
  }, []);

  return (
    <>
      <group position={initialPos} ref={groupRef} rotation={new Euler(0, deterministicRotation, 0)}>
        <ArmyFlag visible={army.isMine} rotationY={deterministicRotation} position={initialPos} />
        <WarriorModel army={army} isAnimating={isAnimating.current} />
        <Billboard>
          <Image
            texture={armyLabel}
            scale={3.5}
            position={[0, 5, 0]}
            side={THREE.DoubleSide}
            transparent
            renderOrder={2}
          />
        </Billboard>
        <ArmySelectionOverlay army={army} />
      </group>
    </>
  );
}, arePropsEqual);

export const ArmySelectionOverlay = ({ army }: ArmyProps) => {
  const armyPosition = { x: army.x, y: army.y };

  const selectedEntity = useUIStore((state) => state.selectedEntity);
  const battleAtPosition = getBattlesByPosition(armyPosition);
  const { getArmies } = getArmiesAtPosition();

  const structure = getStructureAtPosition(armyPosition);

  const isSelected = useMemo(() => {
    return (selectedEntity?.id || 0n) === BigInt(army.entity_id);
  }, [selectedEntity, army.entity_id]);

  const showCombatLabel = useMemo(() => {
    if (battleAtPosition) return false;
    const { opponentArmiesAtPosition } = getArmies(armyPosition);
    return (
      selectedEntity !== undefined &&
      selectedEntity.id === BigInt(army.entity_id) &&
      ((opponentArmiesAtPosition?.length || 0) > 0 || Boolean(structure))
    );
  }, [selectedEntity]);

  const showBattleLabel = useMemo(() => {
    return selectedEntity !== undefined && selectedEntity.id === BigInt(army.entity_id) && Boolean(battleAtPosition);
  }, [selectedEntity, battleAtPosition]);

  return (
    <>
      {showCombatLabel && <CombatLabel visible={isSelected} />}
      {showBattleLabel && <BattleLabel selectedBattle={battleAtPosition} />}
      {isSelected && <UnitHighlight position={{ x: army.x, y: army.y }} />}
    </>
  );
};
