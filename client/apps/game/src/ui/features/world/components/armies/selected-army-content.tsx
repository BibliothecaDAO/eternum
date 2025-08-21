import { ArmyChip } from "@/ui/features/military/components/army-chip";
import { getEntityIdFromKeys } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ArmyInfo } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import { ArmyWarning } from "./army-warning";

export const SelectedArmyContent = ({ playerArmy }: { playerArmy: ArmyInfo }) => {
  const {
    setup: { components },
  } = useDojo();
  const resources = useComponentValue(components.Resource, getEntityIdFromKeys([BigInt(playerArmy.explorer.owner)]));
  const explorerResources = useComponentValue(components.Resource, getEntityIdFromKeys([BigInt(playerArmy.entityId)]));

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
        {resources && explorerResources && (
          <ArmyWarning
            army={playerArmy.explorer}
            explorerResources={explorerResources}
            structureResources={resources}
          />
        )}
        <ArmyChip className="bg-black/90" army={playerArmy} showButtons={false} />
      </div>
    </div>
  );
};
