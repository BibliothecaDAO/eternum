import ArrowLeftRight from "lucide-react/dist/esm/icons/arrow-left-right";
import Coins from "lucide-react/dist/esm/icons/coins";
import Factory from "lucide-react/dist/esm/icons/factory";
import Loader from "lucide-react/dist/esm/icons/loader";
import Shield from "lucide-react/dist/esm/icons/shield";
import { memo, useCallback, useMemo } from "react";

import Button from "@/ui/design-system/atoms/button";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Tabs } from "@/ui/design-system/atoms/tab";
import { CompactDefenseDisplay } from "@/ui/features/military";
import { HyperstructureVPDisplay } from "@/ui/features/world/components/hyperstructures/hyperstructure-vp-display";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { buildVillageTimerSummary } from "@/ui/shared/lib/village-timers";
import { TRANSFER_POPUP_NAME } from "@/ui/features/economy/transfers/transfer-automation-popup";
import { EntityType, ID, RelicRecipientType, StructureType } from "@bibliothecadao/types";
import { formatTime, toHexString } from "@bibliothecadao/eternum";
import { getAvatarUrl, usePlayerAvatar } from "@/hooks/use-player-avatar";

import { ActiveRelicEffects } from "../active-relic-effects";
import { CompactEntityInventory } from "../compact-entity-inventory";
import { useStructureEntityDetail } from "../hooks/use-structure-entity-detail";
import { EntityDetailLayoutVariant, EntityDetailSection } from "../layout";
import { StructureProductionPanel } from "../structure-production-panel";

