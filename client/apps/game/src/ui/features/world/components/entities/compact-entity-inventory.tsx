import { memo, useMemo } from "react";

import { cn } from "@/ui/design-system/atoms/lib/utils";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { BottomHudEmptyState } from "@/ui/features/world/components/hud-bottom";
import { currencyFormat } from "@/ui/utils/utils";
import { getBlockTimestamp, ResourceManager } from "@bibliothecadao/eternum";
import {
  ClientComponents,
  getRelicInfo,
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
  className?: string;
  variant?: "default" | "tight";
  showLabels?: boolean;
  maxItems?: number;
}

interface DisplayItem {
  resourceId: number;
  amount: number;
  isRelic: boolean;
  isActive: boolean;
  canActivate: boolean;
}

const buildDisplayItems = (
  resourceComponent?: ComponentValue<ClientComponents["Resource"]["schema"]> | null,
  activeRelicIds: number[] = [],
  recipientType?: RelicRecipientType,
) => {
  if (!resourceComponent) return [] as DisplayItem[];

  const { currentDefaultTick } = getBlockTimestamp();
  const balances = ResourceManager.getResourceBalancesWithProduction(resourceComponent, currentDefaultTick).filter(
    (resource) => resource.amount > 0,
  );

  const activeRelicSet = new Set(activeRelicIds);

  const items: DisplayItem[] = balances
    .map((resource) => {
      const amount = Number(resource.amount);
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
    if (a.isRelic && b.isRelic) {
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
    }
    if (a.isRelic && !b.isRelic) return -1;
    if (!a.isRelic && b.isRelic) return 1;
    return b.amount - a.amount;
  });
};

export const CompactEntityInventory = memo(
  ({
    resources,
    activeRelicIds,
    recipientType,
    className,
    variant = "default",
    showLabels = false,
    maxItems,
  }: CompactEntityInventoryProps) => {
    const items = useMemo(
      () => buildDisplayItems(resources, activeRelicIds, recipientType),
      [resources, activeRelicIds, recipientType],
    );

    if (items.length === 0) {
      return (
        <BottomHudEmptyState
          tone="subtle"
          className="min-h-0"
          textClassName="text-xxs text-gold/60 italic"
        >
          No inventory.
        </BottomHudEmptyState>
      );
    }

    const effectiveItems = maxItems && Number.isFinite(maxItems) ? items.slice(0, maxItems) : items;
    const showMoreIndicator = effectiveItems.length < items.length;

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
          {effectiveItems.map((item) => {
            const resourceDef = resourceDefs.find((r) => r.id === item.resourceId);
            const itemClasses = cn(
              "flex h-full w-full flex-col items-center justify-center rounded-md border text-center",
              compactItemClass,
              item.isRelic
                ? item.isActive
                  ? "border-relic2/60 bg-relic/15"
                  : "border-relic2/40 bg-relic/10"
                : "border-gold/25 bg-dark/40",
            );

            return (
              <div key={`inventory-item-${item.resourceId}`} className={itemClasses}>
                <ResourceIcon resource={ResourcesIds[item.resourceId]} size={iconSize} withTooltip={false} />
                <span className={cn(amountClass, "font-semibold text-gold/90")}>{currencyFormat(item.amount, 0)}</span>
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
        {showMoreIndicator && (
          <div className="text-[9px] uppercase tracking-[0.2em] text-gold/50">
            +{items.length - effectiveItems.length} more
          </div>
        )}
      </div>
    );
  },
);

CompactEntityInventory.displayName = "CompactEntityInventory";
