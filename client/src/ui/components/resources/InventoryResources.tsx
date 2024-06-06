import { useResources } from "@/hooks/helpers/useResources";
import { Headline } from "@/ui/elements/Headline";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { divideByPrecision } from "@/ui/utils/utils";

export const InventoryResources = ({
  entityId,
  max = Infinity,
  className = "flex flex-wrap",
  title,
}: {
  entityId: bigint;
  max?: number;
  className?: string;
  title?: string;
}) => {
  const { getResourcesFromBalance } = useResources();

  const inventoryResources = getResourcesFromBalance(entityId);

  return (
    <div className={className}>
      {/* <div className="w-full uppercase font-bold p-2">{title && title}</div> */}
      {inventoryResources &&
        inventoryResources
          .slice(0, max)
          .map(
            (resource) =>
              resource && (
                <ResourceCost
                  size="sm"
                  textSize="xs"
                  key={resource.resourceId}
                  type="vertical"
                  color="text-green"
                  resourceId={resource.resourceId}
                  amount={divideByPrecision(Number(resource.amount))}
                />
              ),
          )}
      <div className="ml-1">{max < inventoryResources.length && `+${inventoryResources.length - max}`}</div>
    </div>
  );
};
