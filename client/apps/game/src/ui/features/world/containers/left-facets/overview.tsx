import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { LeftView } from "@/types";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import {
  HUD_BODY,
  HUD_BODY_MUTED,
  HUD_CUE,
  HUD_LABEL,
  HUD_VALUE,
} from "@/ui/design-system/atoms/hud-typography";
import { InfoBubble } from "@/ui/features/world/components/entities/collapsible-bubble";
import { useStructureEntityDetail } from "@/ui/features/world/components/entities/hooks/use-structure-entity-detail";
import { useStructureProductionSummary } from "@/ui/features/world/components/entities/structure-production-summary";
import { formatPopulationStatusLabel } from "@/ui/features/world/containers/structure-status";
import { ProductionModal } from "@/ui/features/settlement";
import { useBlitzRealmProvision } from "@/ui/modules/entity-details/hooks/use-blitz-realm-provision";
import { useStructureUpgrade } from "@/ui/modules/entity-details/hooks/use-structure-upgrade";
import { useRealmUpgradeAndProvision } from "@/ui/modules/entity-details/hooks/use-realm-upgrade-and-provision";
import { ID, StructureType } from "@bibliothecadao/types";
import Crown from "lucide-react/dist/esm/icons/crown";
import Lightbulb from "lucide-react/dist/esm/icons/lightbulb";
import { memo, useCallback, useMemo } from "react";
import { useDojo } from "@bibliothecadao/react";
import { useComponentValue } from "@dojoengine/react";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { buildSuggestions, type SuggestionDescriptor } from "./suggestion-engine";

interface OverviewFacetProps {
  structureEntityId: ID;
}

const SuggestionChip = ({ suggestion }: { suggestion: SuggestionDescriptor }) => {
  const Icon = suggestion.icon;
  const isPrimary = suggestion.emphasis === "primary";
  return (
    <button
      type="button"
      onClick={suggestion.onClick}
      disabled={suggestion.disabled}
      title={suggestion.reason}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition",
        isPrimary
          ? "border-gold/60 bg-gold/10 hover:border-gold hover:bg-gold/20 shadow-[0_0_10px_rgba(223,170,84,0.18)]"
          : "border-gold/20 bg-black/30 hover:border-gold/40 hover:bg-black/40",
        suggestion.disabled && "cursor-not-allowed opacity-60 hover:bg-transparent",
      )}
    >
      <Icon className={cn("h-4 w-4 flex-shrink-0", isPrimary ? "text-gold" : "text-gold/70")} />
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate", isPrimary ? HUD_VALUE : HUD_BODY)}>{suggestion.label}</span>
        {suggestion.reason && (
          <span className={cn("block truncate", HUD_BODY_MUTED, "not-italic text-gold/55")}>{suggestion.reason}</span>
        )}
      </span>
    </button>
  );
};

const StatusRow = ({ label, value, cue }: { label: string; value: string; cue?: string }) => (
  <div className="flex items-center justify-between gap-2 py-1">
    <span className={HUD_LABEL}>{label}</span>
    <span className={cn("flex items-center gap-1.5")}>
      <span className={HUD_VALUE}>{value}</span>
      {cue && <span className={HUD_CUE}>{cue}</span>}
    </span>
  </div>
);

