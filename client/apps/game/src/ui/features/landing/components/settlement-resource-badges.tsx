import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { ResourcesIds } from "@bibliothecadao/types";

import { cn } from "@/ui/design-system/atoms/lib/utils";

const resolveSettlementResourceLabel = (resourceId: number): string | null => {
  const label = ResourcesIds[resourceId as ResourcesIds];
  return typeof label === "string" ? label : null;
};

export const resolvePlannerResourceLabel = resolveSettlementResourceLabel;

export const SettlementResourceBadges = ({
  resourceIds,
  emptyLabel = "No allowed resources decoded.",
  className,
}: {
  resourceIds: number[];
  emptyLabel?: string;
  className?: string;
}) => {
  const resourceLabels = resourceIds
    .map((resourceId) => ({
      resourceId,
      label: resolveSettlementResourceLabel(resourceId),
    }))
    .filter((entry): entry is { resourceId: number; label: string } => entry.label != null);

  if (resourceLabels.length === 0) {
    return <span className="text-[11px] text-gold/50">{emptyLabel}</span>;
  }

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {resourceLabels.map(({ resourceId, label }, index) => (
        <div
          key={`${resourceId}-${index}`}
          className="inline-flex items-center gap-1 rounded-md border border-gold/20 bg-black/25 px-1.5 py-1"
        >
          <ResourceIcon resource={label} size="xs" withTooltip={false} />
          <span className="text-[10px] text-gold/70">{label}</span>
        </div>
      ))}
    </div>
  );
};
