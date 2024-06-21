import { useDojo } from "@/hooks/context/DojoContext";
import { ArmyInfo, getUserArmiesAtPosition } from "@/hooks/helpers/useArmies";
import { getBattlesByPosition } from "@/hooks/helpers/useBattles";
import { Has, HasValue, runQuery } from "@dojoengine/recs";
import React, { useMemo } from "react";
import { Euler, Vector3 } from "three";
import useUIStore from "../../../../hooks/store/useUIStore";
import { WarriorModel } from "../../models/armies/WarriorModel";
import { UnitHighlight } from "../hexagon/UnitHighlight";
import { ArmyFlag } from "./ArmyFlag";
import { CombatLabel } from "./CombatLabel";
import { useArmyAnimation } from "./useArmyAnimation";
import { arePropsEqual } from "./utils";
import { Billboard, Image, useTexture } from "@react-three/drei";
import * as THREE from "three";

type ArmyProps = {
  army: ArmyInfo;
};

export const Army = React.memo(({ army }: ArmyProps & JSX.IntrinsicElements["group"]) => {
  const {
    setup: {
      components: { Structure, Position },
    },
  } = useDojo();

  const armyLabel = useTexture("/textures/army_label.png", (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
  });

  const armyPosition = { x: army.x, y: army.y };
  const selectedEntity = useUIStore((state) => state.selectedEntity);
  const battleAtPosition = getBattlesByPosition(armyPosition);
  const { opponentArmies } = getUserArmiesAtPosition(armyPosition);

  const structures = Array.from(runQuery([Has(Structure), HasValue(Position, armyPosition)]));

  // animation path for the army
  const groupRef = useArmyAnimation(armyPosition, army.offset, army.isMine);

  // Deterministic rotation based on the id
  const deterministicRotation = useMemo(() => {
    return (Number(army.entity_id) % 12) * (Math.PI / 6); // Convert to one of 12 directions in radians
  }, []);

  const initialPos = useMemo(() => {
    return new Vector3(army.uiPos.x + army.offset.x, 0.32, -army.uiPos.y - army.offset.y);
  }, []);

  const isSelected = useMemo(() => {
    return (selectedEntity?.id || 0n) === BigInt(army.entity_id);
  }, [selectedEntity, army.entity_id]);

  const showCombatLabel = useMemo(() => {
    if (battleAtPosition) return false;
    return (
      selectedEntity !== undefined &&
      selectedEntity.id === BigInt(army.entity_id) &&
      ((opponentArmies?.length || 0) > 0 || structures.length > 0)
    );
  }, [selectedEntity]);

  return (
    <>
      <group position={initialPos} ref={groupRef} rotation={new Euler(0, deterministicRotation, 0)}>
        <ArmyFlag visible={army.isMine} rotationY={deterministicRotation} position={initialPos} />
        {showCombatLabel && <CombatLabel visible={isSelected} />}
        <WarriorModel army={army} />
        <Billboard>
          <Image texture={armyLabel} scale={3.5} position={[0, 5, 0]} side={THREE.DoubleSide} transparent />
        </Billboard>
      </group>
      {isSelected && <UnitHighlight position={{ x: army.x, y: army.y }} />}
    </>
  );
}, arePropsEqual);
