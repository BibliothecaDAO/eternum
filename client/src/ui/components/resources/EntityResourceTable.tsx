import { ID, RESOURCE_TIERS } from "@bibliothecadao/eternum";
import { useMemo } from "react";
import { ResourceChip } from "./ResourceChip";

export const EntityResourceTable = ({ entityId }: { entityId: ID | undefined }) => {
  if (!entityId) {
    return <div>Entity not found</div>;
  }

  const resourceElements = useMemo(() => {
    return Object.entries(RESOURCE_TIERS).map(([tier, resourceIds]) => {
      const resources = resourceIds.map((resourceId: any) => {
        return <ResourceChip key={resourceId} resourceId={resourceId} entityId={entityId} />;
      });

      return (
        <div key={tier}>
          <div className="grid grid-cols-1 flex-wrap">{resources}</div>
        </div>
      );
    });
  }, [entityId]);

  return <div>{resourceElements}</div>;
};
