import { RESOURCE_TIERS } from "@bibliothecadao/eternum";
import { ResourceChip } from "./ResourceChip";
import { useMemo } from "react";

export const EntityResourceTable = ({ entityId }: { entityId: bigint | undefined }) => {
  if (!entityId) {
    return <div>Entity not found</div>;
  }

  const resourceElements = useMemo(() => {
    return Object.entries(RESOURCE_TIERS).map(([tier, resourceIds]) => {
      const resources = resourceIds.map((resourceId) => {
        return <ResourceChip key={resourceId} resourceId={resourceId} entityId={entityId} />;
      });

      return (
        <div className="my-3 px-3" key={tier}>
          <h5>{tier}</h5>
          <hr />
          <div className="flex my-3 flex-wrap">{resources}</div>
        </div>
      );
    });
  }, [entityId]);

  return <div>{resourceElements}</div>;
};
