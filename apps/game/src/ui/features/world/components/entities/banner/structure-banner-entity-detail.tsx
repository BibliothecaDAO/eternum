import { Icon as SemanticIcon } from "@/ui/design-system/icon";

import { IncomingCaravans } from "./incoming-caravans";
import { StructureOwnershipTransfer } from "./structure-ownership-transfer";
import { memo, useCallback } from "react";

import { cn } from "@/ui/design-system/atoms/lib/utils";
import { CompactDefenseDisplay } from "@/ui/features/military";
import { HudIconButton, HudPanel, HudPortrait } from "@/ui/design-system/kit/hud-elements";
import { HyperstructureVPDisplay } from "@/ui/features/world/components/hyperstructures/hyperstructure-vp-display";
import { HyperstructureConstruction } from "@/ui/features/world/components/hyperstructures/hyperstructure-construction";
import { useGameModeConfig, useResolvedWorldGameMode } from "@/config/game-modes/use-game-mode-config";
import { useCurrentBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { openTransfer } from "@/ui/features/economy/transfers/transfer-window";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { buildVillageTimerSummary } from "@/ui/shared/lib/village-timers";
import { ID, StructureType, formatWait } from "@bibliothecadao/types";
import { configManager, toHexString } from "@bibliothecadao/eternum";
import { safeInteger } from "@bibliothecadao/eternum/game-client";
import { playerAvatarUrl } from "@/hooks/use-player-profile";
import { LeftView } from "@/types";

import { ActiveRelicEffects } from "../active-relic-effects";
import { useStructureEntityDetail } from "../hooks/use-structure-entity-detail";
import { EntityDetailLayoutVariant } from "../layout";
import { useStructureProductionSummary } from "../structure-production-summary";
import { MergedResourcePanel } from "@/ui/features/world/containers/left-facets/merged-resource-panel";
import { BitcoinMiningActionPanel } from "../../actions/bitcoin-mining-action-panel";
import { FaithDevotionActionPanel } from "../../actions/faith-devotion-action-panel";

interface StructureBannerEntityDetailProps {
  structureEntityId: ID;
  className?: string;
  compact?: boolean;
  maxInventory?: number;
  showButtons?: boolean;
  layoutVariant?: EntityDetailLayoutVariant;
  /**
   * Skip the owner bubble (avatar / player name / structure name / transfer
   * shortcut). Used on the LeftStructureColumn where the picker pill already
   * names the active structure — the owner header would otherwise duplicate
   * it.
   */
  hideOwner?: boolean;
  /**
   * Optional thin "STRUCTURE TILE · (col, row)"-style label rendered as a small
   * band above the avatar in the owner bubble. Set by the right-side tile
   * inspector so we don't need a second header bubble above this one.
   */
  coordsLabel?: string;
  /**
   * Optional action rendered to the right of {@link coordsLabel} (typically the
   * Re-sync button surfaced by the right-side inspector). Without a coordsLabel
   * the action is ignored.
   */
  headerAction?: React.ReactNode;
}

interface StructureBannerEntityDetailContentProps extends Omit<StructureBannerEntityDetailProps, "layoutVariant"> {
  variant: EntityDetailLayoutVariant;
}

const VillageTimerChip = ({ label, value, title }: { label: string; value: string; title?: string }) => (
  <div className="rounded border border-hud-divider bg-hud-well px-1.5 py-1" title={title}>
    <div className="text-hud-label text-hud-muted">{label}</div>
    <div className="mt-0.5 text-hud-label leading-none text-hud-ink">{value}</div>
  </div>
);

const StructureBannerEntityDetailContent = memo(
  ({
    structureEntityId,
    className,
    compact = true,
    variant,
    hideOwner = false,
    coordsLabel,
    headerAction,
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
      hyperstructureRate,
      isHyperstructure,
      isLoadingStructure,
    } = useStructureEntityDetail({ structureEntityId });
    const mode = useGameModeConfig();
    const resolvedWorldMode = useResolvedWorldGameMode();
    const isEternumMode = resolvedWorldMode === "eternum";
    const currentBlockTimestamp = useCurrentBlockTimestamp();
    const setLeftNavigationView = useUIStore((state) => state.setLeftNavigationView);

    const productionSummary = useStructureProductionSummary(structure, resources);
    const ownerAddress =
      structure?.owner !== undefined && structure.owner !== null && structure.owner !== 0n
        ? toHexString(structure.owner)
        : null;
    const ownerAvatarUrl = ownerAddress ? playerAvatarUrl(ownerAddress) : null;

    const rawCategory = structure?.base?.category;
    const handleOpenTransferPanel = useCallback(() => {
      if (!structure?.entity_id) return;
      openTransfer({ sourceId: safeInteger(structure.entity_id), destinationIds: [] });
    }, [structure?.entity_id]);

    if (isLoadingStructure) {
      return (
        <div className="mt-2 flex h-full items-center justify-center">
          <SemanticIcon name="refresh" className="animate-spin" />
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
        ? formatWait(villageTimerSummary.militiaUnlockRemainingSeconds)
        : "Ready"
      : "—";
    const settlementImmunityLabel = villageTimerSummary
      ? villageTimerSummary.settlementImmunityRemainingSeconds > 0
        ? formatWait(villageTimerSummary.settlementImmunityRemainingSeconds)
        : "Expired"
      : "—";
    const postRaidWindowLabel = villageTimerSummary
      ? villageTimerSummary.postRaidImmunityWindowSeconds > 0
        ? formatWait(villageTimerSummary.postRaidImmunityWindowSeconds)
        : "Unavailable"
      : "—";
    const showFaithTab =
      isEternumMode &&
      rawCategory !== undefined &&
      [StructureType.Realm, StructureType.Village].includes(Number(rawCategory) as StructureType);
    const canOpenTransferPanel =
      isMine &&
      configManager.isCommandEnabled("SendResources") &&
      structureCategory !== undefined &&
      [StructureType.Realm, StructureType.Village, StructureType.Camp, StructureType.Mine].includes(
        structureCategory as StructureType,
      ) &&
      typeof structure.entity_id !== "undefined";
    const ownerInitial = (ownerDisplayName || "?").charAt(0).toUpperCase();
    const showHyperstructureVP = isHyperstructure && hyperstructureRate !== undefined;
    const occupiedGuardSlots = guards?.filter((guard) => guard.troops.count > 0n).length;
    const guardCue =
      occupiedGuardSlots === undefined
        ? "—"
        : guardSlotsMax !== undefined
          ? `${occupiedGuardSlots}/${guardSlotsMax}`
          : `${occupiedGuardSlots}`;
    const activeRelicIds = relicEffects.map((effect) => Number(effect.id));

    return (
      <HudPanel className={cn("min-w-0", className)} divided bodyClassName="flex flex-col">
        <IncomingCaravans structureId={structureEntityId} isOwner={isMine} />
        {/* Owner bubble — visible on the right-side tile inspector. Hidden on
            the LeftStructureColumn where the picker already names the
            structure being controlled. */}
        {!hideOwner && (
          <HudPanel
            kind="section"
            title={coordsLabel ?? ownerDisplayName ?? "Owner"}
            cue={coordsLabel ? headerAction : structureName}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2 text-hud-ink">
                {ownerAvatarUrl ? (
                  <HudPortrait src={ownerAvatarUrl} label={`${ownerDisplayName} avatar`} />
                ) : (
                  <HudPortrait initial={ownerInitial} label={ownerDisplayName ?? "Unknown"} />
                )}
                <div className="min-w-0">
                  <p className="truncate text-hud-title text-hud-ink">{ownerDisplayName}</p>
                  <span className="block truncate text-hud-body text-hud-ink">{structureName}</span>
                </div>
              </div>
            </div>
            <StructureOwnershipTransfer key={structureEntityId} structureId={structureEntityId} />
            {showHyperstructureVP && (
              <div className="mt-2 border-t border-hud-divider pt-2">
                <HyperstructureVPDisplay rate={hyperstructureRate} className="w-full" />
              </div>
            )}
          </HudPanel>
        )}

        {isEternumMode && isHyperstructure && (
          <HyperstructureConstruction key={structureEntityId} entityId={structureEntityId} />
        )}

        {relicEffects.length > 0 && (
          <HudPanel kind="section" title="Active Relics" icon={"relics" as const}>
            <ActiveRelicEffects relicEffects={relicEffects} entityId={structureEntityId} />
          </HudPanel>
        )}

        {shouldRenderVillageTimers && (
          <HudPanel kind="section" title="Village Intel">
            <div className="grid grid-cols-3 gap-1">
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
          </HudPanel>
        )}

        {/* Guards — always shown for structures that can hold defenders. */}
        <HudPanel kind="section" title="Guards" icon={"defend" as const} cue={guardCue}>
          {guards === undefined ? (
            <p className="text-hud-body text-hud-muted">Loading guards…</p>
          ) : guards.length > 0 ? (
            <CompactDefenseDisplay
              troops={guards}
              slotsUsed={guardSlotsUsed}
              slotsMax={guardSlotsMax}
              structureId={safeInteger(structure.entity_id)}
              canManageDefense={isMine}
              variant={defenseDisplayVariant}
              hideSlotSummary
            />
          ) : (
            <p className="text-hud-body text-hud-muted">No defenders stationed.</p>
          )}
        </HudPanel>

        {/* Merged production + balance — one token panel (like the Empire panel).
            Owners get a Transfer button (this realm as recipient) and the build
            "+" on each token. */}
        <HudPanel
          kind="section"
          title="Resources"
          icon={"production" as const}
          cue={
            canOpenTransferPanel ? (
              <HudIconButton
                icon="swap"
                label="Transfer resources from this structure"
                title="Transfer resources from this structure"
                size="sm"
                onClick={handleOpenTransferPanel}
              />
            ) : undefined
          }
        >
          {resources ? (
            <MergedResourcePanel
              structureEntityId={structureEntityId}
              resources={resources}
              productionSummary={productionSummary}
              canBuild={false}
              isMine={isMine}
              activeRelicIds={activeRelicIds}
            />
          ) : (
            <p className="text-hud-body text-hud-muted">No resources stored.</p>
          )}
        </HudPanel>

        <BitcoinMiningActionPanel structureEntityId={structureEntityId} />

        {showFaithTab && (
          <HudPanel kind="section" title="Faith" icon={"relics" as const}>
            <FaithDevotionActionPanel structureEntityId={structureEntityId} />
          </HudPanel>
        )}
      </HudPanel>
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
    hideOwner = false,
    coordsLabel,
    headerAction,
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
        hideOwner={hideOwner}
        coordsLabel={coordsLabel}
        headerAction={headerAction}
      />
    );
  },
);

StructureBannerEntityDetail.displayName = "StructureBannerEntityDetail";
