import { ReactComponent as Swords } from "@/assets/icons/common/cross-swords.svg";
import { BattleManager } from "@/dojo/modelManager/BattleManager";
import { useDojo } from "@/hooks/context/DojoContext";
import { ArmyInfo } from "@/hooks/helpers/useArmies";
import { useEntitiesUtils } from "@/hooks/helpers/useEntities";
import { useIsStructureImmune, useStructureAtPosition } from "@/hooks/helpers/useStructures";
import useUIStore from "@/hooks/store/useUIStore";
import useNextBlockTimestamp from "@/hooks/useNextBlockTimestamp";
import { Position } from "@/types/Position";
import { ArmyChip } from "@/ui/components/military/ArmyChip";
import clsx from "clsx";
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
  const { getEntityInfo } = useEntitiesUtils();
  const structureAtPosition = useStructureAtPosition(position.getContract());

  const { nextBlockTimestamp } = useNextBlockTimestamp();

  const setBattleView = useUIStore((state) => state.setBattleView);
  const setTooltip = useUIStore((state) => state.setTooltip);

  const entityInfo = getEntityInfo(ownArmySelected?.entityOwner.entity_owner_id ?? 0).structure;

  const ownArmystructure = useMemo(() => {
    return ownArmySelected ? entityInfo : undefined;
  }, [ownArmySelected, entityInfo]);

  const structureImmune = useIsStructureImmune(ownArmystructure, nextBlockTimestamp!);

  const ownArmyIsImmune = useMemo(() => {
    return ownArmystructure ? structureImmune : false;
  }, [ownArmystructure, structureImmune]);

  const getArmyChip = useCallback(
    (army: ArmyInfo, index: number) => {
      const structure = getEntityInfo(army.entityOwner.entity_owner_id).structure;
      const isImmune = useIsStructureImmune(structure, nextBlockTimestamp!) || ownArmyIsImmune;

      const button = ownArmySelected && (
        <Swords
          className={clsx(`fill-gold h-6 w-6 my-auto animate-slow transition-all hover:fill-gold/50 hover:scale-125`, {
            "opacity-50": isImmune,
          })}
          onClick={() => {
            if (!isImmune) {
              setBattleView({
                engage: true,
                battleEntityId: undefined,
                ownArmyEntityId: ownArmySelected.entity_id,
                targetArmy: army.entity_id,
              });
            }
          }}
          onMouseEnter={() => {
            if (isImmune) {
              setTooltip({
                content: `Can't attack while immune.`,
                position: "top",
              });
            }
          }}
          onMouseLeave={() => setTooltip(null)}
        />
      );
      const armyClone = army.protectee ? structuredClone(army) : army;
      armyClone.name = army.protectee ? `${structureAtPosition?.name}` : army.name;
      const battleManager = new BattleManager(army.battle_id, dojo);
      if (
        battleManager.isBattleOngoing(nextBlockTimestamp!) ||
        battleManager.getUpdatedArmy(army, battleManager.getUpdatedBattle(nextBlockTimestamp!))!.health.current <= 0
      ) {
        return null; // Changed to return null instead of undefined
      }
      return (
        <div className="flex justify-between" key={index}>
          <ArmyChip className="text-xs w-[27rem] bg-red/20" key={index} army={armyClone} showButtons />
          {button}
        </div>
      );
    },
    [
      nextBlockTimestamp,
      ownArmySelected,
      ownArmySelected?.entity_id,
      position,
      getEntityInfo,
      useIsStructureImmune,
      setBattleView,
      setTooltip,
      structureAtPosition,
      ownArmyIsImmune,
      dojo,
    ],
  );

  return (
    <div className="flex flex-col mt-2 w-[31rem]">
      {armies.length !== 0 && (
        <>
          <h5 className="pl-2 ">Enemy armies</h5>
          <React.Fragment>
            <div className="grid grid-cols-1 gap-2 p-2">
              {armies.length > 0 && armies.map((army: ArmyInfo, index) => getArmyChip(army, index)).filter(Boolean)}
            </div>
          </React.Fragment>
        </>
      )}
    </div>
  );
};
