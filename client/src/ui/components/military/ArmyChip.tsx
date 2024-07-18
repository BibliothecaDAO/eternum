import { ReactComponent as Pen } from "@/assets/icons/common/pen.svg";
import { BattleManager } from "@/dojo/modelManager/BattleManager";
import { useDojo } from "@/hooks/context/DojoContext";
import { ArmyInfo } from "@/hooks/helpers/useArmies";
import useBlockchainStore from "@/hooks/store/useBlockchainStore";
import Button from "@/ui/elements/Button";
import { StaminaResource } from "@/ui/elements/StaminaResource";
import { useMemo, useState } from "react";
import { InventoryResources } from "../resources/InventoryResources";
import { ArmyManagementCard, ViewOnMapIcon } from "./ArmyManagementCard";
import { TroopMenuRow } from "./TroopChip";

export const ArmyChip = ({ army, extraButton }: { army: ArmyInfo; extraButton?: JSX.Element }) => {
  const {
    setup: {
      components: { Battle },
    },
  } = useDojo();
  const { nextBlockTimestamp: currentTimestamp } = useBlockchainStore();

  const [editMode, setEditMode] = useState(false);

  const battleManager = useMemo(() => new BattleManager(BigInt(army.battle_id), Battle), [army.battle_id]);

  const { updatedArmy, updatedBattle } = useMemo(() => {
    const updatedBattle = battleManager.getUpdatedBattle(currentTimestamp!);
    const updatedArmy = battleManager.getUpdatedArmy(army, updatedBattle);
    return { updatedArmy, updatedBattle };
  }, [currentTimestamp]);

  return (
    <div className=" items-center text-xs px-2 hover:bg-blueish/20 clip-angled bg-blueish/20 rounded-md border-gold/20  ">
      {editMode ? (
        <>
          <Button className="my-2" size="xs" onClick={() => setEditMode(!editMode)}>
            Close Manager
          </Button>
          <ArmyManagementCard army={updatedArmy!} owner_entity={BigInt(updatedArmy!.entityOwner.entity_owner_id)} />
        </>
      ) : (
        <>
          <div className="text-xl w-full h-full content-center">
            <div className="flex justify-between py-2">
              <div className="flex flex-col w-[45%]">
                <div className="h4 text-2xl mb-2 flex flex-row">
                  <div className="mr-2">{updatedArmy!.name}</div>
                  <div className="flex flex-row gap-1">
                    <Pen className={"w-5 fill-gold"} onClick={() => setEditMode(!editMode)} />
                    <ViewOnMapIcon
                      className={"w-5 fill-gold"}
                      position={{ x: Number(updatedArmy!.position.x), y: Number(updatedArmy!.position.y) }}
                    />
                  </div>
                </div>
                <div className="font-bold text-xs">
                  <StaminaResource entityId={BigInt(updatedArmy!.entity_id)} />
                </div>
              </div>
              <div className="flex flex-row content-center w-[55%]">
                <div className={`flex flex-col content-center ${extraButton ? "" : "w-full"}`}>
                  <TroopMenuRow army={updatedArmy!} />
                  <InventoryResources
                    entityId={BigInt(updatedArmy!.entity_id)}
                    className="flex gap-1 h-14 mt-2 overflow-x-auto no-scrollbar"
                    resourcesIconSize="xs"
                  />
                </div>
                {extraButton || ""}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
