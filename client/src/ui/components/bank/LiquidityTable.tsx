import { ID, RESOURCE_TIERS } from "@bibliothecadao/eternum";
import { LiquidityResourceRow } from "./LiquidityResourceRow";

type LiquidityTableProps = {
  bank_entity_id: ID | undefined;
  entity_id: ID;
};

export const LiquidityTableHeader = () => (
  <div className="grid grid-cols-7 gap-4 mb-4 px-2">
    <div className="uppercase">Pair</div>
    <div className="uppercase">
      <p>Price</p>
    </div>
    <div className="uppercase col-span-2">Total Liquidity</div>
    <div className="uppercase col-span-2">My Liquidity</div>
  </div>
);

export const LiquidityTable = ({ bank_entity_id, entity_id }: LiquidityTableProps) => {
  if (!bank_entity_id) {
    return <div>Entity not found</div>;
  }

  return (
    <div className="p-4 h-full bg-gold/10 overflow-x-auto relative">
      <LiquidityTableHeader />
      <div className="overflow-y-auto">
        <div className="grid gap-2 relative">
          {Object.entries(RESOURCE_TIERS).map(([tier, resourceIds]) => {
            if (tier === "lords") return null;
            return resourceIds.map((resourceId) => (
              <LiquidityResourceRow
                key={resourceId}
                bankEntityId={bank_entity_id!}
                entityId={entity_id}
                resourceId={resourceId}
              />
            ));
          })}
        </div>
      </div>
    </div>
  );
};
