import { useFactView } from "@/hooks/use-fact-view";
import { playerStructuresView } from "@/sync/fact-views";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";

import { HudField, HudTableHead } from "@/ui/design-system/kit/hud-elements";
import { LiquidityResourceRow } from "./liquidity-resource-row";
import { ID, ResourcesIds, resourceName } from "@bibliothecadao/types";
import { useState } from "react";

type LiquidityTableProps = {
  entity_id: ID;
};

/** The pools' columns: the pair, its price, all the liquidity, yours, and the way out. */
export const LIQUIDITY_COLS = "5rem 1fr 2fr 2fr auto";

export const LiquidityTableHeader = () => (
  <HudTableHead cols={LIQUIDITY_COLS}>
    <span>Pair</span>
    <span>Price</span>
    <span>Total Liquidity</span>
    <span>My Liquidity</span>
    <span />
  </HudTableHead>
);

export const LiquidityTable = ({ entity_id }: LiquidityTableProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const mode = useGameModeConfig();

  const filteredResources = Object.values(mode.resources.getTiers()).flatMap((resourceIds) => {
    return resourceIds.filter(
      (resourceId) =>
        resourceId !== ResourcesIds.Lords && resourceName(resourceId).toLowerCase().includes(searchTerm.toLowerCase()),
    );
  });

  const playerStructures = useFactView(playerStructuresView);

  const playerStructureIds = playerStructures.map((structure) => structure.entityId);

  return (
    <div className="flex h-full flex-col gap-2 overflow-x-auto">
      <HudField
        value={searchTerm}
        icon="search"
        placeholder="Search resources..."
        aria-label="Search pools"
        onChange={setSearchTerm}
      />
      <div role="table" aria-label="Pools" className="flex flex-col gap-1">
        <LiquidityTableHeader />
        {filteredResources.map((resourceId) => (
          <LiquidityResourceRow
            key={resourceId}
            playerStructureIds={playerStructureIds}
            entityId={entity_id}
            resourceId={resourceId}
          />
        ))}
      </div>
    </div>
  );
};
