import { knownAmount } from "@/ui/utils/utils";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { formatCharge, resourceName, formatHeldAgainst } from "@bibliothecadao/types";
import { cn } from "@/ui/design-system/atoms/lib/utils";

const SIZES = ["xs", "sm", "md", "lg"] as const;
const LAYOUT_TYPES = ["horizontal", "vertical"] as const;

type ResourceCostProps = {
  resourceId: number;
  /** Undefined when the amount is not known here; it shows as "—", never as zero. */
  amount: number | undefined;
  balance?: number;
  type?: (typeof LAYOUT_TYPES)[number];
  className?: string;
  withTooltip?: boolean;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  size?: (typeof SIZES)[number];
};

/**
 * A cost in the HUD sheet's words: the resource's painting, how much, what is held beside it in good or bad, and the
 * resource's name under a horizontal one.
 */
export const ResourceCost = ({
  resourceId,
  amount,
  balance,
  type = "horizontal",
  className,
  withTooltip = false,
  onClick,
  size = "md",
}: ResourceCostProps) => {
  const name = resourceName(resourceId);
  const held = knownAmount(balance);
  const hasSufficientBalance = held !== undefined && amount !== undefined && held >= amount;
  const showBalance = balance !== undefined && !isNaN(balance);
  const pair = amount === undefined ? undefined : formatHeldAgainst(held, amount);

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border border-hud-line bg-hud-well p-2",
        type === "horizontal" ? "flex-row" : "flex-col justify-center",
        className,
      )}
    >
      <ResourceIcon className="self-center" withTooltip={withTooltip} resource={resourceId} size={size} />
      <div className={cn("flex shrink-0 flex-col self-center", type === "horizontal" ? "text-left" : "items-center")}>
        <div onClick={onClick} className="text-hud-strong text-hud-ink tabular-nums">
          {pair ? pair.need : formatCharge(amount)}
          {showBalance && pair && (
            <span className={cn("text-hud-body", hasSufficientBalance ? "text-hud-good" : "text-hud-bad")}>
              {` (${pair.held})`}
            </span>
          )}
        </div>
        {type === "horizontal" && <div className="text-hud-label text-hud-muted">{name}</div>}
      </div>
    </div>
  );
};
