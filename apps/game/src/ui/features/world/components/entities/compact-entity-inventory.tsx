import { memo, useCallback, useMemo } from "react";

import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_VALUE } from "@/ui/design-system/atoms/hud-typography";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import type { RelicHolderPreview } from "@/ui/features/relics/components/player-relic-tray";
import { RelicActivationSelector } from "@/ui/features/relics/components/relic-activation-selector";
import { divideByPrecision, ResourceManager } from "@bibliothecadao/eternum";
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
import Sparkles from "lucide-react/dist/esm/icons/sparkles";

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
  filter?: CompactInventoryFilter;
  emptyMessage?: string;
  showHiddenCount?: boolean;
  /**
   * When > 0, renders the first `heroCount` items in a larger, higher-contrast
   * row above the tight grid. Useful for surfacing the highest-priority
   * resources (lords / relics / food) at a glance.
   */
  heroCount?: number;
}

type CompactInventoryFilter = "all" | "resources" | "relics" | "usableRelics";

interface DisplayItem {
  resourceId: number;
  amount: number;
  isRelic: boolean;
  isActive: boolean;
  canActivate: boolean;
}

type InventoryItemVariant = "default" | "hero";

const compactInventoryFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

// Above 100K the decimal is just noise (345.2K → 345K).
const compactInventoryFormatterWhole = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 0,
});

const formatFullInventoryAmount = (value: number): string => Math.floor(value).toLocaleString();

export const formatInventoryAmount = (value: number, options?: { compact?: boolean }): string => {
  const flooredValue = Math.floor(value);
  if (options?.compact === false) {
    return formatFullInventoryAmount(flooredValue);
  }
  if (flooredValue >= 1000) {
    return (flooredValue >= 100_000 ? compactInventoryFormatterWhole : compactInventoryFormatter).format(flooredValue);
  }
  return formatFullInventoryAmount(flooredValue);
};

