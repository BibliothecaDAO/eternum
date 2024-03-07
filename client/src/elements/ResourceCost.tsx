import { useMemo } from "react";
import { findResourceById } from "@bibliothecadao/eternum";
import { ResourceIcon } from "./ResourceIcon";
import clsx from "clsx";

type ResourceCostProps = {
  isLabor?: boolean;
  resourceId: number;
  amount: number;
  color?: string;
  type?: "horizontal" | "vertical";
  className?: string;
  withTooltip?: boolean;
  onClick?: (e: any) => void;
};

export const ResourceCost = ({
  type = "horizontal",
  isLabor = false,
  className,
  withTooltip = false,
  onClick,
  ...props
}: ResourceCostProps) => {
  const trait = useMemo(() => findResourceById(props.resourceId)?.trait, [props.resourceId]);
  return (
    <div
      className={clsx(
        "relative flex items-center gap-1 px-1 rounded text-lightest",
        type === "horizontal" ? "flex-row" : "flex-col justify-center",
        className,
      )}
    >
      <ResourceIcon isLabor={isLabor} withTooltip={withTooltip} resource={trait || ""} size="md" />
      <div
        className={clsx(
          "relative flex flex-col shrink-0",
          type === "horizontal" ? "ml-1 font-bold  text-left" : "items-center",
        )}
      >
        <div onClick={onClick} className={clsx("relative text-xxs", props.color)}>
          {props.color && props.amount > 0 ? "+" : ""}
          {Intl.NumberFormat("en-US", {
            notation: "compact",
            maximumFractionDigits: 1,
          }).format(props.amount || 0)}
        </div>
        {type === "horizontal" && <div className="text-xxs leading-[10px] self-start relative">{trait}</div>}
      </div>
    </div>
  );
};
