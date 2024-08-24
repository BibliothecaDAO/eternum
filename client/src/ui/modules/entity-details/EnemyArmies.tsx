import { ReactComponent as Swords } from "@/assets/icons/common/cross-swords.svg";
import { BattleManager } from "@/dojo/modelManager/BattleManager";
import { useDojo } from "@/hooks/context/DojoContext";
import { ArmyInfo } from "@/hooks/helpers/useArmies";
import { getStructureAtPosition } from "@/hooks/helpers/useStructures";
import useUIStore from "@/hooks/store/useUIStore";
import { Position } from "@/types/Position";
import { ArmyChip } from "@/ui/components/military/ArmyChip";
import React, { useCallback, useMemo } from "react";

export const EnemyArmies = ({
  armies,
  ownArmySelected,
  position,
}: {
  armies: ArmyInfo[];
  ownArmySelected: ArmyInfo | undefined;
  position: Position;
}) => {
  const dojo = useDojo();

  const nextBlockTimestamp = useUIStore((state) => state.nextBlockTimestamp);

  const setBattleView = useUIStore((state) => state.setBattleView);

  const structureAtPosition = getStructureAtPosition(position.getContract());

  const getArmyChip = useCallback(
    (army: ArmyInfo, index: number) => {
      const button = ownArmySelected && (
        <Swords
          className={`fill-gold h-6 w-6 my-auto animate-slow transition-all hover:fill-gold/50 hover:scale-125`}
          onClick={() =>
            setBattleView({
              engage: true,
              battleEntityId: undefined,
              ownArmyEntityId: ownArmySelected.entity_id,
              targetArmy: army.entity_id,
            })
          }
        />
      );
      const armyClone = army.protectee ? structuredClone(army) : army;
      armyClone.name = army.protectee ? `${structureAtPosition?.name}` : army.name;
      const battleManager = new BattleManager(army.battle_id, dojo);
      if (
        battleManager.isBattleOngoing(nextBlockTimestamp!) ||
        battleManager.getUpdatedArmy(army, battleManager.getUpdatedBattle(nextBlockTimestamp!))!.health.current <= 0
      ) {
        return;
      }
      return (
        <div className="flex justify-between" key={index}>
          <ArmyChip className="text-xs w-[27rem] bg-red/20" key={index} army={armyClone} showButtons />
          {button}
        </div>
      );
    },
    [nextBlockTimestamp, ownArmySelected, ownArmySelected?.entity_id, position],
  );

  const armiesToDisplay = useMemo(() => {
    return armies.map((army: ArmyInfo, index) => getArmyChip(army, index)).filter(Boolean);
  }, [nextBlockTimestamp, getArmyChip]);

  return (
    <div className="flex flex-col mt-2 w-[31rem]">
      {armies.length !== 0 && (
        <React.Fragment>
          <div className="grid grid-cols-1 gap-2 p-2">
            {armiesToDisplay.length > 0 && <>Enemy armies {armiesToDisplay}</>}
          </div>
        </React.Fragment>
      )}
    </div>
  );
};
