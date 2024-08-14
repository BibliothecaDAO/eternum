import { useDojo } from "@/hooks/context/DojoContext";
import { ArmyInfo, useEnemyArmiesByPosition } from "@/hooks/helpers/useArmies";
import { getPlayerStructures } from "@/hooks/helpers/useEntities";
import { StructureCard } from "@/ui/components/hyperstructures/StructureCard";
import { ContractAddress, Position } from "@bibliothecadao/eternum";
import React from "react";
import { EnemyArmies } from "./EnemyArmies";

export const Entities = ({ position, ownArmy }: { position: Position; ownArmy: ArmyInfo | undefined }) => {
  const dojo = useDojo();
  const getStructures = getPlayerStructures();

  const enemyArmies = useEnemyArmiesByPosition({
    position: { x: position.x, y: position.y },
    playerStructures: getStructures(ContractAddress(dojo.account.account.address)),
  });

  return (
    <React.Fragment>
      <StructureCard position={position} ownArmySelected={ownArmy} />
      <EnemyArmies armies={enemyArmies} ownArmySelected={ownArmy} position={position} />
    </React.Fragment>
  );
};
