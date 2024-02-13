import { findResourceById } from "@bibliothecadao/eternum";
import { ResourceIcon } from "../../../elements/ResourceIcon";
import { currencyFormat, divideByPrecision } from "../../../utils/utils";
import useUIStore from "../../../hooks/store/useUIStore";
import clsx from "clsx";

export const SmallResource = ({
  resourceId,
  balance,
  vertical,
  intlFormat,
  hideIfZero,
}: {
  resourceId: number;
  balance: number;
  entity_id?: bigint;
  vertical?: boolean;
  intlFormat?: boolean;
  hideIfZero?: boolean;
}) => {
  const setTooltip = useUIStore((state) => state.setTooltip);

  return balance > 0 ? (
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
            }).format(divideByPrecision(balance))
          : currencyFormat(balance, 2)}
      </div>
    </div>
  ) : null;
};
