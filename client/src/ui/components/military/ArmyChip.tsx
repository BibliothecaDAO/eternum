import { findResourceById } from "@bibliothecadao/eternum";
import { ResourceIcon } from "../../elements/ResourceIcon";
import { currencyFormat } from "../../utils/utils";
import { useMemo, useState } from "react";
import { ArmyAndName } from "@/hooks/helpers/useArmies";
import { InventoryResources } from "../resources/InventoryResources";
import { ArmyManagementCard, ViewOnMapButton } from "./ArmyManagementCard";
import Button from "@/ui/elements/Button";

export const ArmyChip = ({ army }: { army: ArmyAndName }) => {
  const troopCounts = useMemo(() => {
    const {
      troops: { crossbowman_count, paladin_count, knight_count },
    } = army;
    const troopCounts = { 250: crossbowman_count, 251: paladin_count, 252: knight_count };
    return (
      <div className="flex ">
        {Object.entries(troopCounts).map(([troopId, count]) => (
          <div key={troopId} className="flex items-center ">
            <ResourceIcon
              isLabor={false}
              withTooltip={false}
              resource={findResourceById(parseInt(troopId))?.trait || ""}
              size="sm"
              className="self-center"
            />
            <div className="text-xs font-bold">{currencyFormat(count, 0)}</div>
          </div>
        ))}
      </div>
    );
  }, [army]);

  const [editMode, setEditMode] = useState(false);

  return (
    <div className=" items-center text-xs p-2 hover:bg-gold/20 clip-angled-sm bg-gold/20 border-gray-300 rounded-md">
      {editMode ? (
        <>
          <Button size="xs" onClick={() => setEditMode(!editMode)}>
            Close Edit
          </Button>
          <ArmyManagementCard entity={army} owner_entity={BigInt(army.entity_owner_id)} />
        </>
      ) : (
        <>
          <div className=" text-xl w-full flex justify-between">
            <div className="font-display">{army.name}</div>

            <div className="flex items-center space-x-1 justify-end">
              <ViewOnMapButton position={{ x: army.x, y: army.y }} className="text-xxs" />
              <Button size="xs" onClick={() => setEditMode(!editMode)}>
                Buy Troops
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-3 mt-2">
            <div className="flex items-center flex-wrap">
              <span className="">HP:</span>
              <span>{Number((army.current || 0).toString()) / 1000}</span>
            </div>
            <div>{troopCounts}</div>
            <InventoryResources entityId={BigInt(army.entity_id)} max={3} className="flex h-6 text-xs" />
          </div>
        </>
      )}
    </div>
  );
};
