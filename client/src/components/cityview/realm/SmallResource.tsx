import { findResourceById } from "@bibliothecadao/eternum";
import { ResourceIcon } from "../../../elements/ResourceIcon";
import { currencyFormat, divideByPrecision, getEntityIdFromKeys } from "../../../utils/utils";
import { useComponentValue } from "@dojoengine/react";
import { useDojo } from "../../../DojoContext";
import useRealmStore from "../../../hooks/store/useRealmStore";
import useUIStore from "../../../hooks/store/useUIStore";
import clsx from "clsx";

export const SmallResource = ({
  resourceId,
  entity_id,
  vertical,
  intlFormat,
  hideIfZero,
}: {
  resourceId: number;
  entity_id?: number;
  vertical?: boolean;
  intlFormat?: boolean;
  hideIfZero?: boolean;
}) => {
  const {
    setup: {
      components: { Resource },
    },
  } = useDojo();

  const { realmEntityId } = useRealmStore();
  const setTooltip = useUIStore((state) => state.setTooltip);
  const _entity_id = entity_id || realmEntityId;
  const resource = useComponentValue(Resource, getEntityIdFromKeys([BigInt(_entity_id ?? 0), BigInt(resourceId)]));

  return resource?.balance ? (
    <div
      onMouseEnter={() =>
        setTooltip({
          position: "bottom",
          content: <>{findResourceById(resourceId)?.trait}</>,
        })
      }
      onMouseLeave={() => setTooltip(null)}
      className={clsx("flex relative group items-center", vertical && "flex-col space-y-1", !vertical && "space-x-1")}
    >
      <ResourceIcon withTooltip={false} resource={findResourceById(resourceId)?.trait || ""} size="md" />
      <div className="text-xxs">
        {intlFormat
          ? Intl.NumberFormat("en-US", {
              notation: "compact",
              maximumFractionDigits: 1,
            }).format(divideByPrecision(resource?.balance || 0))
          : currencyFormat(resource?.balance || 0, 2)}
      </div>
    </div>
  ) : null;
};
