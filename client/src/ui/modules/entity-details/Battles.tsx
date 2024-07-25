import { ArmyInfo } from "@/hooks/helpers/useArmies";
import { BattleCard } from "@/ui/components/battles/BattleCard";
import { Position } from "@bibliothecadao/eternum";
import React, { useMemo, useState } from "react";
import { SelectActiveArmy } from "./EntityDetails";
import useUIStore from "@/hooks/store/useUIStore";

export const Battles = ({ position, ownArmiesAtPosition }: { position: Position; ownArmiesAtPosition: ArmyInfo[] }) => {
  const clickedHex = useUIStore((state) => state.clickedHex);

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
      <BattleCard position={position} ownArmySelected={ownArmy} />
    </React.Fragment>
  );
};
