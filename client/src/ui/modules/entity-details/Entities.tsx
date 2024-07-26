import { ArmyInfo, useEnemyArmiesByPosition } from "@/hooks/helpers/useArmies";
import useUIStore from "@/hooks/store/useUIStore";
import { StructureCard } from "@/ui/components/hyperstructures/StructureCard";
import { Position } from "@bibliothecadao/eternum";
import React, { useMemo, useState } from "react";
import { EnemyArmies } from "./EnemyArmies";
import { SelectActiveArmy } from "./EntityDetails";

export const Entities = ({
  position,
  ownArmiesAtPosition,
}: {
  position: Position;
  ownArmiesAtPosition: ArmyInfo[];
}) => {
  const clickedHex = useUIStore((state) => state.clickedHex);

  const enemyArmies = useEnemyArmiesByPosition({
    position: { x: position.x, y: position.y },
  });

  const [ownArmySelected, setOwnArmySelected] = useState<{ id: bigint; position: Position } | undefined>({
    id: ownArmiesAtPosition?.[0]?.entity_id || 0n,
    position: {
      x: clickedHex?.contractPos.col || 0,
      y: clickedHex?.contractPos.row || 0,
    },
  });

  const ownArmy = useMemo(() => {
    if (!ownArmySelected) return;
    return ownArmiesAtPosition.find((army) => army.entity_id === ownArmySelected.id);
  }, [ownArmiesAtPosition, ownArmySelected, clickedHex?.contractPos.col, clickedHex?.contractPos.row]);

  return (
    <React.Fragment>
      {ownArmiesAtPosition.length > 0 && (
        <SelectActiveArmy
          selectedEntity={ownArmySelected}
          setOwnArmySelected={setOwnArmySelected}
          userAttackingArmies={ownArmiesAtPosition}
        />
      )}
      <StructureCard position={position} ownArmySelected={ownArmy} />
      <EnemyArmies armies={enemyArmies} ownArmySelected={ownArmy} position={position} />
    </React.Fragment>
  );
};
