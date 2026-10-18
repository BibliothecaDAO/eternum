import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HudField } from "@/ui/design-system/kit/hud-elements";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { ResourcesIds, formatAmount, resourceName } from "@bibliothecadao/types";

/** One input of a production run: its painting, what the realm holds (bad while short), and what the run takes, typed. */
export const ResourceInputRow = ({
  resource,
  held,
  needed,
  onNeeded,
}: {
  resource: number;
  held: number;
  needed: number;
  onNeeded: (amount: number) => void;
}) => (
  <div className="flex items-center gap-2 py-0.5">
    <ResourceIcon resource={resource} size="sm" withTooltip={false} />
    <span className={cn("w-24 shrink-0 tabular-nums text-hud-strong", held < needed && "text-hud-bad")}>
      {formatAmount(held)}
    </span>
    <HudField
      value={String(needed)}
      inputMode="numeric"
      aria-label={`${resourceName(resource)} for this run`}
      onChange={(typed) => onNeeded(Number(typed.replace(/\D/g, "")) || 0)}
    />
  </div>
);
