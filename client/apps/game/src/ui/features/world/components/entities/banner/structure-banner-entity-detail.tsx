import ArrowLeftRight from "lucide-react/dist/esm/icons/arrow-left-right";
import Factory from "lucide-react/dist/esm/icons/factory";
import Loader from "lucide-react/dist/esm/icons/loader";
import Shield from "lucide-react/dist/esm/icons/shield";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import { memo, useCallback } from "react";

import Button from "@/ui/design-system/atoms/button";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { CompactDefenseDisplay } from "@/ui/features/military";
import { HUD_BODY, HUD_BODY_MUTED, HUD_HEADLINE } from "@/ui/design-system/atoms/hud-typography";
import { InfoBubble } from "../collapsible-bubble";
import { HyperstructureVPDisplay } from "@/ui/features/world/components/hyperstructures/hyperstructure-vp-display";
import { useGameModeConfig, useResolvedWorldGameMode } from "@/config/game-modes/use-game-mode-config";
import { useCurrentBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { buildVillageTimerSummary } from "@/ui/shared/lib/village-timers";
import { ID, StructureType } from "@bibliothecadao/types";
import { formatTime, toHexString } from "@bibliothecadao/eternum";
import { getAvatarUrl, usePlayerAvatar } from "@/hooks/use-player-avatar";
import { LeftView } from "@/types";

import { ActiveRelicEffects } from "../active-relic-effects";
import { useStructureEntityDetail } from "../hooks/use-structure-entity-detail";
import { EntityDetailLayoutVariant } from "../layout";
import { useStructureProductionSummary } from "../structure-production-summary";
import { MergedResourcePanel } from "@/ui/features/world/containers/left-facets/merged-resource-panel";
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
  <div className="rounded border border-gold/15 bg-black/25 px-1.5 py-1" title={title}>
    <div className="text-[9px] uppercase tracking-[0.06em] leading-tight text-gold/65">{label}</div>
    <div className="mt-0.5 text-xs font-semibold leading-none text-gold">{value}</div>
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
      hyperstructureRealmCount,
      isHyperstructure,
      isLoadingStructure,
    } = useStructureEntityDetail({ structureEntityId });
    const mode = useGameModeConfig();
    const resolvedWorldMode = useResolvedWorldGameMode();
    const isEternumMode = resolvedWorldMode === "eternum";
    const currentBlockTimestamp = useCurrentBlockTimestamp();
    const setLeftNavigationView = useUIStore((state) => state.setLeftNavigationView);
    const setLogisticsActiveTab = useUIStore((state) => state.setLogisticsActiveTab);
    const setTransferPanelSourceId = useUIStore((state) => state.setTransferPanelSourceId);

    const productionSummary = useStructureProductionSummary(structure, resources);
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
    const handleOpenTransferPanel = useCallback(() => {
      if (!structure?.entity_id) return;
      const entityId = Number(structure.entity_id);
      if (!Number.isFinite(entityId)) return;
      setTransferPanelSourceId(entityId);
      setLogisticsActiveTab("transfer");
      setLeftNavigationView(LeftView.ResourceArrivals);
    }, [setLeftNavigationView, setLogisticsActiveTab, setTransferPanelSourceId, structure?.entity_id]);

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
    const showFaithTab =
      isEternumMode &&
      rawCategory !== undefined &&
      [StructureType.Realm, StructureType.Village].includes(Number(rawCategory) as StructureType);
    const canOpenTransferPanel =
      isMine &&
      structureCategory !== undefined &&
      [StructureType.Realm, StructureType.Village, StructureType.Camp, StructureType.FragmentMine].includes(
        structureCategory as StructureType,
      ) &&
      typeof structure.entity_id !== "undefined";
    // The owner-bubble header transfer shortcut stays hidden to avoid
    // duplicating the Resources bubble cue (which is the primary affordance).
    const showTransferButton = false;
    const ownerInitial = (ownerDisplayName || "?").charAt(0).toUpperCase();
    const isHyperstructureOwned = structure.owner !== undefined && structure.owner !== null && structure.owner !== 0n;
    const showHyperstructureVP = isHyperstructure && hyperstructureRealmCount !== undefined;
    const occupiedGuardSlots = guards.filter((guard) => Number(guard.troops?.count ?? 0) > 0).length;
    const guardCue = guardSlotsMax !== undefined ? `${occupiedGuardSlots}/${guardSlotsMax}` : `${occupiedGuardSlots}`;
    const activeRelicIds = relicEffects.map((effect) => Number(effect.id));

    return (
      <div className={cn("flex min-w-0 flex-col gap-2", className)}>
        {/* Owner bubble — visible on the right-side tile inspector. Hidden on
            the LeftStructureColumn where the picker already names the
            structure being controlled. */}
        {!hideOwner && (
          <InfoBubble
            title={coordsLabel ?? ownerDisplayName ?? "Owner"}
            cue={coordsLabel ? headerAction : structureName}
            bodyClassName="pt-0"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2 text-gold">
                <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-gold/30 bg-black/40">
                  {ownerAvatarUrl ? (
                    <img
                      className="h-full w-full object-cover"
                      src={ownerAvatarUrl}
                      alt={`${ownerDisplayName} avatar`}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-gold/70">
                      {ownerInitial}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className={cn("truncate", HUD_HEADLINE)}>{ownerDisplayName}</p>
                  <span className={cn("block truncate", HUD_BODY)}>{structureName}</span>
                </div>
              </div>
              {showTransferButton && canOpenTransferPanel && (
                <Button
                  size="xs"
                  variant="outline"
                  forceUppercase={false}
                  className="border-gold/30 bg-dark/40 text-gold hover:bg-dark/60 !px-2 !py-1 min-w-0"
                  onClick={handleOpenTransferPanel}
                  aria-label="Open transfer panel"
                >
                  <ArrowLeftRight className="h-4 w-4" />
                </Button>
              )}
            </div>
            {showHyperstructureVP && (
              <div className="mt-2 border-t border-gold/15 pt-2">
                <HyperstructureVPDisplay
                  realmCount={hyperstructureRealmCount}
                  isOwned={isHyperstructureOwned}
                  className="w-full"
                />
              </div>
            )}
          </InfoBubble>
        )}

        {relicEffects.length > 0 && (
          <InfoBubble title="Active Relics" icon={Sparkles}>
            <ActiveRelicEffects relicEffects={relicEffects} entityId={structureEntityId} compact />
          </InfoBubble>
        )}

        {shouldRenderVillageTimers && (
          <InfoBubble title="Village Intel">
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
          </InfoBubble>
        )}

        {/* Guards — always shown for structures that can hold defenders. */}
        <InfoBubble title="Guards" icon={Shield} cue={guardCue}>
          {guards.length > 0 ? (
            <CompactDefenseDisplay
              troops={guards.map((army) => ({ slot: army.slot, troops: army.troops }))}
              slotsUsed={guardSlotsUsed}
              slotsMax={guardSlotsMax}
              structureId={Number(structure.entity_id ?? 0)}
              canManageDefense={isMine}
              variant={defenseDisplayVariant}
              hideSlotSummary
            />
          ) : (
            <p className={HUD_BODY_MUTED}>No defenders stationed.</p>
          )}
        </InfoBubble>

        {/* Merged production + balance — one token panel (like the Empire panel).
            Owners get a Transfer button (this realm as recipient) and the build
            "+" on each token. */}
        <InfoBubble
          title="Resources"
          icon={Factory}
          cue={
            canOpenTransferPanel ? (
              <button
                type="button"
                onClick={handleOpenTransferPanel}
                className="inline-flex items-center justify-center rounded-md border border-gold/40 bg-gold/10 p-1 text-gold transition hover:border-gold hover:bg-gold/20"
                title="Transfer resources from this structure"
                aria-label="Transfer resources from this structure"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
              </button>
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
            <p className={HUD_BODY_MUTED}>No resources stored.</p>
          )}
        </InfoBubble>

        {showFaithTab && (
          <InfoBubble title="Faith" icon={Sparkles}>
            <FaithDevotionActionPanel structureEntityId={structureEntityId} variant="tab" />
          </InfoBubble>
        )}
      </div>
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