export const buildDisplayItems = (
  resourceComponent?: ComponentValue<ClientComponents["Resource"]["schema"]> | null,
  currentDefaultTick?: number,
  activeRelicIds: number[] = [],
  recipientType?: RelicRecipientType,
  resourceTiers?: Record<string, ResourcesIds[]>,
) => {
  if (!resourceComponent) return [] as DisplayItem[];

  const projectedTick = currentDefaultTick ?? 0;
  const balances = ResourceManager.getResourceBalancesWithProduction(resourceComponent, projectedTick).filter(
    (resource) => resource.amount > 0,
  );

  const activeRelicSet = new Set(activeRelicIds);
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

export const filterDisplayItems = (items: DisplayItem[], filter: CompactInventoryFilter = "all") => {
  if (filter === "resources") return items.filter((item) => !item.isRelic);
  if (filter === "relics") return items.filter((item) => item.isRelic);
  if (filter === "usableRelics") return items.filter((item) => item.isRelic && item.canActivate && !item.isActive);
  return items;
};

export const countDisplayItems = (items: DisplayItem[]) => {
  const relics = items.filter((item) => item.isRelic);

  return {
    total: items.length,
    resources: items.length - relics.length,
    relics: relics.length,
    activeRelics: relics.filter((item) => item.isActive).length,
    totalRelics: sumDisplayItemAmounts(relics),
    usableRelics: sumDisplayItemAmounts(relics.filter((item) => item.canActivate && !item.isActive)),
  };
};

const sumDisplayItemAmounts = (items: DisplayItem[]) =>
  items.reduce((total, item) => total + Math.max(0, Math.floor(item.amount)), 0);

const getResourceItemClass = (variant: InventoryItemVariant) =>
  variant === "hero"
    ? "border-gold/45 bg-[linear-gradient(180deg,rgba(56,40,14,0.95),rgba(10,10,10,0.96))]"
    : "border-gold/25 bg-[linear-gradient(180deg,rgba(28,21,9,0.9),rgba(8,8,8,0.95))]";

const getRelicItemClass = (item: DisplayItem) => {
  if (item.isActive) {
    return "border-relic2/70 bg-[linear-gradient(180deg,rgba(165,124,255,0.2),rgba(14,10,22,0.92))] shadow-[inset_0_1px_0_rgba(210,185,255,0.18),0_0_12px_rgba(165,124,255,0.16)]";
  }

  if (item.canActivate) {
    return "border-gold/80 bg-[linear-gradient(180deg,rgba(166,117,34,0.22),rgba(22,12,30,0.94))] shadow-[inset_0_1px_0_rgba(255,214,102,0.22),0_0_14px_rgba(223,170,84,0.16)]";
  }

  return "border-dashed border-relic2/25 bg-[linear-gradient(180deg,rgba(100,76,160,0.08),rgba(10,8,16,0.94))] text-gold/65";
};

const getInventoryItemClass = (item: DisplayItem, variant: InventoryItemVariant) =>
  item.isRelic ? getRelicItemClass(item) : getResourceItemClass(variant);

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
    filter = "all",
    emptyMessage = "No inventory.",
    showHiddenCount = true,
    heroCount = 0,
  }: CompactEntityInventoryProps) => {
    const openSurface = usePopoverStore((state) => state.openSurface);
    const closeSurface = usePopoverStore((state) => state.closeSurface);
    const mode = useGameModeConfig();
    const currentDefaultTick = useCurrentDefaultTick();
    const resourceTiers = useMemo(() => mode.resources.getTiers(), [mode]);
    const items = useMemo(
      () => buildDisplayItems(resources, currentDefaultTick, activeRelicIds, recipientType, resourceTiers),
      [resources, currentDefaultTick, activeRelicIds, recipientType, resourceTiers],
    );
    const displayItems = useMemo(() => filterDisplayItems(items, filter), [filter, items]);

    const hasLimit = maxItems !== undefined && Number.isFinite(maxItems);
    const limit = hasLimit ? Math.max(0, Number(maxItems)) : undefined;
    const visibleItems = hasLimit && limit !== undefined ? displayItems.slice(0, limit) : displayItems;
    const hiddenCount = hasLimit && limit !== undefined ? Math.max(displayItems.length - limit, 0) : 0;

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

        openSurface({
          id: "relic-activation",
          content: (
            <RelicActivationSelector
              resourceId={item.resourceId}
              displayAmount={formatInventoryAmount(item.amount)}
              holders={[holder]}
              onClose={closeSurface}
            />
          ),
        });
      },
      [allowRelicActivation, entityId, entityType, recipientType, openSurface],
    );

    if (displayItems.length === 0) {
      return <p className="text-xxs text-gold/60 italic">{emptyMessage}</p>;
    }

    // Tight tiles are a fixed width in a wrapping row so they stay the same size
    // regardless of how wide the host panel is (a stretching grid made the same
    // relic look bigger in the wide left panel than in the narrow right one).
    const baseGrid =
      variant === "tight"
        ? "flex flex-wrap justify-start gap-1.5"
        : "grid grid-cols-[repeat(auto-fit,minmax(72px,1fr))] gap-1.5";

    const compactItemClass = variant === "tight" ? "px-1.5 py-1.5" : "px-1.5 py-1";
    const iconSize = variant === "tight" ? "xs" : "sm";
    const amountClass = variant === "tight" ? "text-xs" : "text-xxs";

    const effectiveHeroCount = Math.max(0, Math.min(heroCount, visibleItems.length));
    const heroItems = effectiveHeroCount > 0 ? visibleItems.slice(0, effectiveHeroCount) : [];
    const regularItems = effectiveHeroCount > 0 ? visibleItems.slice(effectiveHeroCount) : visibleItems;

    const renderItem = (item: DisplayItem, options: { hero: boolean }) => {
      const resourceDef = resourceDefs.find((r) => r.id === item.resourceId);
      const relicInfo = item.isRelic ? getRelicInfo(item.resourceId) : undefined;
      const itemName = relicInfo?.name ?? resourceDef?.trait ?? ResourcesIds[item.resourceId] ?? "resource";
      const isActivatableRelic = item.isRelic && item.canActivate && !item.isActive;
      const isClickableRelic = allowRelicActivation && isActivatableRelic && entityId && entityType != null;

      const heroPadding = "px-2.5 py-2";
      const heroIconSize = "sm";
      const heroAmountClass = HUD_VALUE;
      const itemVariant = options.hero ? "hero" : "default";

      // Tight (non-hero) tiles get a fixed width; grid/hero tiles fill their cell.
      const widthClass = variant === "tight" && !options.hero ? "w-14" : "w-full";

      const itemClasses = cn(
        "flex h-full appearance-none flex-col items-center justify-center rounded-xl border text-center normal-case [font:inherit] [letter-spacing:inherit] shadow-[inset_0_1px_0_rgba(255,214,102,0.08)]",
        widthClass,
        options.hero ? heroPadding : compactItemClass,
        getInventoryItemClass(item, itemVariant),
        isClickableRelic &&
          "animate-relic-ready cursor-pointer transition-[background-color,border-color,box-shadow] duration-150 hover:border-gold hover:bg-gold/15 hover:shadow-[inset_0_1px_0_rgba(255,214,102,0.28),0_0_18px_rgba(223,170,84,0.24)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60",
      );

      const itemContent = (
        <>
          <ResourceIcon
            resource={ResourcesIds[item.resourceId]}
            size={options.hero ? heroIconSize : iconSize}
            withTooltip={false}
          />
          <span className={cn(options.hero ? heroAmountClass : amountClass, "font-semibold leading-none text-gold/95")}>
            {formatInventoryAmount(item.amount, { compact: !options.hero })}
          </span>
          {showLabels && resourceDef && (
            <span className="mt-0.5 text-[10px] text-gold/65 truncate" title={resourceDef.trait}>
              {resourceDef.ticker ?? resourceDef.trait}
            </span>
          )}
          {item.isRelic && item.isActive && <Sparkles className="mt-1 h-3 w-3 text-relic2" />}
        </>
      );

      if (isClickableRelic) {
        return (
          <button
            key={`inventory-item-${item.resourceId}`}
            type="button"
            className={itemClasses}
            onClick={() => handleRelicClick(item)}
            aria-label={`Activate ${itemName}`}
            title={`Activate ${itemName}`}
          >
            {itemContent}
          </button>
        );
      }

      return (
        <div
          key={`inventory-item-${item.resourceId}`}
          className={itemClasses}
          title={item.isRelic && !item.canActivate ? `${itemName} cannot be used by this entity` : itemName}
        >
          {itemContent}
        </div>
      );
    };

    return (
      <div className={cn("flex flex-col gap-2", className)}>
        {heroItems.length > 0 && (
          <div className="grid grid-cols-3 gap-2">{heroItems.map((item) => renderItem(item, { hero: true }))}</div>
        )}
        {regularItems.length > 0 && (
          <div className={cn(baseGrid)}>{regularItems.map((item) => renderItem(item, { hero: false }))}</div>
        )}
        {showHiddenCount && hiddenCount > 0 && (
          <span className="text-[10px] text-gold/60">
            Showing {visibleItems.length} of {displayItems.length}
          </span>
        )}
      </div>
    );
  },
);

CompactEntityInventory.displayName = "CompactEntityInventory";
