import { RESOURCE_TIERS } from "@bibliothecadao/eternum";
import { ResourceChip } from "./ResourceChip";
import { useResourceBalance } from "@/hooks/helpers/useResources";

export const EntityResourceTable = ({ entityId }: { entityId: bigint }) => {
  const { getBalance, getProductionManager } = useResourceBalance();
  return (
    <div>
      {Object.entries(RESOURCE_TIERS).map(([tier, resourceIds], index) => {
        return (
          <div className="my-3 px-3" key={index}>
            <h5>{tier}</h5>
            <hr />
            <div className="flex my-3 flex-wrap">
              {resourceIds.map((resourceId) => {
                const balance = getBalance(entityId, resourceId);

                const [active, rate] = getProductionManager(entityId, resourceId).netRate();

                return (
                  <ResourceChip
                    key={resourceId}
                    balance={balance.balance}
                    resourceId={resourceId}
                    rate={rate.toString() || ""}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