interface StructureBannerEntityDetailProps {
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

const VillageTimerChip = ({ label, value, title }: { label: string; value: string; title?: string }) => (
  <div className="rounded border border-gold/15 bg-black/25 px-1.5 py-1" title={title}>
    <div className="text-[9px] uppercase tracking-[0.06em] leading-tight text-gold/65">{label}</div>
    <div className="mt-0.5 text-xs font-semibold leading-none text-gold">{value}</div>
  </div>
);

const StructureBannerEntityDetailContent = memo(
  ({
    structureEntityId,
    className,
    maxInventory = Infinity,
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
      hyperstructureRealmCount,
      isHyperstructure,
      isLoadingStructure,
    } = useStructureEntityDetail({ structureEntityId });
    const mode = useGameModeConfig();
    const { currentBlockTimestamp } = useBlockTimestamp();
    const openPopup = useUIStore((state) => state.openPopup);
    const isTransferPopupOpen = useUIStore((state) => state.isPopupOpen(TRANSFER_POPUP_NAME));
    const setTransferPanelSourceId = useUIStore((state) => state.setTransferPanelSourceId);

    const activeRelicIds = useMemo(() => relicEffects.map((effect) => Number(effect.id)), [relicEffects]);
    const ownerAddress =
      structure?.owner !== undefined && structure.owner !== null && structure.owner !== 0n
        ? toHexString(structure.owner)
        : null;
    const { data: ownerProfile } = usePlayerAvatar(ownerAddress ?? undefined);
    const ownerAvatarUrl =
      ownerAddress && ownerProfile
        ? getAvatarUrl(ownerAddress, ownerProfile.avatarUrl)
        : ownerAddress
          ? getAvatarUrl(ownerAddress, null)
          : null;

    const rawCategory = structure?.base?.category;
    const handleOpenTransferPopup = useCallback(() => {
      if (!structure?.entity_id) return;
      const entityId = Number(structure.entity_id);
      if (!Number.isFinite(entityId)) return;
      setTransferPanelSourceId(entityId);
      if (!isTransferPopupOpen) {
        openPopup(TRANSFER_POPUP_NAME);
      }
    }, [isTransferPopupOpen, openPopup, setTransferPanelSourceId, structure?.entity_id]);

    if (isLoadingStructure) {
      return (
        <div className="mt-2 flex h-full items-center justify-center">
          <Loader className="animate-spin" />
        </div>
      );
    }

    if (!structure || !structureDetails) return null;
    const defenseDisplayVariant: EntityDetailLayoutVariant = variant === "banner" || compact ? "banner" : "default";
    const structureName = mode.structure.getName(structure).name;
    const structureCategory =
      rawCategory === undefined || rawCategory === null ? undefined : (Number(rawCategory) as StructureType);
    const shouldRenderVillageTimers = structureCategory === StructureType.Village;
    const villageTimerSummary = shouldRenderVillageTimers
      ? buildVillageTimerSummary({
          createdAtTimestamp: structure.base?.created_at,
          currentBlockTimestamp,
        })
      : null;
    const militiaUnlockLabel = villageTimerSummary
      ? villageTimerSummary.militiaUnlockRemainingSeconds > 0
        ? formatTime(villageTimerSummary.militiaUnlockRemainingSeconds)
        : "Ready"
      : "—";
    const settlementImmunityLabel = villageTimerSummary
      ? villageTimerSummary.settlementImmunityRemainingSeconds > 0
        ? formatTime(villageTimerSummary.settlementImmunityRemainingSeconds)
        : "Expired"
      : "—";
    const postRaidWindowLabel = villageTimerSummary
      ? villageTimerSummary.postRaidImmunityWindowSeconds > 0
        ? formatTime(villageTimerSummary.postRaidImmunityWindowSeconds)
        : "Unavailable"
      : "—";
    const isFragmentMine = structureCategory === StructureType.FragmentMine;
    const isCamp = [StructureType.Village, StructureType.Camp].includes(structureCategory as StructureType);
    const showBalanceInline = isFragmentMine || isCamp;
    const showProductionTab = structureCategory !== StructureType.Hyperstructure && !isFragmentMine;
    const canOpenTransferPopup =
      isMine &&
      structureCategory !== undefined &&
      [StructureType.Realm, StructureType.Village, StructureType.Camp, StructureType.FragmentMine].includes(
        structureCategory as StructureType,
      ) &&
      typeof structure.entity_id !== "undefined";
    const inventoryLimit = compact && variant === "banner" ? Math.min(maxInventory, 10) : maxInventory;
    const labelTextClass = compact ? "text-xxs" : "text-xs";
    const headerTitleClass = compact ? "text-sm" : "text-base";
    const headerMetaClass = compact ? "text-xxs" : "text-xs";
    const ownerInitial = (ownerDisplayName || "?").charAt(0).toUpperCase();
    const isHyperstructureOwned = structure.owner !== undefined && structure.owner !== null && structure.owner !== 0n;
    const showHyperstructureVP = isHyperstructure && hyperstructureRealmCount !== undefined;

    return (
      <EntityDetailSection
        compact={compact}
        className={cn("flex h-full min-h-0 flex-col gap-1.5 overflow-hidden", className)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 text-gold">
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-gold/30 bg-black/40">
              {ownerAvatarUrl ? (
                <img className="h-full w-full object-cover" src={ownerAvatarUrl} alt={`${ownerDisplayName} avatar`} />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-gold/70">
                  {ownerInitial}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className={cn("truncate font-semibold text-gold", headerTitleClass)}>{ownerDisplayName}</p>
              </div>
              <div className="flex items-baseline gap-2">
                <span className={cn("truncate text-gold/80", headerMetaClass)}>{structureName}</span>
              </div>
            </div>
          </div>
          {canOpenTransferPopup && (
            <Button
              size="xs"
              variant="outline"
              forceUppercase={false}
              className="border-gold/30 bg-dark/40 text-gold hover:bg-dark/60 !px-2 !py-1 min-w-0"
              onClick={handleOpenTransferPopup}
              aria-label="Open transfer panel"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </Button>
          )}
        </div>

        {relicEffects.length > 0 && (
          <ActiveRelicEffects relicEffects={relicEffects} entityId={structureEntityId} compact />
        )}

        {shouldRenderVillageTimers && (
          <div className="rounded border border-gold/15 bg-black/30 px-2 py-1.5">
            <div className="text-[10px] uppercase tracking-[0.2em] text-gold/65">Village Intel</div>
            <div className="mt-1 grid grid-cols-3 gap-1">
              <VillageTimerChip label="Militia" value={militiaUnlockLabel} title="Militia unlock timer" />
              <VillageTimerChip
                label="Raid immunity"
                value={settlementImmunityLabel}
                title="Settlement raid immunity timer"
              />
              <VillageTimerChip
                label="Post-raid"
                value={postRaidWindowLabel}
                title="Post-raid resource immunity window"
              />
            </div>
          </div>
        )}

        <Tabs variant="inventory" className="flex min-h-0 flex-1 flex-col gap-2">
          <Tabs.Panels className="flex-1 min-h-0">
            <Tabs.Panel scrollable={false} className="flex h-full min-h-0 flex-col gap-1.5">
              {showHyperstructureVP && (
                <HyperstructureVPDisplay
                  realmCount={hyperstructureRealmCount}
                  isOwned={isHyperstructureOwned}
                  className="w-full"
                />
              )}
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

              {showBalanceInline && (
                <div className="flex flex-col gap-2">
                  <span className={cn(labelTextClass, "uppercase tracking-[0.25em] text-gold/70")}>Balance</span>
                  {resources ? (
                    <CompactEntityInventory
                      resources={resources}
                      activeRelicIds={activeRelicIds}
                      recipientType={RelicRecipientType.Structure}
                      entityId={structureEntityId}
                      entityType={EntityType.STRUCTURE}
                      allowRelicActivation={isMine}
                      variant="tight"
                      maxItems={inventoryLimit}
                    />
                  ) : (
                    <p className="text-xxs text-gold/60 italic">No resources stored.</p>
                  )}
                </div>
              )}
            </Tabs.Panel>

            {showProductionTab && (
              <Tabs.Panel scrollable={false} className="flex h-full min-h-0 flex-col gap-1.5 pt-1">
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
                    {isFragmentMine
                      ? `${mode.labels.fragmentMines} do not produce resources.`
                      : "Production data unavailable."}
                  </p>
                )}
              </Tabs.Panel>
            )}

            {!showBalanceInline && (
              <Tabs.Panel scrollable={false} className="flex h-full min-h-0 flex-col gap-1.5">
                {resources ? (
                  <CompactEntityInventory
                    resources={resources}
                    activeRelicIds={activeRelicIds}
                    recipientType={RelicRecipientType.Structure}
                    entityId={structureEntityId}
                    entityType={EntityType.STRUCTURE}
                    allowRelicActivation={isMine}
                    variant="tight"
                    maxItems={inventoryLimit}
                  />
                ) : (
                  <p className="text-xxs text-gold/60 italic">No resources stored.</p>
                )}
              </Tabs.Panel>
            )}
          </Tabs.Panels>

          <Tabs.List className="mt-auto flex w-full items-center justify-between gap-2">
            <Tabs.Tab className="!mx-0 flex min-h-11 flex-1 items-center justify-center rounded-lg border border-gold/30 bg-dark/40 px-3 text-center transition hover:bg-dark/60">
              <Shield className="h-4 w-4 text-gold" />
            </Tabs.Tab>
            {showProductionTab && (
              <Tabs.Tab className="!mx-0 flex min-h-11 flex-1 items-center justify-center rounded-lg border border-gold/30 bg-dark/40 px-3 text-center transition hover:bg-dark/60">
                <Factory className="h-4 w-4 text-gold" />
              </Tabs.Tab>
            )}
            {!showBalanceInline && (
              <Tabs.Tab className="!mx-0 flex min-h-11 flex-1 items-center justify-center rounded-lg border border-gold/30 bg-dark/40 px-3 text-center transition hover:bg-dark/60">
                <Coins className="h-4 w-4 text-gold" />
              </Tabs.Tab>
            )}
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
