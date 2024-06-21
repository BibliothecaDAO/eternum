import { ArmyInfo } from "@/hooks/helpers/useArmies";
import Button from "@/ui/elements/Button";
import { StaminaResource } from "@/ui/elements/StaminaResource";
import { useState } from "react";
import { InventoryResources } from "../resources/InventoryResources";
import { ArmyManagementCard, ViewOnMapButton } from "./ArmyManagementCard";
import { TroopMenuRow } from "./TroopChip";

export const ArmyChip = ({ army, extraButton }: { army: ArmyInfo; extraButton?: JSX.Element }) => {
  const [editMode, setEditMode] = useState(false);

  return (
    <div className=" items-center text-xs px-2 hover:bg-blueish/20 clip-angled bg-blueish/20 rounded-md border-gold/20  ">
      {editMode ? (
        <>
          <Button className="mb-2" size="xs" onClick={() => setEditMode(!editMode)}>
            Close Manager
          </Button>
          <ArmyManagementCard entity={army} owner_entity={BigInt(army.entity_owner_id)} />
        </>
      ) : (
        <>
          <div className=" text-xl w-full  justify-between">
            <div className="flex justify-between my-4">
              <div className="flex flex-col justify-between ">
                <div className="h4 text-2xl mb-2">{army.name}</div>
                <div className="font-bold text-xs">
                  {army.current && (
                    <div className="text-green">
                      HP: {(BigInt(army.current.toString()) / BigInt(1000000n)).toLocaleString()} /{" "}
                      {(BigInt(army.lifetime.toString()) / BigInt(1000000n)).toLocaleString()}
                    </div>
                  )}
                  <StaminaResource entityId={BigInt(army.entity_id)} />
                </div>
              </div>
              <div className="flex flex-col   gap-1">
                <ViewOnMapButton position={{ x: army.x, y: army.y }} />
                <Button size="xs" onClick={() => setEditMode(!editMode)}>
                  Manage
                </Button>
              </div>
            </div>
          </div>
          <div className="my-3 flex gap-3">
            <TroopMenuRow army={army} />
            <div className="flex flex-col  items-center justify-between">
              <InventoryResources entityId={BigInt(army.entity_id)} max={3} className="flex gap-1" />
            </div>
          </div>

          {extraButton || ""}
        </>
      )}
    </div>
  );
};
