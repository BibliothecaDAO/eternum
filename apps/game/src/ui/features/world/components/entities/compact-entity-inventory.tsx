import { memo, useMemo } from "react";

import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HudChip } from "@/ui/design-system/kit/hud-elements";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { divideByPrecision, ResourceManager } from "@bibliothecadao/eternum";
import { ResourcesIds, resourceName, formatShort } from "@bibliothecadao/types";

interface CompactEntityInventoryProps {
  resources?: ResourceManager | null;
  className?: string;
  maxItems?: number;
  emptyMessage?: string;
  showHiddenCount?: boolean;
}

interface DisplayItem {
  resourceId: number;
  amount: number;
}

export const buildDisplayItems = (
  resourceComponent?: ResourceManager | null,
  currentDefaultTick?: number,
  resourceTiers?: Record<string, ResourcesIds[]>,
) => {
  if (!resourceComponent) return [] as DisplayItem[];

  // An entity whose resources this client cannot see shows no inventory.
  const knownBalances = resourceComponent.balances(currentDefaultTick);
  if (!knownBalances) return [] as DisplayItem[];
  const balances = knownBalances.filter((resource) => resource.amount > 0);

  const tiers = resourceTiers ?? {};
  const tierOrder = [
    "lords",
    "relics",
    "essence",
    "research",
    "labor",
    "military",
    "transport",
    "food",
    "common",
    "uncommon",
    "rare",
    "unique",
    "mythic",
  ] as const;

  const priorityMap = new Map<number, { group: number; position: number }>();
  tierOrder.forEach((key, groupIndex) => {
    const ids = tiers[key] ?? [];
    ids.forEach((id, index) => {
      // Use resource id as position for materials to ensure stable asc sorting across buckets.
      const isMaterialGroup = groupIndex >= tierOrder.indexOf("common");
      priorityMap.set(id, { group: groupIndex, position: isMaterialGroup ? id : index });
    });
  });

  const resolvePriority = (resourceId: number) => {
    const match = priorityMap.get(resourceId);
    if (match) return match;
    // Fallback: send unknowns to the end, sorted by id.
    return { group: tierOrder.length, position: resourceId };
  };

  const items: DisplayItem[] = balances
    .map((resource) => {
      const amount = divideByPrecision(Number(resource.amount));
      if (amount <= 0) return null;

      return { resourceId: Number(resource.resourceId), amount } as DisplayItem;
    })
    .filter(Boolean) as DisplayItem[];

  return items.toSorted((a, b) => {
    const priA = resolvePriority(a.resourceId);
    const priB = resolvePriority(b.resourceId);
    if (priA.group !== priB.group) return priA.group - priB.group;
    if (priA.position !== priB.position) return priA.position - priB.position;
    // Stable fallback: higher amount first, then id.
    if (b.amount !== a.amount) return b.amount - a.amount;
    return a.resourceId - b.resourceId;
  });
};

export const CompactEntityInventory = memo(
  ({
    resources,
    className,
    maxItems,
    emptyMessage = "No inventory.",
    showHiddenCount = true,
  }: CompactEntityInventoryProps) => {
    const mode = useGameModeConfig();
    const currentDefaultTick = useCurrentDefaultTick();
    const resourceTiers = useMemo(() => mode.resources.getTiers(), [mode]);
    const displayItems = useMemo(
      () => buildDisplayItems(resources, currentDefaultTick, resourceTiers),
      [resources, currentDefaultTick, resourceTiers],
    );

    const hasLimit = maxItems !== undefined && Number.isFinite(maxItems);
    const limit = hasLimit ? Math.max(0, Number(maxItems)) : undefined;
    const visibleItems = hasLimit && limit !== undefined ? displayItems.slice(0, limit) : displayItems;
    const hiddenCount = hasLimit && limit !== undefined ? Math.max(displayItems.length - limit, 0) : 0;

    if (displayItems.length === 0) {
      return <p className="text-hud-label text-hud-muted italic">{emptyMessage}</p>;
    }

    return (
      <div className={cn("flex flex-col gap-2", className)}>
        <div className="flex flex-wrap justify-start gap-1.5">
          {visibleItems.map((item) => (
            <InventoryResource key={`inventory-item-${item.resourceId}`} item={item} />
          ))}
        </div>
        {showHiddenCount && hiddenCount > 0 && (
          <span className="text-hud-label text-hud-muted">
            Showing {visibleItems.length} of {displayItems.length}
          </span>
        )}
      </div>
    );
  },
);

/** A carried resource: its painting and how much, named on hover. */
const InventoryResource = ({ item }: { item: DisplayItem }) => {
  const name = resourceName(item.resourceId) ?? ResourcesIds[item.resourceId] ?? "resource";
  return (
    <span data-tip={name}>
      <HudChip>
        <ResourceIcon resource={item.resourceId} size="xs" withTooltip={false} />
        {formatShort(Math.floor(item.amount))}
      </HudChip>
    </span>
  );
};

CompactEntityInventory.displayName = "CompactEntityInventory";
