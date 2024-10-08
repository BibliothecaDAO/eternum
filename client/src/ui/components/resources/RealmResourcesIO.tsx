import { useGetRealm } from "@/hooks/helpers/useRealm";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { unpackResources } from "@/ui/utils/packedData";
import { ID, RESOURCE_INPUTS_SCALED, ResourcesIds } from "@bibliothecadao/eternum";

export const RealmResourcesIO = ({
  realmEntityId,
  className,
  titleClassName,
  size = "xs",
}: {
  realmEntityId?: ID;
  className?: string;
  titleClassName?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "xxl";
}) => {
  const { realm } = useGetRealm(realmEntityId);

  const resourcesProduced = realm ? unpackResources(realm.resourceTypesPacked, realm.resourceTypesCount) : [];

  const resourcesConsumed = [
    ...new Set(
      resourcesProduced.flatMap((resourceId) => {
        return RESOURCE_INPUTS_SCALED[resourceId]
          .filter((input) => input.resource !== ResourcesIds["Wheat"] && input.resource !== ResourcesIds["Fish"])
          .map((input) => input.resource);
      }),
    ),
  ];

  return (
    realm && (
      <div className={`text-gold text-sm ${className}`}>
        <div className={` font-semibold mb-2 ${titleClassName}`}>Produces</div>
        <div className="flex flex-row mb-4">
          {resourcesProduced.map((resourceId) => (
            <ResourceIcon resource={ResourcesIds[resourceId]} size={size} key={resourceId} />
          ))}
        </div>

        <div className={` font-semibold mb-2 ${titleClassName}`}>Consumes</div>
        <div className="flex flex-row">
          {resourcesConsumed.map((resourceId) => (
            <ResourceIcon resource={ResourcesIds[resourceId]} size={size} key={resourceId} />
          ))}
        </div>
      </div>
    )
  );
};
