import { useResources } from "@/hooks/helpers/useResources";
import { Entity } from "../entities/Entity";

export const ResourceArrivals = ({ entityId }: { entityId: bigint }) => {
  const { getArrivalsWithResources } = useResources();

  const entityIds = getArrivalsWithResources(entityId);

  return (
    <div>
      {entityIds.map((entityId) => {
        return <Entity key={entityId} entityId={entityId} />;
      })}
    </div>
  );
};
