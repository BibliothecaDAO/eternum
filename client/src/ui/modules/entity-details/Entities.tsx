import { useDojo } from "@/hooks/context/DojoContext";
import { ArmyInfo, useEnemyArmiesByPosition } from "@/hooks/helpers/useArmies";
import { getPlayerStructures } from "@/hooks/helpers/useEntities";
import { Position } from "@/types/Position";
import { StructureCard } from "@/ui/components/hyperstructures/StructureCard";
import { ContractAddress } from "@bibliothecadao/eternum";
import { EnemyArmies } from "./EnemyArmies";

export const Entities = ({ position, ownArmy }: { position: Position; ownArmy: ArmyInfo | undefined }) => {
  const dojo = useDojo();
  const getStructures = getPlayerStructures();

  const enemyArmies = useEnemyArmiesByPosition({
    position: position.getContract(),
    playerStructures: getStructures(ContractAddress(dojo.account.account.address)),
  });

  return (
    <div className="py-2">
      <StructureCard position={position} ownArmySelected={ownArmy} />

      {enemyArmies.length > 0 && <EnemyArmies armies={enemyArmies} ownArmySelected={ownArmy} position={position} />}
    </div>
  );
};
