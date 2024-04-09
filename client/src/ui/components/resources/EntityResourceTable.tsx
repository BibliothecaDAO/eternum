import { RESOURCE_TIERS, findResourceById, getIconResourceId } from "@bibliothecadao/eternum";
import { useDojo } from "../../../hooks/context/DojoContext";
import { ResourceIcon } from "../../elements/ResourceIcon";
import { currencyFormat, getEntityIdFromKeys } from "../../utils/utils";
import { useComponentValue } from "@dojoengine/react";
import { Entity } from "@dojoengine/recs";

export const EntityResourceTable = ({ entityId }: { entityId: bigint }) => {
  return (
    <div>
      {Object.entries(RESOURCE_TIERS).map(([tier, resourceIds]) => (
        <div className="my-3 px-3" key={tier}>
          <h5>{tier}</h5>
          <hr />
          <div className="flex my-3 flex-wrap">
            {resourceIds.map((resourceId) => (
              <ResourceComponent
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

export const ResourceComponent = ({
  isLabor = false,
  resourceId,
  entityId,
}: {
  isLabor?: boolean;
  resourceId: number;
  entityId: Entity;
}) => {
  const {
    setup: {
      components: { Resource },
    },
  } = useDojo();

  const resource = useComponentValue(Resource, entityId);

  return (
    <div className={`flex relative group items-center text-sm border rounded px-2 p-1`}>
      <ResourceIcon
        isLabor={isLabor}
        withTooltip={false}
        resource={findResourceById(getIconResourceId(resourceId, isLabor))?.trait as string}
        size="md"
        className="mr-1"
      />
      <div className="flex space-x-3 items-center justify-center">
        <div className="font-bold">{findResourceById(resourceId)?.trait}</div>
        <div>{currencyFormat(resource ? Number(resource.balance) : 0, 2)}</div>
      </div>
    </div>
  );
};
