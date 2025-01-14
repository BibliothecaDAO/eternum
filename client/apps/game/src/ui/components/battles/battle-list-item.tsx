import { ReactComponent as Inventory } from "@/assets/icons/common/bagpack.svg";
import { ReactComponent as Sword } from "@/assets/icons/common/cross-swords.svg";
import { ReactComponent as Eye } from "@/assets/icons/common/eye.svg";
import { useDojo } from "@/hooks/context/dojo-context";
import { useEntitiesUtils } from "@/hooks/helpers/use-entities";
import useUIStore from "@/hooks/store/use-ui-store";
import useNextBlockTimestamp from "@/hooks/use-next-block-timestamp";
import { ViewOnMapIcon } from "@/ui/components/military/army-management-card";
import { TroopDisplay } from "@/ui/components/military/troop-chip";
import { InventoryResources } from "@/ui/components/resources/inventory-resources";
import { ArmyInfo, BattleManager, ID } from "@bibliothecadao/eternum";
import React, { useMemo, useState } from "react";

type BattleListItemProps = {
  battleEntityId: ID;
  ownArmySelected?: ArmyInfo;
  showCompass?: boolean;
};

export const BattleListItem = ({ battleEntityId, ownArmySelected, showCompass = false }: BattleListItemProps) => {
  const dojo = useDojo();

  const { getAddressNameFromEntity } = useEntitiesUtils();

  const { nextBlockTimestamp } = useNextBlockTimestamp();

  const [showInventory, setShowInventory] = useState(false);

  const setBattleView = useUIStore((state) => state.setBattleView);
  const setTooltip = useUIStore((state) => state.setTooltip);

  const battleManager = useMemo(
    () => new BattleManager(dojo.setup.components, dojo.network.provider, battleEntityId),
    [battleEntityId],
  );

  const updatedBattle = useMemo(() => {
    const updatedBattle = battleManager.getUpdatedBattle(nextBlockTimestamp!);
    return updatedBattle;
  }, [nextBlockTimestamp, battleManager]);

  const armiesInBattle = useMemo(() => {
    return battleManager.getArmiesInBattle();
  }, [battleManager]);

  const escrowIds = useMemo(() => {
    return battleManager.getEscrowIds();
  }, [battleManager]);

  const battlePosition = useMemo(() => {
    return battleManager.getPosition();
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
                {showCompass && battlePosition && <ViewOnMapIcon hideTooltip={true} position={battlePosition} />}
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
                  entityId={escrowIds.attacker}
                  className="flex gap-1 h-14 mt-2 overflow-x-auto no-scrollbar"
                  resourcesIconSize="xs"
                />
                <InventoryResources
                  entityId={escrowIds.defender}
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
