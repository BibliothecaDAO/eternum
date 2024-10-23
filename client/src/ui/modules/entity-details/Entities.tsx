import { ArmyInfo, useEnemyArmiesByPosition } from "@/hooks/helpers/useArmies";
import { useEntities } from "@/hooks/helpers/useEntities";
import { Position } from "@/types/Position";
import { StructureCard } from "@/ui/components/structures/worldmap/StructureCard";
import { EnemyArmies } from "./EnemyArmies";

export const Entities = ({ position, ownArmy }: { position: Position; ownArmy: ArmyInfo | undefined }) => {
  const { playerStructures } = useEntities();

  const enemyArmies = useEnemyArmiesByPosition({
    position: position.getContract(),
    playerStructures: playerStructures(),
  });

  return (
    <div className="py-2">
      <StructureCard position={position} ownArmySelected={ownArmy} />

      {enemyArmies.length > 0 && <EnemyArmies armies={enemyArmies} ownArmySelected={ownArmy} position={position} />}
    </div>
  );
};
