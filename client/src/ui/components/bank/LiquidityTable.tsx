import { RESOURCE_TIERS } from "@bibliothecadao/eternum";
import { LiquidityResourceRow } from "./LiquidityResourceRow";

export const LiquidityTable = ({
  bank_entity_id,
  bank_account_entity_id,
}: {
  bank_entity_id: bigint | undefined;
  bank_account_entity_id: bigint | undefined;
}) => {
  if (!bank_entity_id || !bank_account_entity_id) {
    return <div>Entity not found</div>;
  }

  return (
    <table className="min-w-full leading-normal">
      <thead>
        <tr>
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
            <LiquidityResourceRow key={resourceId} bankEntityId={bank_account_entity_id!} resourceId={resourceId} />
          ));
        })}
      </tbody>
    </table>
  );
};
