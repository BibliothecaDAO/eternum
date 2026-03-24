import { useUIStore } from "@/hooks/store/use-ui-store";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";

import TextInput from "@/ui/design-system/atoms/text-input";
import { LiquidityResourceRow } from "@/ui/features/economy/banking";
import { ID, ResourcesIds, resources } from "@bibliothecadao/types";
import { useState } from "react";

type LiquidityTableProps = {
  entity_id: ID;
};

export const LiquidityTableHeader = () => (
  <div className="grid grid-cols-7 gap-4 px-2 pb-2 mb-2 border-b border-gold/10">
    <div className="text-[10px] uppercase text-gold/50 font-medium">Pair</div>
    <div className="text-[10px] uppercase text-gold/50 font-medium">Price</div>
    <div className="text-[10px] uppercase text-gold/50 font-medium col-span-2">Total Liquidity</div>
    <div className="text-[10px] uppercase text-gold/50 font-medium col-span-2">My Liquidity</div>
  </div>
);

export const LiquidityTable = ({ entity_id }: LiquidityTableProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const mode = useGameModeConfig();

  const filteredResources = Object.entries(mode.resources.getTiers()).flatMap(([tier, resourceIds]) => {
    return resourceIds.filter(
      (resourceId) =>
        resourceId !== ResourcesIds.Lords &&
        resources
          .find((r) => r.id === resourceId)
          ?.trait.toLowerCase()
          .includes(searchTerm.toLowerCase()),
    );
  });

  const playerStructures = useUIStore((state) => state.playerStructures);

  const playerStructureIds = playerStructures.map((structure) => structure.structure.entity_id);

  return (
    <div className="amm-liquidity-selector h-full overflow-x-auto relative">
      <TextInput placeholder="Search resources..." onChange={setSearchTerm} className="w-full mb-4" />
      <LiquidityTableHeader />
      <div className="overflow-y-auto">
        <div className="grid gap-2 relative">
          {filteredResources.map((resourceId, index) => (
            <LiquidityResourceRow
              key={resourceId}
              playerStructureIds={playerStructureIds}
              entityId={entity_id}
              resourceId={resourceId}
              isFirst={index === 0 ? true : false}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
