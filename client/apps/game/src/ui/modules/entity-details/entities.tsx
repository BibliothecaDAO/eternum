import { StructureCard } from "@/ui/components/structures/worldmap/structure-card";
import { Checkbox } from "@/ui/elements/checkbox";
import { Battles } from "@/ui/modules/entity-details/battles";
import { EnemyArmies } from "@/ui/modules/entity-details/enemy-armies";
import { ArmyInfo } from "@bibliothecadao/eternum";
import { BattleInfo, Position, useEnemyArmiesByPosition, useEntities } from "@bibliothecadao/react";
import { useState } from "react";

export const Entities = ({
  position,
  ownArmy,
  battles,
}: {
  position: Position;
  ownArmy: ArmyInfo | undefined;
  battles: BattleInfo[];
}) => {
  const [showStructure, setShowStructure] = useState(true);
  const [showBattles, setShowBattles] = useState(true);
  const [showArmies, setShowArmies] = useState(true);
  const { playerStructures } = useEntities();

  const enemyArmies = useEnemyArmiesByPosition({
    position: position.getContract(),
    playerStructures: playerStructures(),
  });

  return (
    <div className="pb-2">
      <div className="w-full grid grid-cols-3">
        <Checkbox enabled={showStructure} onClick={() => setShowStructure((prev) => !prev)} text="Show structure" />
        <Checkbox enabled={showBattles} onClick={() => setShowBattles((prev) => !prev)} text="Show battles" />
        <Checkbox enabled={showArmies} onClick={() => setShowArmies((prev) => !prev)} text="Show armies" />
      </div>
      {showStructure && <StructureCard position={position} ownArmySelected={ownArmy} />}
      {showBattles && <Battles ownArmy={ownArmy} battles={battles} />}
      {showArmies && enemyArmies.length > 0 && (
        <EnemyArmies armies={enemyArmies} ownArmySelected={ownArmy} position={position} />
      )}
    </div>
  );
};
