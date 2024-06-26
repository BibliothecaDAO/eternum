import { RESOURCE_TIERS } from "@bibliothecadao/eternum";
import { LiquidityResourceRow } from "./LiquidityResourceRow";

type LiquidityTableProps = {
  bank_entity_id: bigint | undefined;
  entity_id: bigint;
};

export const LiquidityTable = ({ bank_entity_id, entity_id }: LiquidityTableProps) => {
  if (!bank_entity_id) {
    return <div>Entity not found</div>;
  }

  return (
    <table className="min-w-full leading-normal">
      <thead>
        <tr className="uppercase text-xs">
          <th>Pair</th>
          {/* <th>Total TVL</th> */}
          <th>Total Lords</th>
          <th>Total Resource</th>
          <th>My Lords</th>
          <th>My Resource</th>
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
  );
};
