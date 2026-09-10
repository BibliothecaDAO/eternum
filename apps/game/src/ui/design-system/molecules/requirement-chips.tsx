import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { formatIncomingEta } from "@/ui/modules/entity-details/hooks/use-structure-upgrade";
import { ResourcesIds } from "@bibliothecadao/types";

export interface ResourceRequirement {
  resource: ResourcesIds;
  /** Held now, in whole units. */
  current: number;
  /** Needed, in whole units. */
  amount: number;
  incoming?: { amount: number; etaSeconds: number } | null;
}

export const REQUIREMENT_CHIP =
  "flex items-center gap-1 rounded border border-gold/20 bg-black/40 px-1.5 py-1 text-[11px] font-semibold tabular-nums";

/** Every cost the HUD shows reads the same way: held / needed per resource, red while short. */
export const RequirementChips = ({
  requirements,
  className,
}: {
  requirements: ResourceRequirement[];
  className?: string;
}) => (
  <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
    {requirements.map((req) => {
      const isMet = req.current >= req.amount;
      const incomingTitle = req.incoming
        ? ` (+${Math.floor(req.incoming.amount).toLocaleString()} in transit, ${formatIncomingEta(req.incoming.etaSeconds)})`
        : "";
      return (
        <span
          key={`${req.resource}-${req.amount}`}
          className={REQUIREMENT_CHIP}
          title={`${ResourcesIds[req.resource] ?? `Resource ${req.resource}`} — need ${req.amount.toLocaleString()}${incomingTitle}`}
        >
          <ResourceIcon withTooltip={false} resource={ResourcesIds[req.resource]} size="xs" />
          <span className={isMet ? "text-gold" : "text-red-300"}>{Math.floor(req.current).toLocaleString()}</span>
          <span className={isMet ? "text-gold/55" : "text-red-300/80"}>/ {req.amount.toLocaleString()}</span>
          {req.incoming && <span className="text-emerald-300/90">↑</span>}
        </span>
      );
    })}
  </div>
);
