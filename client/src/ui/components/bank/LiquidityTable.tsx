import { RESOURCE_TIERS } from "@bibliothecadao/eternum";
import { LiquidityResourceRow } from "./LiquidityResourceRow";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";

type LiquidityTableProps = {
  bank_entity_id: bigint | undefined;
  entity_id: bigint;
};

export const LiquidityTable = ({ bank_entity_id, entity_id }: LiquidityTableProps) => {
  if (!bank_entity_id) {
    return <div>Entity not found</div>;
  }

  return (
    <div className="p-4 bg-gold/10 ">
      <table className="min-w-full ">
        <thead>
          <tr className="uppercase">
            <th className="text-left">Pair</th>
            {/* <th>Total TVL</th> */}
            <th className="text-left flex gap-1">
              <ResourceIcon resource={"Lords"} size="md" />
            </th>
            <th className="text-left">Total Resource</th>
            <th className="text-left">My Lords</th>
            <th className="text-left">My Resource</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(RESOURCE_TIERS).map(([tier, resourceIds]) => {
            if (tier === "lords") return;
            return resourceIds.map((resourceId) => (
              <LiquidityResourceRow
                key={resourceId}
                bankEntityId={bank_entity_id!}
                entityId={entity_id}
                resourceId={resourceId}
              />
            ));
          })}
        </tbody>
      </table>
    </div>
  );
};
