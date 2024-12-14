import { useEntities } from "@/hooks/helpers/useEntities";
import { ID, RESOURCE_TIERS, ResourcesIds, resources } from "@bibliothecadao/eternum";
import { useState } from "react";
import { LiquidityResourceRow } from "./LiquidityResourceRow";

type LiquidityTableProps = {
  bankEntityId: ID | undefined;
  entity_id: ID;
};

export const LiquidityTableHeader = () => (
  <div className="grid grid-cols-7 gap-4 mb-4 px-2 border-b">
    <div className="uppercase">Pair</div>
    <div className="uppercase">
      <p>Price</p>
    </div>
    <div className="uppercase col-span-2">Total Liquidity</div>
    <div className="uppercase col-span-2">My Liquidity</div>
  </div>
);

export const LiquidityTable = ({ bankEntityId, entity_id }: LiquidityTableProps) => {
  const [searchTerm, setSearchTerm] = useState("");

  if (!bankEntityId) {
    return <div>Entity not found</div>;
  }

  const filteredResources = Object.entries(RESOURCE_TIERS).flatMap(([tier, resourceIds]) => {
    return resourceIds.filter(
      (resourceId) =>
        resourceId !== ResourcesIds.Lords &&
        resources
          .find((r) => r.id === resourceId)
          ?.trait.toLowerCase()
          .includes(searchTerm.toLowerCase()),
    );
  });

  const { playerStructures } = useEntities();

  const playerStructureIds = playerStructures().map((structure) => structure.entity_id);

  return (
    <div className="amm-liquidity-selector p-4 h-full bg-gold/10 overflow-x-auto relative">
      <input
        type="text"
        placeholder="Search resources..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full p-2 mb-6 bg-gold/20 focus:outline-none text-gold placeholder-gold/50 border border-gold/30 rounded"
      />
      <LiquidityTableHeader />
      <div className="overflow-y-auto">
        <div className="grid gap-2 relative">
          {filteredResources.map((resourceId, index) => (
            <LiquidityResourceRow
              key={resourceId}
              playerStructureIds={playerStructureIds}
              bankEntityId={bankEntityId!}
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
