import { ReactComponent as Inventory } from "@/assets/icons/common/bagpack.svg";
import { ReactComponent as Pen } from "@/assets/icons/common/pen.svg";
import { BattleManager } from "@/dojo/modelManager/BattleManager";
import { useDojo } from "@/hooks/context/DojoContext";
import { ArmyInfo } from "@/hooks/helpers/useArmies";
import useBlockchainStore from "@/hooks/store/useBlockchainStore";
import Button from "@/ui/elements/Button";
import { StaminaResource } from "@/ui/elements/StaminaResource";
import React, { useMemo, useState } from "react";
import { InventoryResources } from "../resources/InventoryResources";
import { ArmyManagementCard, ViewOnMapIcon } from "./ArmyManagementCard";
import { TroopMenuRow } from "./TroopChip";

export const ArmyChip = ({
  army,
  className,
  showButtons,
}: {
  army: ArmyInfo;
  className?: string;
  showButtons?: boolean;
}) => {
  const {
    setup: {
      components: { Battle },
    },
  } = useDojo();

  const [showInventory, setShowInventory] = useState(false);

  const { nextBlockTimestamp: currentTimestamp } = useBlockchainStore();

  const [editMode, setEditMode] = useState(false);

  const battleManager = useMemo(() => new BattleManager(BigInt(army.battle_id), Battle), [army.battle_id]);

  const { updatedArmy, updatedBattle } = useMemo(() => {
    const updatedBattle = battleManager.getUpdatedBattle(currentTimestamp!);
    const updatedArmy = battleManager.getUpdatedArmy(army, updatedBattle);
    return { updatedArmy, updatedBattle };
  }, [currentTimestamp]);

  return (
    <div
      className={`items-center text-xs px-2 hover:bg-blueish/20 clip-angled bg-blueish/20 rounded-md border-gold/20 ${className}`}
    >
      {editMode ? (
        <>
          <Button className="my-2" size="xs" onClick={() => setEditMode(!editMode)}>
            Close Manager
          </Button>
          <ArmyManagementCard army={updatedArmy!} owner_entity={BigInt(updatedArmy!.entityOwner.entity_owner_id)} />
        </>
      ) : (
        <>
          <div className="flex w-full h-full justify-between">
            <div className="flex w-full justify-between py-2">
              <div className="flex flex-col w-[45%]">
                <div className="h4 text-xl mb-2 flex flex-row">
                  <div className="mr-2">{updatedArmy!.name}</div>
                  {showButtons && (
                    <div className="flex flex-row gap-1 grid grid-cols-3">
                      {updatedArmy.isMine && (
                        <React.Fragment>
                          <Pen
                            className={
                              "my-auto w-5 fill-gold hover:fill-gold/50 hover:scale-125 hover:animate-pulse hover:grow duration-300 transition-all"
                            }
                            onClick={() => setEditMode(!editMode)}
                          />
                          <ViewOnMapIcon
                            className={
                              "my-auto w-5 fill-gold hover:fill-gold/50 hover:scale-125 hover:animate-pulse hover:grow duration-300 transition-all"
                            }
                            position={{ x: Number(updatedArmy!.position.x), y: Number(updatedArmy!.position.y) }}
                          />
                        </React.Fragment>
                      )}
                      <Inventory
                        className="my-auto w-4 ml-1 mx-auto hover:fill-gold/50 fill-gold hover:scale-125 hover:animate-pulse hover:grow duration-300 transition-all"
                        onClick={() => setShowInventory(!showInventory)}
                      />
                    </div>
                  )}
                </div>
                <div className="font-bold text-xs">
                  <StaminaResource entityId={BigInt(updatedArmy!.entity_id)} />
                </div>
              </div>
              <div className="flex flex-row content-center w-[55%]">
                <TroopMenuRow army={updatedArmy!} />
                {showInventory && (
                  <InventoryResources
                    entityId={BigInt(updatedArmy!.entity_id)}
                    className="flex gap-1 h-14 mt-2 overflow-x-auto no-scrollbar"
                    resourcesIconSize="xs"
                  />
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
