import { Coins, Factory, Loader, Shield } from "lucide-react";
import { memo, useMemo } from "react";

import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Tabs } from "@/ui/design-system/atoms/tab";
import { CompactDefenseDisplay } from "@/ui/features/military";
import { getStructureName } from "@bibliothecadao/eternum";
import { EntityType, ID, RelicRecipientType } from "@bibliothecadao/types";

import { ActiveRelicEffects } from "../active-relic-effects";
import { CompactEntityInventory } from "../compact-entity-inventory";
import { useStructureEntityDetail } from "../hooks/use-structure-entity-detail";
import { EntityDetailLayoutVariant, EntityDetailSection } from "../layout";
import { StructureProductionPanel } from "../structure-production-panel";

export interface StructureBannerEntityDetailProps {
  structureEntityId: ID;
  className?: string;
  compact?: boolean;
  maxInventory?: number;
  showButtons?: boolean;
  layoutVariant?: EntityDetailLayoutVariant;
}

interface StructureBannerEntityDetailContentProps extends Omit<StructureBannerEntityDetailProps, "layoutVariant"> {
  variant: EntityDetailLayoutVariant;
}

const StructureBannerEntityDetailContent = memo(
  ({
    structureEntityId,
    className,
    maxInventory = Infinity,
    showButtons = false,
    compact = true,
    variant,
  }: StructureBannerEntityDetailContentProps) => {
    const {
      structure,
      ownerDisplayName,
      structureDetails,
      resources,
      relicEffects,
      guards,
      guardSlotsUsed,
      guardSlotsMax,
      isMine,
      isHyperstructure,
      isBlitz,
      isLoadingStructure,
    } = useStructureEntityDetail({ structureEntityId });

    const activeRelicIds = useMemo(() => relicEffects.map((effect) => Number(effect.id)), [relicEffects]);

    if (isLoadingStructure) {
      return (
        <div className="mt-2 flex h-full items-center justify-center">
          <Loader className="animate-spin" />
        </div>
      );
    }

    if (!structure || !structureDetails) return null;
    const defenseDisplayVariant: EntityDetailLayoutVariant = variant === "banner" || compact ? "banner" : "default";
    const structureName = getStructureName(structure, isBlitz).name;
    const guardSlotsText =
      guardSlotsUsed !== undefined && guardSlotsMax !== undefined
        ? `${guardSlotsUsed}/${guardSlotsMax}`
        : guardSlotsUsed !== undefined
          ? `${guardSlotsUsed}`
          : guardSlotsMax !== undefined
            ? `0/${guardSlotsMax}`
            : "No data";
    const bodyTextClass = compact ? "text-xs" : "text-sm";
    const labelTextClass = compact ? "text-xxs" : "text-xs";
    const tabLabelClass = cn("uppercase tracking-[0.25em] text-gold/70", labelTextClass);

    return (
      <EntityDetailSection compact={compact} className={cn("flex h-full min-h-0 flex-col gap-2", className)}>
        <div className="flex flex-col gap-1 text-gold">
          <span className={cn("font-semibold", bodyTextClass)}>
            {isMine ? "🟢" : "🔴"} {ownerDisplayName}
            <span className="px-1 text-gold/50">·</span>
            {structureName}
          </span>
        </div>

        {relicEffects.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className={cn(labelTextClass, "uppercase tracking-[0.25em] text-gold/70")}>Active Relic Effects</span>
            <div className="max-h-[200px] overflow-auto pr-1">
              <ActiveRelicEffects relicEffects={relicEffects} entityId={structureEntityId} compact />
            </div>
          </div>
        )}

        <Tabs variant="inventory" className="flex flex-1 flex-col gap-3">
          <Tabs.Panels className="flex-1">
            <Tabs.Panel className="flex flex-col gap-2">
              {guards.length > 0 ? (
                <CompactDefenseDisplay
                  troops={guards.map((army) => ({ slot: army.slot, troops: army.troops }))}
                  slotsUsed={guardSlotsUsed}
                  slotsMax={guardSlotsMax}
                  structureId={Number(structure.entity_id ?? 0)}
                  canManageDefense={isMine}
                  variant={defenseDisplayVariant}
                />
              ) : (
                <p className="text-xxs text-gold/60 italic">No defenders stationed.</p>
              )}
            </Tabs.Panel>

            <Tabs.Panel className="flex flex-col gap-2">
              {resources ? (
                <StructureProductionPanel
                  structure={structure}
                  resources={resources}
                  compact
                  smallTextClass="text-xxs"
                  showProductionSummary={variant !== "banner"}
                  showTooltip={false}
                />
              ) : (
                <p className="text-xxs text-gold/60 italic">
                  {isHyperstructure ? "Hyperstructures do not produce resources." : "Production data unavailable."}
                </p>
              )}
            </Tabs.Panel>

            <Tabs.Panel className="flex flex-col gap-2">
              {resources ? (
                <CompactEntityInventory
                  resources={resources}
                  activeRelicIds={activeRelicIds}
                  recipientType={RelicRecipientType.Structure}
                  entityId={structureEntityId}
                  entityType={EntityType.STRUCTURE}
                  allowRelicActivation={showButtons && isMine}
                  variant="tight"
                  maxItems={maxInventory}
                />
              ) : (
                <p className="text-xxs text-gold/60 italic">No resources stored.</p>
              )}
            </Tabs.Panel>
          </Tabs.Panels>

          <Tabs.List className="mt-auto flex w-full items-center justify-between gap-2">
            <Tabs.Tab className="!mx-0 flex flex-1 items-center justify-center rounded-lg border border-gold/30 bg-dark/40 px-3 py-2 text-center transition hover:bg-dark/60">
              <Shield className="h-4 w-4 text-gold" />
            </Tabs.Tab>
            <Tabs.Tab className="!mx-0 flex flex-1 items-center justify-center rounded-lg border border-gold/30 bg-dark/40 px-3 py-2 text-center transition hover:bg-dark/60">
              <Factory className="h-4 w-4 text-gold" />
            </Tabs.Tab>
            <Tabs.Tab className="!mx-0 flex flex-1 items-center justify-center rounded-lg border border-gold/30 bg-dark/40 px-3 py-2 text-center transition hover:bg-dark/60">
              <Coins className="h-4 w-4 text-gold" />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs>

      </EntityDetailSection>
    );
  },
);
StructureBannerEntityDetailContent.displayName = "StructureBannerEntityDetailContent";

export const StructureBannerEntityDetail = memo(
  ({
    structureEntityId,
    className,
    compact = true,
    maxInventory = Infinity,
    showButtons = false,
    layoutVariant,
  }: StructureBannerEntityDetailProps) => {
    const resolvedVariant: EntityDetailLayoutVariant = layoutVariant ?? (compact ? "default" : "banner");

    return (
      <StructureBannerEntityDetailContent
        structureEntityId={structureEntityId}
        className={className}
        maxInventory={maxInventory}
        showButtons={showButtons}
        compact={compact}
        variant={resolvedVariant}
      />
    );
  },
);

StructureBannerEntityDetail.displayName = "StructureBannerEntityDetail";
