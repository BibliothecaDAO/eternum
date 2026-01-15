import { memo, useCallback, useMemo } from "react";

import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import type { RelicHolderPreview } from "@/ui/features/relics/components/player-relic-tray";
import { RelicActivationSelector } from "@/ui/features/relics/components/relic-activation-selector";
import { divideByPrecision, getBlockTimestamp, ResourceManager } from "@bibliothecadao/eternum";
import {
  ClientComponents,
  EntityType,
  getRelicInfo,
  ID,
  isRelic,
  RelicRecipientType,
  resources as resourceDefs,
  ResourcesIds,
} from "@bibliothecadao/types";
import { ComponentValue } from "@dojoengine/recs";
import { Sparkles } from "lucide-react";

interface CompactEntityInventoryProps {
  resources?: ComponentValue<ClientComponents["Resource"]["schema"]> | null;
  activeRelicIds?: number[];
  recipientType: RelicRecipientType;
  entityId?: ID;
  entityType?: EntityType;
  className?: string;
  variant?: "default" | "tight";
  showLabels?: boolean;
  allowRelicActivation?: boolean;
  maxItems?: number;
}

interface DisplayItem {
  resourceId: number;
  amount: number;
  isRelic: boolean;
  isActive: boolean;
  canActivate: boolean;
}

const compactInventoryFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const formatInventoryAmount = (value: number): string => {
  const flooredValue = Math.floor(value);
  if (flooredValue >= 1000) {
    return compactInventoryFormatter.format(flooredValue);
  }
  return flooredValue.toLocaleString();
};

const buildDisplayItems = (
  resourceComponent?: ComponentValue<ClientComponents["Resource"]["schema"]> | null,
  activeRelicIds: number[] = [],
  recipientType?: RelicRecipientType,
  resourceTiers?: Record<string, ResourcesIds[]>,
) => {
  if (!resourceComponent) return [] as DisplayItem[];

  const { currentDefaultTick } = getBlockTimestamp();
  const balances = ResourceManager.getResourceBalancesWithProduction(resourceComponent, currentDefaultTick).filter(
    (resource) => resource.amount > 0,
  );

  const activeRelicSet = new Set(activeRelicIds);
  const tiers = resourceTiers ?? {};
  const tierOrder = [
    "lords",
    "relics",
    "essence",
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

      const resourceId = Number(resource.resourceId);
      const relicInfo = isRelic(resourceId) ? getRelicInfo(resourceId) : undefined;

      return {
        resourceId,
        amount,
        isRelic: Boolean(relicInfo),
        isActive: activeRelicSet.has(resourceId),
        canActivate: relicInfo ? relicInfo.recipientType === recipientType : false,
      } as DisplayItem;
    })
    .filter(Boolean) as DisplayItem[];

  return items.sort((a, b) => {
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
    activeRelicIds,
    recipientType,
    entityId,
    entityType,
    className,
    variant = "default",
    showLabels = false,
    allowRelicActivation = false,
    maxItems,
  }: CompactEntityInventoryProps) => {
    const toggleModal = useUIStore((state) => state.toggleModal);
    const mode = useGameModeConfig();
    const resourceTiers = useMemo(() => mode.resources.getTiers(), [mode]);
    const items = useMemo(
      () => buildDisplayItems(resources, activeRelicIds, recipientType, resourceTiers),
      [resources, activeRelicIds, recipientType, resourceTiers],
    );

    const hasLimit = maxItems !== undefined && Number.isFinite(maxItems);
    const limit = hasLimit ? Math.max(0, Number(maxItems)) : undefined;
    const visibleItems = hasLimit && limit !== undefined ? items.slice(0, limit) : items;
    const hiddenCount = hasLimit && limit !== undefined ? Math.max(items.length - limit, 0) : 0;

    const handleRelicClick = useCallback(
      (item: DisplayItem) => {
        if (!allowRelicActivation || !item.isRelic || item.isActive || !item.canActivate) return;
        if (!entityId || entityType === undefined) return;

        const holder: RelicHolderPreview = {
          entityId: Number(entityId),
          amount: item.amount,
          recipientType,
          entityType,
        };

        toggleModal(
          <RelicActivationSelector
            resourceId={item.resourceId}
            displayAmount={formatInventoryAmount(item.amount)}
            holders={[holder]}
            onClose={() => toggleModal(null)}
          />,
        );
      },
      [allowRelicActivation, entityId, entityType, recipientType, toggleModal],
    );

    if (items.length === 0) {
      return <p className="text-xxs text-gold/60 italic">No inventory.</p>;
    }

    const baseGrid =
      variant === "tight"
        ? "grid grid-cols-[repeat(auto-fit,minmax(48px,1fr))] gap-1"
        : "grid grid-cols-[repeat(auto-fit,minmax(72px,1fr))] gap-1.5";

    const compactItemClass = variant === "tight" ? "px-1 py-0.5" : "px-1.5 py-1";
    const iconSize = variant === "tight" ? "xs" : "sm";
    const amountClass = variant === "tight" ? "text-[10px]" : "text-xxs";

    return (
      <div className={cn("flex flex-col gap-1", className)}>
        <div className={cn(baseGrid)}>
          {visibleItems.map((item) => {
            const resourceDef = resourceDefs.find((r) => r.id === item.resourceId);
            const isClickableRelic =
              allowRelicActivation &&
              item.isRelic &&
              item.canActivate &&
              !item.isActive &&
              entityId &&
              entityType != null;
            const itemClasses = cn(
              "flex h-full w-full flex-col items-center justify-center rounded-md border text-center",
              compactItemClass,
              item.isRelic
                ? item.isActive
                  ? "border-relic2/60 bg-relic/15"
                  : "border-relic2/40 bg-relic/10"
                : "border-gold/25 bg-dark/40",
              isClickableRelic &&
                "cursor-pointer transition-colors duration-150 hover:border-gold/60 hover:bg-gold/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60",
            );

            return (
              <div
                key={`inventory-item-${item.resourceId}`}
                className={itemClasses}
                onClick={() => handleRelicClick(item)}
              >
                <ResourceIcon resource={ResourcesIds[item.resourceId]} size={iconSize} withTooltip={false} />
                <span className={cn(amountClass, "font-semibold text-gold/90")}>
                  {formatInventoryAmount(item.amount)}
                </span>
                {showLabels && resourceDef && (
                  <span className="text-[9px] text-gold/60 truncate" title={resourceDef.trait}>
                    {resourceDef.ticker ?? resourceDef.trait}
                  </span>
                )}
                {item.isRelic && item.isActive && <Sparkles className="mt-1 h-3 w-3 text-relic2" />}
              </div>
            );
          })}
        </div>
        {hiddenCount > 0 && (
          <span className="text-[10px] text-gold/60">
            Showing {visibleItems.length} of {items.length}
          </span>
        )}
      </div>
    );
  },
);

CompactEntityInventory.displayName = "CompactEntityInventory";
