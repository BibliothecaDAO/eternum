import { ReactComponent as Inventory } from "@/assets/icons/common/bagpack.svg";
import { ReactComponent as Sword } from "@/assets/icons/common/cross-swords.svg";
import { ReactComponent as Eye } from "@/assets/icons/common/eye.svg";
import { BattleManager } from "@/dojo/modelManager/BattleManager";
import { useDojo } from "@/hooks/context/DojoContext";
import { BattleInfo } from "@/hooks/helpers/battles/useBattles";
import { ArmyInfo, getUserArmyInBattle } from "@/hooks/helpers/useArmies";
import { getEntitiesUtils } from "@/hooks/helpers/useEntities";
import useUIStore from "@/hooks/store/useUIStore";
import { getComponentValue, HasValue, runQuery } from "@dojoengine/recs";
import React, { useMemo, useState } from "react";
import { StructureMergeTroopsPanel } from "../hyperstructures/StructureCard";
import { TroopMenuRow } from "../military/TroopChip";
import { InventoryResources } from "../resources/InventoryResources";

type BattleListItemProps = {
  battle: BattleInfo;
  ownArmySelected: ArmyInfo | undefined;
};

export const BattleListItem = ({ battle, ownArmySelected }: BattleListItemProps) => {
  const dojo = useDojo();

  const [showMergeTroopsPopup, setShowMergeTroopsPopup] = useState(false);
  const { getAddressNameFromEntity } = getEntitiesUtils();

  const nextBlockTimestamp = useUIStore((state) => state.nextBlockTimestamp);

  const [showInventory, setShowInventory] = useState(false);

  const setBattleView = useUIStore((state) => state.setBattleView);
  const setTooltip = useUIStore((state) => state.setTooltip);

  const userArmyInBattle = getUserArmyInBattle(battle.entity_id);

  const battleManager = useMemo(() => new BattleManager(battle.entity_id, dojo), [battle]);

  const updatedBattle = useMemo(() => {
    const updatedBattle = battleManager.getUpdatedBattle(nextBlockTimestamp!);
    return updatedBattle;
  }, [nextBlockTimestamp]);

  const armiesInBattle = useMemo(() => {
    const armiesEntityIds = runQuery([
      HasValue(dojo.setup.components.Army, { battle_id: battleManager.battleEntityId }),
    ]);
    return Array.from(armiesEntityIds).map(
      (entityId) => getComponentValue(dojo.setup.components.Army, entityId)!.entity_id,
    );
  }, [battleManager]);

  const buttons = useMemo(() => {
    if (!nextBlockTimestamp) return [];
    const isBattleOngoing = battleManager.isBattleOngoing(nextBlockTimestamp);
    const eyeButton = (
      <Eye
        key="eye-0"
        className="fill-gold h-6 w-6 my-auto animate-slow transition-all hover:fill-gold/50 hover:scale-125"
        onClick={() =>
          setBattleView({
            battleEntityId: updatedBattle!.entity_id,
            targetArmy: undefined,
            ownArmyEntityId: undefined,
          })
        }
      />
    );

    const swordButton = (
      <Sword
        key="sword-2"
        className="fill-gold h-6 w-6 my-auto animate-slow transition-all hover:fill-gold/50 hover:scale-125"
        onClick={() =>
          setBattleView({
            battleEntityId: updatedBattle!.entity_id,
            targetArmy: undefined,
            ownArmyEntityId: ownArmySelected!.entity_id,
          })
        }
      />
    );

    if (userArmyInBattle) {
      if (isBattleOngoing && ownArmySelected) {
        // check battle and join
        return [swordButton];
      } else {
        // check battle to claim or leave (if battle is finished) or just check
        return [eyeButton];
      }
    } else if (ownArmySelected && isBattleOngoing) {
      // join battle
      return [swordButton];
    } else {
      // just check
      return [eyeButton];
    }
  }, [nextBlockTimestamp, battleManager, ownArmySelected]);

  return (
    !battleManager.isEmpty() && (
      <React.Fragment>
        <div className="flex flex-row justify-between mt-2">
          <div
            className={`flex flex-col w-[27rem] h-full justify-between  bg-red/20 ${
              userArmyInBattle ? "animate-pulse" : ""
            } rounded-md border-gold/20 p-2`}
          >
            <div className="flex w-full justify-between">
              <div className="flex flex-col w-[40%]">
                <TroopMenuRow troops={updatedBattle?.attack_army?.troops} />
              </div>
              <div className="flex flex-col font-bold m-auto relative top-2">
                <div
                  className="font-bold m-auto animate-pulse"
                  onMouseEnter={() =>
                    setTooltip({
                      content: armiesInBattle.map((armyEntityId) => {
                        const name = getAddressNameFromEntity(armyEntityId);
                        return <div key={armyEntityId}>{name ? name : "Bandit"}</div>;
                      }),
                      position: "top",
                    })
                  }
                  onMouseLeave={() => setTooltip(null)}
                >
                  VS
                </div>
                <Inventory
                  className="my-auto w-3 mx-auto hover:fill-gold/50 fill-gold hover:scale-125 hover:animate-pulse duration-300 transition-all"
                  onClick={() => setShowInventory(!showInventory)}
                />
              </div>
              <div className="flex flex-col content-center w-[40%]">
                <TroopMenuRow troops={updatedBattle?.defence_army?.troops} />
              </div>
            </div>
            {showInventory && (
              <InventoryResources
                entityIds={[battle.attackers_resources_escrow_id, battle.defenders_resources_escrow_id]}
                className="flex gap-1 h-14 mt-2 overflow-x-auto no-scrollbar"
                resourcesIconSize="xs"
              />
            )}{" "}
          </div>
          {buttons}
        </div>
        {showMergeTroopsPopup && (
          <div className="flex flex-col w-[100%]">
            {ownArmySelected && (
              <StructureMergeTroopsPanel
                giverArmy={ownArmySelected}
                takerArmy={userArmyInBattle}
                setShowMergeTroopsPopup={setShowMergeTroopsPopup}
              />
            )}
          </div>
        )}
      </React.Fragment>
    )
  );
};
