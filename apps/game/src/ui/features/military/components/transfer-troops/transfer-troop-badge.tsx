import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { getTroopResourceId } from "@bibliothecadao/eternum";
import { TroopTier, TroopType } from "@bibliothecadao/types";
import clsx from "clsx";
import { TierChip } from "../../utils/tier-chip";

const troopResource = (category?: TroopType | string, tier?: TroopTier | string) =>
  !category || tier === undefined ? null : getTroopResourceId(category as TroopType, tier as unknown as TroopTier);

interface TroopBadgeProps {
  category?: TroopType | string;
  tier?: TroopTier | string;
  label?: string;
  className?: string;
  emphasize?: boolean;
}

export const TroopBadge = ({ category, tier, label, className, emphasize = false }: TroopBadgeProps) => {
  const resourceId = troopResource(category, tier ?? undefined);

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${emphasize ? "text-hud-accent" : "text-hud-muted"} ${className ?? ""}`}
    >
      {tier !== undefined ? <TierChip tier={String(tier)} /> : null}
      {resourceId !== null ? (
        <span className="inline-flex items-center justify-center rounded-full border border-hud-line-strong bg-hud-well p-1">
          <ResourceIcon resource={resourceId} size="xs" withTooltip={false} />
        </span>
      ) : null}
      {label ? <span className="text-hud-label capitalize">{label}</span> : null}
    </span>
  );
};
