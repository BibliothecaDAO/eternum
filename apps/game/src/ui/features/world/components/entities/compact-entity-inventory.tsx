import { useRelicPayerEssence } from "@/ui/features/relics/hooks/use-relic-activation";
import { coversRelicCost, relicLine, relicShortName } from "@/ui/features/relics/relic-words";

import { memo, useCallback, useMemo } from "react";

import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { resourceMeaning } from "@/ui/design-system/icon-meaning";
import { HudChip, HudRelic, type RelicKind } from "@/ui/design-system/kit/hud-elements";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import type { RelicHolderPreview } from "@/ui/features/relics/components/relic-activation-selector";
import { RelicActivationSelector } from "@/ui/features/relics/components/relic-activation-selector";
import { divideByPrecision, ResourceManager } from "@bibliothecadao/eternum";
import {
  EntityType,
  getRelicInfo,
  ID,
  isRelic,
  type RelicInfo,
  RelicRecipientType,
  resources as resourceDefs,
  ResourcesIds,
} from "@bibliothecadao/types";
import { safeInteger } from "@bibliothecadao/eternum/game-client";

interface CompactEntityInventoryProps {
  resources?: ResourceManager | null;
  activeRelicIds?: number[];
  recipientType: RelicRecipientType;
  entityId?: ID;
  entityType?: EntityType;
  className?: string;
  allowRelicActivation?: boolean;
  maxItems?: number;
  filter?: CompactInventoryFilter;
  emptyMessage?: string;
  showHiddenCount?: boolean;
}

type CompactInventoryFilter = "all" | "resources" | "relics" | "usableRelics";

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
  resourceComponent?: ResourceManager | null,
  currentDefaultTick?: number,
  activeRelicIds: number[] = [],
  recipientType?: RelicRecipientType,
  resourceTiers?: Record<string, ResourcesIds[]>,
) => {
  if (!resourceComponent) return [] as DisplayItem[];

  // An entity whose resources this client cannot see shows no inventory.
  const knownBalances = resourceComponent.balances(currentDefaultTick);
  if (!knownBalances) return [] as DisplayItem[];
  const balances = knownBalances.filter((resource) => resource.amount > 0);

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

const filterDisplayItems = (items: DisplayItem[], filter: CompactInventoryFilter = "all") => {
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

/** What a relic works on, as the sheet's relic chip colours it. */
const RELIC_KIND: Record<RelicInfo["type"], RelicKind> = {
  Stamina: "stamina",
  Damage: "damage",
  "Damage Reduction": "damage-reduction",
  Exploration: "exploration",
  Production: "production",
};

export const CompactEntityInventory = memo(
  ({
    resources,
    activeRelicIds,
    recipientType,
    entityId,
    entityType,
    className,
    allowRelicActivation = false,
    maxItems,
    filter = "all",
    emptyMessage = "No inventory.",
    showHiddenCount = true,
  }: CompactEntityInventoryProps) => {
    const openSurface = usePopoverStore((state) => state.openSurface);
    const closeSurface = usePopoverStore((state) => state.closeSurface);
    const mode = useGameModeConfig();
    const currentDefaultTick = useCurrentDefaultTick();
    const payerEssence = useRelicPayerEssence(
      allowRelicActivation ? entityId : undefined,
      recipientType === RelicRecipientType.Explorer,
    );
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
          entityId: safeInteger(entityId),
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
      return <p className="text-hud-label text-hud-muted italic">{emptyMessage}</p>;
    }

    return (
      <div className={cn("flex flex-col gap-2", className)}>
        <div className="flex flex-wrap justify-start gap-1.5">
          {visibleItems.map((item) =>
            item.isRelic ? (
              <InventoryRelic
                key={`inventory-item-${item.resourceId}`}
                item={item}
                payerEssence={payerEssence}
                onActivate={allowRelicActivation && entityId && entityType != null ? handleRelicClick : null}
              />
            ) : (
              <InventoryResource key={`inventory-item-${item.resourceId}`} item={item} />
            ),
          )}
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

/**
 * A held relic: its painting, its short name and how many are held, in its kind's colour; working, ready to set to work
 * (pressable when its holder can pay), or only held (pressable but short, or not usable by this holder).
 */
const InventoryRelic = ({
  item,
  payerEssence,
  onActivate,
}: {
  item: DisplayItem;
  payerEssence: number | undefined;
  onActivate: ((item: DisplayItem) => void) | null;
}) => {
  const relicInfo = getRelicInfo(item.resourceId as ResourcesIds);
  const name = relicInfo?.name ?? ResourcesIds[item.resourceId] ?? "relic";
  const pressable = onActivate !== null && item.canActivate && !item.isActive;
  const state = item.isActive
    ? "active"
    : pressable && coversRelicCost(item.resourceId, payerEssence)
      ? "ready"
      : pressable || !item.canActivate
        ? "held"
        : undefined;
  return (
    <HudRelic
      icon={resourceMeaning(item.resourceId as ResourcesIds)}
      kind={relicInfo ? RELIC_KIND[relicInfo.type] : "stamina"}
      gives={relicShortName(item.resourceId)}
      trail={formatInventoryAmount(item.amount, { compact: true })}
      state={state}
      onPress={pressable ? () => onActivate(item) : undefined}
      label={pressable ? `Activate ${name}` : undefined}
      tip={
        pressable
          ? `Activate · ${relicLine(item.resourceId, payerEssence)}`
          : item.canActivate
            ? relicLine(item.resourceId)
            : `${relicLine(item.resourceId)} It cannot be used by this holder.`
      }
    />
  );
};

/** A carried resource: its painting and how much, named on hover. */
const InventoryResource = ({ item }: { item: DisplayItem }) => {
  const name =
    resourceDefs.find((resource) => resource.id === item.resourceId)?.trait ??
    ResourcesIds[item.resourceId] ??
    "resource";
  return (
    <span data-tip={name}>
      <HudChip>
        <ResourceIcon resource={item.resourceId} size="xs" withTooltip={false} />
        {formatInventoryAmount(item.amount, { compact: true })}
      </HudChip>
    </span>
  );
};

CompactEntityInventory.displayName = "CompactEntityInventory";
