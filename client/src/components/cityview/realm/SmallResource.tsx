import { findResourceById } from "@bibliothecadao/eternum";
import { ResourceIcon } from "../../../elements/ResourceIcon";
import { currencyFormat, getEntityIdFromKeys } from "../../../utils/utils";
import { useComponentValue } from "@dojoengine/react";
import { useDojo } from "../../../DojoContext";
import useRealmStore from "../../../hooks/store/useRealmStore";
import useUIStore from "../../../hooks/store/useUIStore";

export const SmallResource = ({ resourceId }: { resourceId: number }) => {
  const {
    setup: {
      components: { Resource },
    },
  } = useDojo();

  const { realmEntityId } = useRealmStore();
  const setTooltip = useUIStore((state) => state.setTooltip);

  const resource = useComponentValue(Resource, getEntityIdFromKeys([BigInt(realmEntityId ?? 0), BigInt(resourceId)]));

  return (
    <div
      onMouseEnter={() =>
        setTooltip({
          position: "bottom",
          content: <>{findResourceById(resourceId)?.trait}</>,
        })
      }
      onMouseLeave={() => setTooltip(null)}
      className="flex relative group items-center"
    >
      <ResourceIcon
        withTooltip={false}
        resource={findResourceById(resourceId)?.trait || ""}
        size="xs"
        className="mr-1"
      />
      <div className="text-xxs">{currencyFormat(resource?.balance || 0, 2)}</div>
    </div>
  );
};