export const OverviewFacet = memo(({ structureEntityId }: OverviewFacetProps) => {
  const { setup } = useDojo();
  const detail = useStructureEntityDetail({ structureEntityId });
  const currentDefaultTick = useCurrentDefaultTick();
  void currentDefaultTick; // used implicitly via summary hook
  const productionSummary = useStructureProductionSummary(detail.structure, detail.resources ?? undefined);

  const upgrade = useStructureUpgrade(structureEntityId);
  const provision = useBlitzRealmProvision(structureEntityId);
  const combined = useRealmUpgradeAndProvision(structureEntityId);

  const setLeftFacet = useUIStore((state) => state.setLeftFacet);
  const setLeftNavigationView = useUIStore((state) => state.setLeftNavigationView);
  const toggleModal = useUIStore((state) => state.toggleModal);

  const structureBuildings = useComponentValue(
    setup.components.StructureBuildings,
    structureEntityId ? getEntityIdFromKeys([BigInt(structureEntityId)]) : (undefined as never),
  );

  const populationCurrent = Number(structureBuildings?.population.current ?? 0);
  const populationMax = Number(structureBuildings?.population.max ?? 0);

  const occupiedGuardSlots = useMemo(
    () => detail.guards.filter((guard) => Number(guard.troops?.count ?? 0) > 0).length,
    [detail.guards],
  );

  const rawCategory = detail.structure?.base?.category;
  const structureCategory =
    rawCategory === undefined || rawCategory === null ? undefined : (Number(rawCategory) as StructureType);
  const isRealm = structureCategory === StructureType.Realm;

  const handleOpenProductionModal = useCallback(() => {
    if (!detail.structure?.entity_id) return;
    const id = Number(detail.structure.entity_id);
    if (!Number.isFinite(id)) return;
    toggleModal(<ProductionModal preSelectedRealmId={id} />);
  }, [detail.structure?.entity_id, toggleModal]);

  const suggestions = useMemo<SuggestionDescriptor[]>(() => {
    if (!detail.structure) return [];
    return buildSuggestions({
      isMine: detail.isMine,
      isRealm,
      canUpgrade: Boolean(upgrade?.canUpgrade && !upgrade.isUpgradeLocked),
      canProvision: Boolean(provision?.canProvision && !provision.isProvisionLocked),
      canUpgradeAndProvision: combined.canUpgradeAndProvision,
      nextLevelName: upgrade?.nextLevelName ?? null,
      isUpgradeOrProvisionPending:
        combined.isPending || Boolean(upgrade?.isUpgradeLoading) || Boolean(provision?.isProvisionLoading),
      occupiedGuardSlots,
      guardSlotsMax: detail.guardSlotsMax ?? 0,
      productionActive: productionSummary.activeProductionBuildings,
      productionTotal: productionSummary.totalProductionBuildings,
      hasPausedProduction:
        productionSummary.totalProductionBuildings > 0 &&
        productionSummary.activeProductionBuildings < productionSummary.totalProductionBuildings,
      populationCurrent,
      populationMax,
      onUpgradeAndProvision: () => void combined.handleUpgradeAndProvision(),
      onUpgrade: () => upgrade?.handleUpgrade && void upgrade.handleUpgrade(),
      onProvision: () => provision?.handleProvision && void provision.handleProvision(),
      onOpenMilitary: () => setLeftFacet("military"),
      onOpenEconomy: () => setLeftFacet("economy"),
      onOpenConstruction: () => setLeftNavigationView(LeftView.ConstructionView),
      onOpenProductionModal: handleOpenProductionModal,
    });
  }, [
    combined,
    detail.guardSlotsMax,
    detail.isMine,
    detail.structure,
    handleOpenProductionModal,
    isRealm,
    occupiedGuardSlots,
    populationCurrent,
    populationMax,
    productionSummary.activeProductionBuildings,
    productionSummary.totalProductionBuildings,
    provision,
    setLeftFacet,
    setLeftNavigationView,
    upgrade,
  ]);

  if (!detail.structure) return null;

  const levelLabel = upgrade?.currentLevelName ?? `Level ${detail.structure.base?.level ?? 0}`;
  const populationLabel = formatPopulationStatusLabel(populationCurrent, populationMax);
  const productionCue =
    productionSummary.totalProductionBuildings > 0
      ? `${productionSummary.activeProductionBuildings}/${productionSummary.totalProductionBuildings}`
      : "—";
  const guardCue =
    detail.guardSlotsMax !== undefined ? `${occupiedGuardSlots}/${detail.guardSlotsMax}` : `${occupiedGuardSlots}`;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <InfoBubble title="Status" icon={Crown}>
        <div className="flex flex-col">
          <StatusRow label="Level" value={levelLabel} />
          <StatusRow label="Population" value={populationLabel} />
          <StatusRow label="Guards" value={guardCue} />
          <StatusRow label="Production" value={productionCue} />
        </div>
      </InfoBubble>

      <InfoBubble title="Suggested actions" icon={Lightbulb} cue={`${suggestions.length}`}>
        {suggestions.length === 0 ? (
          <p className={HUD_BODY_MUTED}>No suggestions right now — looking healthy.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {suggestions.map((suggestion) => (
              <SuggestionChip key={suggestion.id} suggestion={suggestion} />
            ))}
          </div>
        )}
      </InfoBubble>
    </div>
  );
});

OverviewFacet.displayName = "OverviewFacet";
