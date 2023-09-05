import { findResourceById } from "../../../constants/resources";
import { ResourceIcon } from "../../../elements/ResourceIcon";
import { currencyFormat, getEntityIdFromKeys } from "../../../utils/utils";
import { useComponentValue } from "@dojoengine/react";
import { useDojo } from "../../../DojoContext";
import useRealmStore from "../../../hooks/store/useRealmStore";
import { Tooltip } from "../../../elements/Tooltip";

export const SmallResource = ({ resourceId }: { resourceId: number }) => {
  const {
    setup: {
      components: { Resource },
    },
  } = useDojo();

  const { realmEntityId } = useRealmStore();

  const resource = useComponentValue(Resource, getEntityIdFromKeys([BigInt(realmEntityId ?? 0), BigInt(resourceId)]));

  return (
    <div className="flex relative group items-center">
      <ResourceIcon
        withTooltip={false}
        resource={findResourceById(resourceId)?.trait || ""}
        size="xs"
        className="mr-1"
      />
      <div className="text-xxs">{currencyFormat(resource?.balance || 0)}</div>
      <Tooltip>{findResourceById(resourceId)?.trait}</Tooltip>
    </div>
  );
};
