import { useMemo } from "react";
import { findResourceById } from "@bibliothecadao/eternum";
import { ResourceIcon } from "./ResourceIcon";
import clsx from "clsx";
import { currencyFormat } from "../utils/utils";

type ResourceCostProps = {
  resourceId: number;
  amount: number;
  color?: string;
  type?: "horizontal" | "vertical";
  className?: string;
  withTooltip?: boolean;
  onClick?: () => void;
};

export const ResourceCost = ({
  type = "horizontal",
  className,
  withTooltip = false,
  onClick,
  ...props
}: ResourceCostProps) => {
  const trait = useMemo(() => findResourceById(props.resourceId)?.trait, [props.resourceId]);
  return (
    <div
      className={clsx(
        "relative flex items-center w-full gap-1 px-1 rounded text-lightest",
        type === "horizontal" ? "flex-row justify-start" : "flex-col justify-center",
        className,
      )}
      onClick={onClick}
    >
      <ResourceIcon withTooltip={withTooltip} resource={trait || ""} size="xs" />
      <div
        className={clsx("relative flex flex-col shrink-0", type === "horizontal" ? "ml-1 font-bold" : "items-center")}
      >
        <div className={clsx("relative text-xs", props.color)}>
          {props.color && props.amount > 0 ? "+" : ""}
          {currencyFormat(props.amount, 0)}
        </div>
        {type === "horizontal" && <div className="text-xxs leading-[10px] self-start relative">{trait}</div>}
      </div>
    </div>
  );
};
