import { useUIStore } from "@/hooks/store/use-ui-store";
import { Tabs } from "@/ui/design-system/atoms/tab";
import { ResourceCost } from "@/ui/design-system/molecules/resource-cost";
import { BottomHudEmptyState } from "@/ui/features/world/components/hud-bottom";
import { RelicActivationPopup } from "@/ui/features/economy/resources/relic-activation-popup";
import { divideByPrecision, getBlockTimestamp, ResourceManager } from "@bibliothecadao/eternum";
import { ClientComponents, getRelicInfo, ID, isRelic, RelicRecipientType } from "@bibliothecadao/types";
import { ComponentValue } from "@dojoengine/recs";
import { Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

interface DisplayResource {
  resourceId: number;
  amount: number;
  rawAmount: number;
  isRelic: boolean;
  isActive: boolean;
  canActivate: boolean;
}

const buildDisplayResources = (
  resources: ComponentValue<ClientComponents["Resource"]["schema"]>,
  activeRelicIds: number[],
  recipientType: RelicRecipientType,
) => {
  const { currentDefaultTick } = getBlockTimestamp();
  const balances = ResourceManager.getResourceBalancesWithProduction(resources, currentDefaultTick).filter(
    (resource) => resource.amount > 0,
  );

  const activeRelicSet = new Set(activeRelicIds);
  const regular: DisplayResource[] = [];
  const relicList: DisplayResource[] = [];

  balances.forEach((resource) => {
    const amount = divideByPrecision(Number(resource.amount));
    if (amount <= 0) return;

    const baseItem: DisplayResource = {
      resourceId: Number(resource.resourceId),
      amount,
      rawAmount: Number(resource.amount),
      isRelic: isRelic(resource.resourceId),
      isActive: false,
      canActivate: false,
    };

    if (baseItem.isRelic) {
      baseItem.isActive = activeRelicSet.has(baseItem.resourceId);
      const relicInfo = getRelicInfo(baseItem.resourceId);
      baseItem.canActivate = relicInfo?.recipientType === recipientType;
      relicList.push(baseItem);
    } else {
      regular.push(baseItem);
    }
  });

  regular.sort((a, b) => b.amount - a.amount);
  relicList.sort((a, b) => {
    if (a.isActive && !b.isActive) return -1;
    if (!a.isActive && b.isActive) return 1;
    return b.amount - a.amount;
  });

  return {
    regular,
    relicList,
  };
};

interface InventorySectionProps {
  items: DisplayResource[];
  isRelicSection: boolean;
  entityId: ID;
  entityOwnerId?: ID;
  allowRelicActivation: boolean;
  compact: boolean;
  recipientType: RelicRecipientType;
  maxItems?: number;
}

const InventorySection = ({
  items,
  isRelicSection,
  entityId,
  entityOwnerId,
  allowRelicActivation,
  compact,
  recipientType,
  maxItems,
}: InventorySectionProps) => {
  const toggleModal = useUIStore((state) => state.toggleModal);
  const [showAll, setShowAll] = useState(false);

  const listClass = compact ? "grid grid-cols-2 gap-1" : "grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-1.5";
  const textSize = compact ? "text-xxs" : "text-xs";

  const hasLimit = maxItems !== undefined && Number.isFinite(maxItems);
  const limitValue = hasLimit ? Math.max(Number(maxItems), 0) : items.length;
  const visibleItems = showAll || !hasLimit ? items : items.slice(0, limitValue);
  const hiddenCount = hasLimit ? Math.max(items.length - limitValue, 0) : 0;

  const infoLabel =
    hiddenCount > 0 && !showAll ? `Showing ${visibleItems.length} / ${items.length}` : `Total ${items.length}`;

  const handleRelicClick = (resource: DisplayResource) => {
    if (!isRelicSection) return;
    if (!entityId || !entityOwnerId) return;
    if (!allowRelicActivation || !resource.canActivate || resource.isActive) return;

    toggleModal(
      <RelicActivationPopup
        entityId={entityId}
        entityOwnerId={entityOwnerId}
        recipientType={recipientType}
        relicId={resource.resourceId}
        relicBalance={resource.amount}
        onClose={() => toggleModal(null)}
      />,
    );
  };

  if (!items.length) {
    return (
      <BottomHudEmptyState tone="subtle" className="min-h-0" textClassName={`${textSize} text-gold/60 italic`}>
        {isRelicSection ? "No relics stored." : "No resources stored."}
      </BottomHudEmptyState>
    );
  }

  return (
    <div className={`flex flex-col ${compact ? "gap-2" : "gap-3"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`${textSize} text-gold/50`}>{infoLabel}</span>
        {isRelicSection && allowRelicActivation && (
          <span className={`${textSize} text-gold/50`}>Tap a relic to activate</span>
        )}
      </div>
      <div className={`${listClass} rounded-lg border border-gold/20 bg-dark/40 p-2`} role="list">
        {visibleItems.map((item) => {
          if (isRelicSection) {
            const isClickable = allowRelicActivation && item.canActivate && !item.isActive;
            return (
              <div
                key={`relic-${item.resourceId}`}
                role="listitem"
                className={`relative rounded-lg border transition-all ${
                  item.isActive
                    ? "border-relic2/70 bg-relic/15"
                    : isClickable
                      ? "border-gold/30 bg-gold/10 hover:border-gold/60 hover:bg-gold/15 cursor-pointer"
                      : "border-gold/20 bg-dark/50"
                }`}
                onClick={() => handleRelicClick(item)}
              >
                <ResourceCost
                  resourceId={item.resourceId}
                  amount={item.amount}
                  type="vertical"
                  size={compact ? "xs" : "sm"}
                  textSize={compact ? "xxs" : "xs"}
                  color={item.isActive ? "text-relic" : "text-gold"}
                  withTooltip
                  className="!w-full !bg-transparent !border-none"
                />
                {item.isActive && <Sparkles className="absolute top-1 right-1 h-3 w-3 text-relic2 animate-pulse" />}
                {isClickable && (
                  <div className="pointer-events-none absolute inset-0 rounded-lg border border-gold/40 animate-pulse" />
                )}
              </div>
            );
          }

          return (
            <div key={`resource-${item.resourceId}`} role="listitem">
              <ResourceCost
                resourceId={item.resourceId}
                amount={item.amount}
                type="vertical"
                size={compact ? "xs" : "sm"}
                textSize={compact ? "xxs" : "xs"}
                withTooltip
                className="!w-full !bg-gold/10 hover:!bg-gold/15 border border-gold/25 hover:border-gold/40 transition-colors"
              />
            </div>
          );
        })}
      </div>
      {hiddenCount > 0 && (
        <button
          type="button"
          className="self-start rounded-full border border-gold/30 bg-dark/60 px-3 py-1 text-xxs font-semibold uppercase tracking-[0.22em] text-gold/80 hover:border-gold/50 hover:text-gold"
          onClick={() => setShowAll((prev) => !prev)}
        >
          {showAll ? "Show less" : `Show ${hiddenCount} more`}
        </button>
      )}
    </div>
  );
};

export interface EntityInventoryTabsProps {
  resources: ComponentValue<ClientComponents["Resource"]["schema"]>;
  activeRelicIds?: number[];
  entityId: ID;
  entityOwnerId?: ID;
  recipientType: RelicRecipientType;
  maxItems?: number;
  compact?: boolean;
  allowRelicActivation?: boolean;
  resourceLabel?: string;
  relicLabel?: string;
  className?: string;
}

export const EntityInventoryTabs = ({
  resources,
  activeRelicIds = [],
  entityId,
  entityOwnerId,
  recipientType,
  maxItems,
  compact = false,
  allowRelicActivation = false,
  resourceLabel = "Resources",
  relicLabel = "Relics",
  className,
}: EntityInventoryTabsProps) => {
  const buckets = useMemo(
    () => buildDisplayResources(resources, activeRelicIds, recipientType),
    [resources, activeRelicIds, recipientType],
  );

  const labelTextClass = `${compact ? "text-xs" : "text-sm"} font-semibold transition-colors`;
  const badgeClass =
    "ml-2 rounded-full border border-gold/25 px-2 py-0.5 text-xxs font-semibold text-gold/70 transition-colors group-data-[headlessui-state=selected]:border-gold group-data-[headlessui-state=selected]:text-gold";

  return (
    <Tabs variant="inventory" size={compact ? "small" : "medium"} className={`w-full gap-3 ${className ?? ""}`}>
      <Tabs.List className="flex w-full justify-start gap-4 border-b border-gold/20 pb-0.5">
        <Tabs.Tab className="!mx-0">
          <span className={labelTextClass}>{relicLabel}</span>
          <span className={badgeClass}>{buckets.relicList.length}</span>
        </Tabs.Tab>
        <Tabs.Tab className="!mx-0">
          <span className={labelTextClass}>{resourceLabel}</span>
          <span className={badgeClass}>{buckets.regular.length}</span>
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Panels className="mt-3 w-full">
        <Tabs.Panel className="w-full">
          <InventorySection
            items={buckets.relicList}
            isRelicSection
            entityId={entityId}
            entityOwnerId={entityOwnerId}
            allowRelicActivation={allowRelicActivation}
            compact={compact}
            recipientType={recipientType}
            maxItems={maxItems}
          />
        </Tabs.Panel>
        <Tabs.Panel className="w-full">
          <InventorySection
            items={buckets.regular}
            isRelicSection={false}
            entityId={entityId}
            entityOwnerId={entityOwnerId}
            allowRelicActivation={false}
            compact={compact}
            recipientType={recipientType}
            maxItems={maxItems}
          />
        </Tabs.Panel>
      </Tabs.Panels>
    </Tabs>
  );
};
