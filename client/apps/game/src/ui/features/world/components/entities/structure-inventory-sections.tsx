import { useUIStore } from "@/hooks/store/use-ui-store";
import { Tabs } from "@/ui/design-system/atoms/tab";
import { ResourceCost } from "@/ui/design-system/molecules/resource-cost";
import { RelicActivationPopup } from "@/ui/features/economy/resources/relic-activation-popup";
import { divideByPrecision, getBlockTimestamp, ResourceManager } from "@bibliothecadao/eternum";
import { ClientComponents, ComponentValue, getRelicInfo, ID, isRelic, RelicRecipientType } from "@bibliothecadao/types";
import { Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

type DisplayResource = {
  resourceId: number;
  amount: number;
  rawAmount: number;
  isRelic: boolean;
  isActive: boolean;
  canActivate: boolean;
};

type SharedProps = {
  resources: ComponentValue<ClientComponents["Resource"]["schema"]>;
  activeRelicIds: number[];
  entityId: ID;
  entityOwnerId?: ID;
  maxItems?: number;
  compact?: boolean;
  allowRelicActivation?: boolean;
};

const buildDisplayResources = (
  resources: ComponentValue<ClientComponents["Resource"]["schema"]>,
  activeRelicIds: number[],
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
      baseItem.canActivate = relicInfo?.recipientType === RelicRecipientType.Structure;
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

type InventoryBuckets = ReturnType<typeof buildDisplayResources>;

type StructureInventorySectionBaseProps = SharedProps & {
  section: "resources" | "relics";
  buckets?: InventoryBuckets;
};

const StructureInventorySectionBase = ({
  resources,
  activeRelicIds,
  entityId,
  entityOwnerId,
  maxItems = Infinity,
  compact = false,
  allowRelicActivation = false,
  section,
  buckets: bucketsOverride,
}: StructureInventorySectionBaseProps) => {
  const [showAll, setShowAll] = useState(false);
  const toggleModal = useUIStore((state) => state.toggleModal);

  const { regular, relicList } = useMemo(
    () => bucketsOverride ?? buildDisplayResources(resources, activeRelicIds),
    [resources, activeRelicIds, bucketsOverride],
  );

  const items = section === "resources" ? regular : relicList;
  const emptyMessage = section === "resources" ? "No resources stored." : "No relics stored.";
  const textSize = compact ? "text-xxs" : "text-xs";

  if (items.length === 0) {
    return <div className={`${textSize} text-gold/60 italic`}>{emptyMessage}</div>;
  }

  const finiteMax = Number.isFinite(maxItems) ? Number(maxItems) : undefined;
  const limit = showAll || finiteMax === undefined ? items.length : Math.max(finiteMax, 0);
  const visibleItems = items.slice(0, limit);
  const hiddenCount = Math.max(items.length - visibleItems.length, 0);
  const canToggleVisibility = hiddenCount > 0 && finiteMax !== undefined;

  const gridClass = compact
    ? "grid grid-cols-2 gap-1"
    : "grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-1.5";

  const infoLabel = hiddenCount > 0 ? `Showing ${visibleItems.length} / ${items.length}` : `Total ${items.length}`;

  const handleRelicClick = (resource: DisplayResource) => {
    if (section !== "relics") return;
    if (!allowRelicActivation || !resource.canActivate || resource.isActive) return;
    if (!entityId || !entityOwnerId) return;

    toggleModal(
      <RelicActivationPopup
        entityId={entityId}
        entityOwnerId={entityOwnerId}
        recipientType={RelicRecipientType.Structure}
        relicId={resource.resourceId}
        relicBalance={resource.amount}
        onClose={() => toggleModal(null)}
      />,
    );
  };

  return (
    <div className={`flex flex-col ${compact ? "gap-2" : "gap-3"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`${textSize} text-gold/50`}>{infoLabel}</span>
        {section === "relics" && allowRelicActivation && (
          <span className={`${textSize} text-gold/50`}>Tap a relic to activate</span>
        )}
      </div>
      <div className={`${gridClass} rounded-lg border border-gold/20 bg-dark/40 p-2`} role="list">
        {visibleItems.map((item) => {
          if (section === "relics") {
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
      {canToggleVisibility && (
        <button
          type="button"
          className="self-start rounded-full border border-gold/30 bg-dark/60 px-3 py-1 text-xxs font-semibold uppercase tracking-[0.22em] text-gold/80 hover:border-gold/50 hover:text-gold"
          onClick={() => setShowAll((prev) => !prev)}
        >
          {showAll ? "Hide" : `Show ${hiddenCount} more`}
        </button>
      )}
    </div>
  );
};

export const StructureResourcesSection = (props: SharedProps) => (
  <StructureInventorySectionBase section="resources" {...props} />
);

export const StructureRelicsSection = (props: SharedProps) => (
  <StructureInventorySectionBase section="relics" {...props} />
);

type StructureInventoryTabsProps = SharedProps;

export const StructureInventoryTabs = ({
  resources,
  activeRelicIds,
  entityId,
  entityOwnerId,
  maxItems,
  compact,
  allowRelicActivation,
}: StructureInventoryTabsProps) => {
  const buckets = useMemo(() => buildDisplayResources(resources, activeRelicIds), [resources, activeRelicIds]);

  const resourceCount = buckets.regular.length;
  const relicCount = buckets.relicList.length;

  const labelTextClass = `${compact ? "text-xs" : "text-sm"} font-semibold transition-colors`;
  const badgeClass =
    "rounded-full border border-gold/25 px-2 py-0.5 text-xxs font-semibold text-gold/70 transition-colors group-aria-selected:border-gold group-aria-selected:text-gold group-data-[headlessui-state=selected]:border-gold group-data-[headlessui-state=selected]:text-gold";

  return (
    <Tabs variant="inventory" size={compact ? "small" : "medium"} className="w-full gap-3">
      <Tabs.List className="flex w-full justify-start gap-4 border-b border-gold/20 pb-0.5">
        <Tabs.Tab className="!mx-0">
          <span className={labelTextClass}>Resources</span>
          <span className={badgeClass}>{resourceCount}</span>
        </Tabs.Tab>
        <Tabs.Tab className="!mx-0">
          <span className={labelTextClass}>Relics</span>
          <span className={badgeClass}>{relicCount}</span>
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Panels className="mt-3 w-full">
        <Tabs.Panel className="w-full">
          <StructureInventorySectionBase
            section="resources"
            resources={resources}
            activeRelicIds={activeRelicIds}
            entityId={entityId}
            entityOwnerId={entityOwnerId}
            maxItems={maxItems}
            compact={compact}
            allowRelicActivation={allowRelicActivation}
            buckets={buckets}
          />
        </Tabs.Panel>
        <Tabs.Panel className="w-full">
          <StructureInventorySectionBase
            section="relics"
            resources={resources}
            activeRelicIds={activeRelicIds}
            entityId={entityId}
            entityOwnerId={entityOwnerId}
            maxItems={maxItems}
            compact={compact}
            allowRelicActivation={allowRelicActivation}
            buckets={buckets}
          />
        </Tabs.Panel>
      </Tabs.Panels>
    </Tabs>
  );
};
