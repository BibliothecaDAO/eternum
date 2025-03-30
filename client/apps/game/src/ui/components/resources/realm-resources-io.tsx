import { ResourceIcon } from "@/ui/elements/resource-icon";
import { configManager, getEntityIdFromKeys, getRealmInfo, ID, ResourcesIds } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";

export const RealmResourcesIO = ({
  realmEntityId,
  className,
  titleClassName,
  size = "xs",
}: {
  realmEntityId: ID;
  className?: string;
  titleClassName?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "xxl";
}) => {
  const dojo = useDojo();
  const realm = getRealmInfo(getEntityIdFromKeys([BigInt(realmEntityId)]), dojo.setup.components);

  const resourcesProduced = realm ? realm.resources : [];
  const resourcesInputs = configManager.complexSystemResourceInputs;

  const resourcesConsumed = [
    ...new Set(
      resourcesProduced.flatMap((resourceId) => {
        return resourcesInputs[resourceId]
          .filter((input) => input.resource !== ResourcesIds["Wheat"] && input.resource !== ResourcesIds["Fish"])
          .map((input) => input.resource);
      }),
    ),
  ];

  return (
    realm && (
      <div className={`${className}`}>
        <h6 className={`mb-2 ${titleClassName}`}>Produces</h6>
        <div className="flex flex-row flex-wrap mb-4 gap-2">
          {resourcesProduced.map((resourceId) => (
            <ResourceIcon resource={ResourcesIds[resourceId]} size={size} key={resourceId} />
          ))}
        </div>

        <h6 className={` mb-2   ${titleClassName}`}>Consumes</h6>
        <div className="flex flex-row flex-wrap  gap-2">
          {resourcesConsumed.map((resourceId) => (
            <ResourceIcon resource={ResourcesIds[resourceId]} size={size} key={resourceId} />
          ))}
        </div>
      </div>
    )
  );
};
