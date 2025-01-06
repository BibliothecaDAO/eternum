import { BattleInfo } from "@/hooks/helpers/battles/useBattles";
import { ArmyInfo, useEnemyArmiesByPosition } from "@/hooks/helpers/useArmies";
import { useEntities } from "@/hooks/helpers/useEntities";
import { Position } from "@/types/Position";
import { StructureCard } from "@/ui/components/structures/worldmap/StructureCard";
import { Checkbox } from "@/ui/elements/Checkbox";
import { useState } from "react";
import { Battles } from "./Battles";
import { EnemyArmies } from "./EnemyArmies";

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
