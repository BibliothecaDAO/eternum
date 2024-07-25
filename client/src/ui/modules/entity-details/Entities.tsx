import { ArmyInfo, useEnnemyArmiesByPosition } from "@/hooks/helpers/useArmies";
import useUIStore from "@/hooks/store/useUIStore";
import { StructureCard } from "@/ui/components/hyperstructures/StructureCard";
import { Position } from "@bibliothecadao/eternum";
import React, { useMemo, useState } from "react";
import { EnemyArmies } from "./EnnemyArmies";
import { SelectActiveArmy } from "./EntityDetails";

export const Entities = ({
  position,
  ownArmiesAtPosition,
}: {
  position: Position;
  ownArmiesAtPosition: ArmyInfo[];
}) => {
  const clickedHex = useUIStore((state) => state.clickedHex);

  const ennemyArmies = useEnnemyArmiesByPosition({
    position: { x: position.x, y: position.y },
  });

  const userArmies = useMemo(
    () => ownArmiesAtPosition.filter((army) => army.health.current > 0),
    [ownArmiesAtPosition],
  );

  const [ownArmySelected, setOwnArmySelected] = useState<{ id: bigint; position: Position } | undefined>({
    id: userArmies?.[0]?.entity_id || 0n,
    position: {
      x: clickedHex?.contractPos.col || 0,
      y: clickedHex?.contractPos.row || 0,
    },
  });

  const ownArmy = useMemo(() => {
    if (!ownArmySelected) return;
    return userArmies.find((army) => army.entity_id === ownArmySelected.id);
  }, [userArmies, ownArmySelected, clickedHex?.contractPos.col, clickedHex?.contractPos.row]);

  return (
    <React.Fragment>
      <SelectActiveArmy
        selectedEntity={ownArmySelected}
        setOwnArmySelected={setOwnArmySelected}
        userAttackingArmies={userArmies}
      />
      <StructureCard position={position} ownArmySelected={ownArmy} />
      <EnemyArmies armies={ennemyArmies} ownArmySelected={ownArmy} position={position} />
    </React.Fragment>
  );
};
