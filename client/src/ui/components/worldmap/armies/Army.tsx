import React from "react";
import { ArmyInfo } from "@/hooks/helpers/useArmies";
import { useMemo } from "react";
import { Euler, Vector3 } from "three";
import useUIStore from "../../../../hooks/store/useUIStore";
import { WarriorModel } from "../../models/armies/WarriorModel";
import { UnitHighlight } from "../hexagon/UnitHighlight";
import { CombatLabel } from "./CombatLabel";
import { arePropsEqual } from "./utils";
import { ArmyFlag } from "./ArmyFlag";
import { useArmyAnimation } from "./useArmyAnimation";

type ArmyProps = {
  army: ArmyInfo;
};

export const Army = React.memo(({ army }: ArmyProps & JSX.IntrinsicElements["group"]) => {
  const selectedEntity = useUIStore((state) => state.selectedEntity);

  // animation path for the army
  const armyPosition = { x: army.x, y: army.y };
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

  return (
    <>
      <group position={initialPos} ref={groupRef} rotation={new Euler(0, deterministicRotation, 0)}>
        <ArmyFlag visible={army.isMine} rotationY={deterministicRotation} position={initialPos} />
        {isSelected && <CombatLabel />}
        <WarriorModel army={army} />
      </group>
      {isSelected && <UnitHighlight position={{ x: army.x, y: army.y }} />}
    </>
  );
}, arePropsEqual);
