import { ReactComponent as Inventory } from "@/assets/icons/common/bagpack.svg";
import { ReactComponent as Sword } from "@/assets/icons/common/cross-swords.svg";
import { ReactComponent as Eye } from "@/assets/icons/common/eye.svg";
import { BattleManager } from "@/dojo/modelManager/BattleManager";
import { useDojo } from "@/hooks/context/DojoContext";
import { BattleInfo } from "@/hooks/helpers/battles/useBattles";
import { ArmyInfo } from "@/hooks/helpers/useArmies";
import { useEntitiesUtils } from "@/hooks/helpers/useEntities";
import useUIStore from "@/hooks/store/useUIStore";
import useNextBlockTimestamp from "@/hooks/useNextBlockTimestamp";
import { getComponentValue, HasValue, runQuery } from "@dojoengine/recs";
import React, { useMemo, useState } from "react";
import { ViewOnMapIcon } from "../military/ArmyManagementCard";
import { TroopDisplay } from "../military/TroopChip";
import { InventoryResources } from "../resources/InventoryResources";

type BattleListItemProps = {
  battle: BattleInfo;
  ownArmySelected: ArmyInfo | undefined;
  showCompass?: boolean;
};

export const BattleListItem = ({ battle, ownArmySelected, showCompass = false }: BattleListItemProps) => {
  const dojo = useDojo();

  const { getAddressNameFromEntity } = useEntitiesUtils();

  const { nextBlockTimestamp } = useNextBlockTimestamp();

  const [showInventory, setShowInventory] = useState(false);

  const setBattleView = useUIStore((state) => state.setBattleView);
  const setTooltip = useUIStore((state) => state.setTooltip);

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

    if (ownArmySelected && isBattleOngoing) {
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
          <div className={`flex flex-col w-[27rem] h-full justify-between  bg-red/20 rounded-md border-gold/20 p-2`}>
            <div className="flex w-full justify-between">
              <div className="flex flex-col w-[40%]">
                <TroopDisplay troops={updatedBattle?.attack_army?.troops} />
              </div>
              <div className="flex flex-col font-bold m-auto relative">
                {showCompass && <ViewOnMapIcon hideTooltip={true} position={battle?.position} />}
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
                <TroopDisplay troops={updatedBattle?.defence_army?.troops} />
              </div>
            </div>
            {showInventory && (
              <div>
                <InventoryResources
                  entityId={battle.attackers_resources_escrow_id}
                  className="flex gap-1 h-14 mt-2 overflow-x-auto no-scrollbar"
                  resourcesIconSize="xs"
                />
                <InventoryResources
                  entityId={battle.defenders_resources_escrow_id}
                  className="flex gap-1 h-14 mt-2 overflow-x-auto no-scrollbar"
                  resourcesIconSize="xs"
                />
              </div>
            )}
          </div>
          {buttons}
        </div>
      </React.Fragment>
    )
  );
};
