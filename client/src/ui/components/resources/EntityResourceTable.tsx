import { RESOURCE_TIERS } from "@bibliothecadao/eternum";
import { getEntityIdFromKeys } from "../../utils/utils";
import { ResourceChip } from "./ResourceChip";

export const EntityResourceTable = ({ entityId }: { entityId: bigint }) => {
  return (
    <div>
      {Object.entries(RESOURCE_TIERS).map(([tier, resourceIds]) => (
        <div className="my-3 px-3" key={tier}>
          <h5>{tier}</h5>
          <hr />
          <div className="flex my-3 flex-wrap">
            {resourceIds.map((resourceId) => (
              <ResourceChip
                entityId={getEntityIdFromKeys([BigInt(entityId), BigInt(resourceId)])}
                key={resourceId}
                resourceId={resourceId}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
