import { ArmyInfo } from "@/hooks/helpers/useArmies";
import { Position } from "@bibliothecadao/eternum";
import { Billboard, Image, useTexture } from "@react-three/drei";
import React, { useMemo } from "react";
import * as THREE from "three";
import { Euler, Vector3 } from "three";
import useUIStore from "../../../../hooks/store/useUIStore";
import { WarriorModel } from "../../models/armies/WarriorModel";
import { UnitHighlight } from "../hexagon/UnitHighlight";
import { ArmyFlag } from "./ArmyFlag";
import { useArmyAnimation } from "./useArmyAnimation";
import { arePropsEqual } from "./utils";

export type ArmyProps = {
  army: ArmyInfo;
};

export const Army = React.memo(({ army }: ArmyProps & JSX.IntrinsicElements["group"]) => {
  const armyLabel = useTexture("/textures/army_label.png", (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
  });

  // animation path for the army
  const { groupRef, isAnimating } = useArmyAnimation(
    { x: army.position.x, y: army.position.y },
    army.offset,
    army.isMine,
  );

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
            scale={2.2}
            position={[0, 5, 5]}
            side={THREE.DoubleSide}
            transparent
            renderOrder={5}
            color={army.isMine ? [0, 1.5, 0] : undefined}
          />
        </Billboard>
        <ArmySelectionOverlay army={army} />
      </group>
    </>
  );
}, arePropsEqual);

export const ArmySelectionOverlay = ({ army }: ArmyProps) => {
  const selectedEntity = useUIStore((state) => state.selectedEntity);

  const armyPosition: Position = { x: army.position.x, y: army.position.y };

  const isSelected = useMemo(() => {
    return (selectedEntity?.id || 0n) === BigInt(army.entity_id);
  }, [selectedEntity, army.entity_id]);

  return isSelected && <UnitHighlight position={armyPosition} />;
};
