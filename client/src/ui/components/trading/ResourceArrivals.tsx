import { useResources } from "@/hooks/helpers/useResources";
import { Entity } from "../entities/Entity";
import { Headline } from "@/ui/elements/Headline";

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

export const AllResourceArrivals = ({ entityIds }: { entityIds: bigint[] }) => {
  return (
    <div className="px-2 flex flex-col space-y-1 overflow-y-auto">
      <Headline>All Transfers</Headline>
      {!entityIds.length && <div className="text-center">No resource arrivals yet.</div>}
      {entityIds.map((entityId) => {
        return <Entity key={entityId} entityId={entityId} />;
      })}
    </div>
  );
};
