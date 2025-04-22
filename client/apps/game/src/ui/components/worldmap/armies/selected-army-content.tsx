import { ArmyInfo } from "@bibliothecadao/types";
import { ArmyChip } from "../../military/army-chip";
import { InventoryResources } from "../../resources/inventory-resources";
import { ArmyWarning } from "./army-warning";

export const SelectedArmyContent = ({ playerArmy }: { playerArmy: ArmyInfo }) => {
  return (
    <div
      className={`
        fixed left-1/2 transform -translate-x-1/2
        bg-black/80 p-2 rounded-lg panel-wood
        transition-all duration-200 ease-in-out
        origin-bottom scale-75 md:scale-100
        bottom-0 opacity-100
      `}
    >
      <div className="flex flex-col w-[27rem]">
        <ArmyWarning army={playerArmy} />
        <ArmyChip className="bg-black/90" army={playerArmy} showButtons={false} />
        <InventoryResources
          entityId={playerArmy.entityId}
          className="flex gap-1 mt-2 overflow-x-auto no-scrollbar"
          resourcesIconSize="xs"
        />
      </div>
    </div>
  );
};
