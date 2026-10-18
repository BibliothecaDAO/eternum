import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { formatIncomingEta } from "@/ui/modules/entity-details/hooks/use-structure-upgrade";
import { ResourcesIds, formatExact, formatCharge, resourceName } from "@bibliothecadao/types";
import { HudChip } from "@/ui/design-system/kit/hud-elements";

export interface ResourceRequirement {
  resource: ResourcesIds;
  /** Held now, in whole units; undefined while the balance is unknown. */
  current: number | undefined;
  /** Needed, in whole units. */
  amount: number;
  incoming?: { amount: number; etaSeconds: number } | null;
}

/** Every cost the HUD shows reads the same way: held / needed per resource, in bad while short. */
export const RequirementChips = ({
  requirements,
  className,
}: {
  requirements: ResourceRequirement[] | undefined;
  className?: string;
}) => (
  <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
    {requirements === undefined && <HudChip>—</HudChip>}
    {requirements?.map((req) => {
      const isMet = req.current !== undefined && req.current >= req.amount;
      const incomingTitle = req.incoming
        ? ` (+${formatExact(Math.floor(req.incoming.amount))} in transit, ${formatIncomingEta(req.incoming.etaSeconds)})`
        : "";
      return (
        <span
          key={`${req.resource}-${req.amount}`}
          data-tip={`${resourceName(req.resource)} — need ${formatCharge(req.amount)}${incomingTitle}`}
        >
          <HudChip tone={isMet ? undefined : "bad"}>
            <ResourceIcon withTooltip={false} resource={req.resource} size="xs" />
            {req.current === undefined ? "—" : formatExact(Math.floor(req.current))} / {formatCharge(req.amount)}
            {req.incoming && <span className="text-hud-good">↑</span>}
          </HudChip>
        </span>
      );
    })}
  </div>
);
