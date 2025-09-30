import { ResourceIcon } from "@/ui/design-system/molecules";
import { getTroopResourceId } from "@bibliothecadao/eternum";
import { resources, TroopTier, TroopType } from "@bibliothecadao/types";

export const getTroopResourceTrait = (category?: TroopType | string, tier?: TroopTier | string) => {
  if (!category || tier === undefined) return "";
  return (
    resources.find(
      (resource) => resource.id === getTroopResourceId(category as TroopType, tier as unknown as TroopTier),
    )?.trait || ""
  );
};

interface TroopBadgeProps {
  category?: TroopType | string;
  tier?: TroopTier | string;
  label?: string;
  className?: string;
  emphasize?: boolean;
}

export const TroopBadge = ({ category, tier, label, className, emphasize = false }: TroopBadgeProps) => {
  const trait = getTroopResourceTrait(category, tier ?? undefined);

  return (
    <span className={`inline-flex items-center gap-2 ${emphasize ? "text-gold" : "text-gold/70"} ${className ?? ""}`}>
      {trait ? (
        <span className="inline-flex items-center justify-center rounded-full border border-gold/40 bg-dark-brown/80 p-1">
          <ResourceIcon resource={trait} size="xs" withTooltip={false} />
        </span>
      ) : null}
      {label ? <span className="text-xs capitalize">{label}</span> : null}
      {tier !== undefined ? (
        <span className="rounded border border-gold/40 bg-gold/10 px-1 text-[10px] font-semibold text-gold">{`T${tier}`}</span>
      ) : null}
    </span>
  );
};
