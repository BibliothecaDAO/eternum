import { ReactComponent as Swords } from "@/assets/icons/common/cross-swords.svg";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { ArmyChip } from "@/ui/components/military/army-chip";
import {
  ArmyInfo,
  BattleManager,
  ContractAddress,
  getEntityInfo,
  getStructureAtPosition,
  isStructureImmune,
} from "@bibliothecadao/eternum";
import { Position, useDojo, useNextBlockTimestamp } from "@bibliothecadao/react";
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
  const currentDefaultTick = useUIStore.getState().currentDefaultTick;

  const structureAtPosition = useMemo(
    () =>
      getStructureAtPosition(
        position.getContract(),
        ContractAddress(dojo.account.account.address),
        dojo.setup.components,
      ),
    [position, dojo.account.account.address, dojo.setup.components],
  );

  const { nextBlockTimestamp } = useNextBlockTimestamp();

  const setBattleView = useUIStore((state) => state.setBattleView);
  const setTooltip = useUIStore((state) => state.setTooltip);

  const entityInfo = getEntityInfo(
    ownArmySelected?.entityOwner.entity_owner_id ?? 0,
    ContractAddress(dojo.account.account.address),
    currentDefaultTick,
    dojo.setup.components,
  ).structure;

  const ownArmystructure = useMemo(() => {
    return ownArmySelected ? entityInfo : undefined;
  }, [ownArmySelected, entityInfo]);

  const structureImmune = useMemo(
    () => isStructureImmune(ownArmystructure, nextBlockTimestamp!),
    [ownArmystructure, nextBlockTimestamp],
  );

  const ownArmyIsImmune = useMemo(() => {
    return ownArmystructure ? structureImmune : false;
  }, [ownArmystructure, structureImmune]);

  const getArmyChip = useCallback(
    (army: ArmyInfo, index: number) => {
      const structure = getEntityInfo(
        army.entityOwner.entity_owner_id,
        ContractAddress(dojo.account.account.address),
        currentDefaultTick,
        dojo.setup.components,
      ).structure;
      const isImmune = isStructureImmune(structure, nextBlockTimestamp!) || ownArmyIsImmune;

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
      const battleManager = new BattleManager(dojo.setup.components, dojo.network.provider, army.battle_id);
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
