import { ArmyInfo, useEnemyArmiesByPosition } from "@/hooks/helpers/useArmies";
import { StructureCard } from "@/ui/components/hyperstructures/StructureCard";
import { Position } from "@bibliothecadao/eternum";
import React from "react";
import { EnemyArmies } from "./EnemyArmies";

export const Entities = ({ position, ownArmy }: { position: Position; ownArmy: ArmyInfo | undefined }) => {
  const enemyArmies = useEnemyArmiesByPosition({
    position: { x: position.x, y: position.y },
  });

  return (
    <React.Fragment>
      <StructureCard position={position} ownArmySelected={ownArmy} />
      <EnemyArmies armies={enemyArmies} ownArmySelected={ownArmy} position={position} />
    </React.Fragment>
  );
};
