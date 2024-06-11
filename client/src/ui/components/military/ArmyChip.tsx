import { ArmyInfo } from "@/hooks/helpers/useArmies";
import Button from "@/ui/elements/Button";
import { useState } from "react";
import { InventoryResources } from "../resources/InventoryResources";
import { ArmyManagementCard, ViewOnMapButton } from "./ArmyManagementCard";
import { TroopMenuRow } from "./TroopChip";

export const ArmyChip = ({ army, extraButton }: { army: ArmyInfo; extraButton?: JSX.Element }) => {
  const [editMode, setEditMode] = useState(false);

  return (
    <div className=" items-center text-xs p-4 hover:bg-gold/20 clip-angled-sm bg-brown/70 border-gray-300 rounded-md ornate-borders-sm ">
      {editMode ? (
        <>
          <Button size="xs" onClick={() => setEditMode(!editMode)}>
            Close Edit
          </Button>
          <ArmyManagementCard entity={army} owner_entity={BigInt(army.entity_owner_id)} />
        </>
      ) : (
        <>
          <div className=" text-xl w-full  justify-between">
            <div className="flex justify-between mb-4">
              <div className="flex justify-between">
                <div className="h5">{army.name}</div>
                {/* <StaminaResource entityId={BigInt(army.entity_id)} /> */}
              </div>
              <div className="flex  justify-end">
                <ViewOnMapButton position={{ x: army.x, y: army.y }} />
                <Button size="xs" onClick={() => setEditMode(!editMode)}>
                  edit
                </Button>
              </div>
            </div>
          </div>
          <div className="my-1">
            <TroopMenuRow army={army} />
          </div>

          <div className="flex flex-col gap-4 mt-2 items-center justify-between">
            <InventoryResources entityId={BigInt(army.entity_id)} max={3} className="flex text-xs" />
          </div>
          {extraButton || ""}
        </>
      )}
    </div>
  );
};
