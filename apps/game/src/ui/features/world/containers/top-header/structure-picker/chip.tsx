import { useUIStore } from "@/hooks/store/use-ui-store";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { useBlitzRealmProvision } from "@/ui/modules/entity-details/hooks/use-blitz-realm-provision";
import { useRealmUpgradeAndProvision } from "@/ui/modules/entity-details/hooks/use-realm-upgrade-and-provision";
import { formatIncomingEta, useStructureUpgrade } from "@/ui/modules/entity-details/hooks/use-structure-upgrade";
import {
  formatPopulationStatusLabel,
  formatUsedBuildingTilesLabel,
} from "@/ui/features/world/containers/structure-status";
import {
  STRUCTURE_GROUP_CONFIG,
  type StructureGroupColor,
} from "@/ui/features/world/containers/top-header/structure-groups";
import { resolveStructureUiCapabilities } from "@/ui/lib/structure-capabilities";
import { configManager } from "@bibliothecadao/eternum";
import { getLevelName, ID, RealmLevels, ResourcesIds, type Structure, StructureType } from "@bibliothecadao/types";
import clsx from "clsx";
import ChevronUp from "lucide-react/dist/esm/icons/chevron-up";
import ChevronsUp from "lucide-react/dist/esm/icons/chevrons-up";
import Hexagon from "lucide-react/dist/esm/icons/hexagon";
import Info from "lucide-react/dist/esm/icons/info";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check";
import Pickaxe from "lucide-react/dist/esm/icons/pickaxe";
import Star from "lucide-react/dist/esm/icons/star";
import Users from "lucide-react/dist/esm/icons/users";
import type { LucideIcon } from "lucide-react";
import { memo, useCallback, type KeyboardEvent, type MouseEvent } from "react";
import { resolveRealmBootstrapErrorMessage } from "@/ui/modules/entity-details/hooks/realm-bootstrap-error";

export type StructureWithMetadata = Structure & {
  displayName: string;
  originalName: string;
  realmLevel: number;
  realmLevelLabel: string | null;
  population: number;
  populationCapacity: number;
  buildingTilesOccupied: number | null;
  buildingTilesTotal: number | null;
  groupColor: StructureGroupColor | null;
  isFavorite: boolean;
  canUpgrade: boolean;
  /**
   * Cheap empire-wide signal: this realm is in blitz, owned by the player,
   * main phase has started, season hasn't ended, and the provision building
   * has not been registered yet. Drives both the left-rail suggestion engine
   * and the modal-sidebar attention dots without a per-structure request.
   */
  canProvision: boolean;
  /**
   * Per-building-type counts read off StructureBuildings.packed_counts_*. Used
   * by the suggestion engine to recommend construction targets (wheat farms,
   * resource farms, worker huts) without extra read calls.
   */
  buildingCounts: {
    wheat: number;
    wood: number;
    coal: number;
    copper: number;
    crossbowmanT1: number;
    knightT1: number;
    market: number;
    paladinT1: number;
    workerHut: number;
  };
};

const StructureInfoStat = ({ icon: Icon, label, title }: { icon: LucideIcon; label: string; title: string }) => (
  <span
    className="inline-flex items-center gap-1 rounded border border-gold/15 bg-black/25 px-1.5 py-0.5 text-xxs text-gold/75"
    title={title}
  >
    <Icon className="h-3 w-3 text-gold/60" />
    <span>{label}</span>
  </span>
);

const StructureStatusStats = ({
  populationLabel,
  buildingTilesLabel,
}: {
  populationLabel: string;
  buildingTilesLabel: string | null;
}) => (
  <div className="flex flex-wrap items-center gap-1.5">
    <StructureInfoStat icon={Users} label={populationLabel} title="Population used / capacity" />
    {buildingTilesLabel ? (
      <StructureInfoStat icon={Hexagon} label={buildingTilesLabel} title="Used / total building tiles" />
    ) : null}
  </div>
);

type StructureRealmActionsProps = {
  structureEntityId: ID | null;
  className?: string;
};

export const StructureRealmActions = ({ structureEntityId, className }: StructureRealmActionsProps) => {
  const entityIdOrNull = typeof structureEntityId === "number" ? structureEntityId : null;
  const upgradeInfo = useStructureUpgrade(entityIdOrNull);
  const provisionInfo = useBlitzRealmProvision(entityIdOrNull);
  const bootstrapInfo = useRealmUpgradeAndProvision(entityIdOrNull);
  const setTooltip = useUIStore((state) => state.setTooltip);

  if (!upgradeInfo) {
    return null;
  }

  const currentLevel = upgradeInfo.currentLevel ?? 0;
  const maxLevel = configManager.getMaxLevel(StructureType.Realm);
  const isAtMaxLevel = upgradeInfo.isMaxLevel || currentLevel >= maxLevel;
  const meetsRequirements = (upgradeInfo.missingRequirements?.length ?? 0) === 0;
  const canUpgrade = upgradeInfo.isOwner && !isAtMaxLevel && meetsRequirements;
  const isDisabled = !canUpgrade || upgradeInfo.isUpgradeLocked || isAtMaxLevel;
  const shouldGlow = canUpgrade && !isDisabled;
  const nextLevel = upgradeInfo.nextLevel ?? 0;

  // Inline requirements memo — recomputed on each render of this component, fine for tooltip content.
  const requirementsContent = (() => {
    if (upgradeInfo.isMaxLevel) {
      return <div className="text-xs text-gold/80">Castle fully upgraded.</div>;
    }
    if (!upgradeInfo.requirements?.length) {
      return <div className="text-xs text-gold/80">No upgrade requirements found.</div>;
    }

    return (
      <div className="min-w-[220px] space-y-2 text-gold">
        <div className="flex items-center justify-between">
          <span className="text-xxs uppercase tracking-[0.25em] text-gold/60">Upgrade</span>
          {upgradeInfo.nextLevelName && <span className="text-xxs text-gold/80">to {upgradeInfo.nextLevelName}</span>}
        </div>
        <div className="space-y-1">
          {upgradeInfo.requirements.map((req) => {
            const isMet = req.current >= req.amount;
            return (
              <div
                key={`${req.resource}-${req.amount}`}
                className={clsx(
                  "rounded border px-2 py-1",
                  isMet ? "border-gold/20 bg-gold/5" : "border-red-400/40 bg-red-500/5",
                )}
              >
                <div className="flex items-center gap-2">
                  <ResourceIcon resource={ResourcesIds[req.resource]} size="xs" withTooltip={false} />
                  <span className="flex-1 text-xs text-gold/80">{ResourcesIds[req.resource]}</span>
                  <span className={clsx("text-xs font-semibold", isMet ? "text-gold" : "text-red-300")}>
                    {Math.floor(req.current).toLocaleString()} / {req.amount.toLocaleString()}
                  </span>
                </div>
                {req.incoming && (
                  <div className="pl-6 text-xxs text-emerald-300/90">
                    +{Math.floor(req.incoming.amount).toLocaleString()} in transit,{" "}
                    {formatIncomingEta(req.incoming.etaSeconds)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  })();

  const showRequirementsTooltip = (event: MouseEvent<HTMLButtonElement>) => {
    if (!requirementsContent) return;
    setTooltip({
      anchorElement: event.currentTarget,
      position: "bottom",
      content: requirementsContent,
    });
  };

  const hideRequirementsTooltip = () => setTooltip(null);

  const renderIcon = () => {
    if (isAtMaxLevel) {
      return <ShieldCheck className="h-3.5 w-3.5" />;
    }
    if (nextLevel >= 3) {
      return (
        <span className="relative flex h-4 w-4 items-center justify-center">
          <ChevronUp className="absolute h-3 w-3 -translate-y-[6px]" />
          <ChevronUp className="absolute h-3 w-3" />
          <ChevronUp className="absolute h-3 w-3 translate-y-[6px]" />
        </span>
      );
    }
    if (nextLevel === 2) {
      return <ChevronsUp className="h-3.5 w-3.5" />;
    }
    return <ChevronUp className="h-3.5 w-3.5" />;
  };

  const handleUpgrade = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (isDisabled) return;

    void upgradeInfo.handleUpgrade().catch((error) => {
      console.error("Failed to upgrade structure", error);
    });
  };

  // Bootstrap mode: the pickaxe provisions the realm (and bundles the first
  // level-up when already affordable) in one tx. Enabled as soon as provisioning
  // is possible — provision grants the economy a fresh realm needs before it can
  // ever afford an upgrade, so gating on canProvision (not canUpgrade) is what
  // lets players actually start. Falls back to the plain Level Up button once
  // provisioned (needsBootstrap flips false).
  const isBootstrapMode = Boolean(provisionInfo?.needsBootstrap);
  const isBootstrapDisabled = !bootstrapInfo.canProvision || bootstrapInfo.isPending || upgradeInfo.isUpgradeLoading;
  const shouldGlowBootstrap = bootstrapInfo.canProvision && !isBootstrapDisabled;
  const isBootstrapLoading =
    bootstrapInfo.isPending || upgradeInfo.isUpgradeLoading || Boolean(provisionInfo?.isProvisionLoading);

  const handleBootstrap = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (isBootstrapDisabled) return;

    void bootstrapInfo.handleUpgradeAndProvision().catch((error) => {
      console.warn("realm_bootstrap_failed", { message: resolveRealmBootstrapErrorMessage(error) });
    });
  };

  return (
    <div className={clsx("flex items-center gap-2", className)}>
      {isBootstrapMode ? (
        <button
          type="button"
          onClick={handleBootstrap}
          disabled={isBootstrapDisabled}
          className={clsx(
            "inline-flex items-center justify-center rounded-md border px-2 py-1 text-xxs font-semibold uppercase tracking-wide transition",
            shouldGlowBootstrap
              ? "border-gold/60 bg-gold/10 text-gold hover:bg-gold/25 shadow-[0_0_12px_rgba(255,204,102,0.55)] animate-pulse"
              : "border-gold/20 bg-black/30 text-gold/50 cursor-not-allowed",
          )}
          aria-label="Provision realm"
          title="Provision realm"
        >
          {isBootstrapLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pickaxe className="h-3.5 w-3.5" />}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleUpgrade}
          disabled={isDisabled}
          className={clsx(
            "inline-flex items-center justify-center rounded-md border px-2 py-1 text-xxs font-semibold uppercase tracking-wide transition",
            shouldGlow
              ? "border-gold/60 bg-gold/10 text-gold hover:bg-gold/25 shadow-[0_0_12px_rgba(255,204,102,0.55)] animate-pulse"
              : "border-gold/20 bg-black/30 text-gold/50 cursor-not-allowed",
          )}
          aria-label="Level up realm"
        >
          {upgradeInfo.isUpgradeLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : renderIcon()}
        </button>
      )}
      <button
        type="button"
        onMouseEnter={showRequirementsTooltip}
        onMouseLeave={hideRequirementsTooltip}
        onFocus={showRequirementsTooltip as never}
        onBlur={hideRequirementsTooltip}
        onClick={(event) => event.stopPropagation()}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-gold/30 bg-black/40 text-gold/70 hover:text-gold focus:outline-none focus:ring-1 focus:ring-gold/40"
        aria-label="View upgrade requirements"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

type StructureChipProps = {
  structure: StructureWithMetadata;
  isSelected: boolean;
  onSelectStructure: (entityId: ID) => void;
  onToggleFavorite: (entityId: ID) => void;
};

const StructureChip = memo(({ structure, isSelected, onSelectStructure, onToggleFavorite }: StructureChipProps) => {
  const structureCapabilities = resolveStructureUiCapabilities(structure.structure);
  const hasPopulationDetails = structureCapabilities.hasPopulationDetails;
  const levelAbbrev = hasPopulationDetails
    ? getLevelName(
        Math.min(Math.max(structure.realmLevel, RealmLevels.Settlement), RealmLevels.Empire) as RealmLevels,
      ).charAt(0)
    : null;

  const populationStatusLabel = hasPopulationDetails
    ? formatPopulationStatusLabel(structure.population, structure.populationCapacity)
    : null;
  const buildingTilesStatusLabel =
    hasPopulationDetails && structure.buildingTilesOccupied !== null && structure.buildingTilesTotal !== null
      ? formatUsedBuildingTilesLabel(structure.buildingTilesOccupied, structure.buildingTilesTotal)
      : null;

  const handleClick = useCallback(() => onSelectStructure(structure.entityId), [onSelectStructure, structure.entityId]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleClick();
      }
    },
    [handleClick],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={clsx(
        "group flex w-full items-center gap-1.5 rounded-md border px-2 py-2 text-left text-xs transition cursor-pointer",
        isSelected
          ? "border-gold bg-gold/15 text-gold"
          : "border-gold/25 bg-black/30 text-gold/75 hover:border-gold/50 hover:bg-black/50",
      )}
      title={structure.displayName}
      aria-pressed={isSelected}
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggleFavorite(structure.entityId);
        }}
        className="shrink-0 rounded p-0.5 text-gold/60 hover:text-gold"
        title={structure.isFavorite ? "Remove from favorites" : "Favorite structure"}
        aria-label={structure.isFavorite ? "Remove from favorites" : "Favorite structure"}
      >
        <Star className={clsx("h-3.5 w-3.5", structure.isFavorite ? "fill-current text-gold" : "text-gold/60")} />
      </button>
      {structure.groupColor && (
        <span
          className={clsx(
            "h-1.5 w-1.5 shrink-0 rounded-full",
            STRUCTURE_GROUP_CONFIG[structure.groupColor]?.dotClass ?? "",
          )}
        />
      )}
      <span
        className={clsx(
          "min-w-0 flex-1 truncate font-semibold",
          structure.groupColor ? (STRUCTURE_GROUP_CONFIG[structure.groupColor]?.textClass ?? "text-gold") : undefined,
        )}
      >
        {structure.displayName}
      </span>
      {levelAbbrev && (
        <span className="shrink-0 rounded-sm bg-black/30 px-1 text-[9px] uppercase tracking-wide text-gold/60">
          {levelAbbrev}
        </span>
      )}
      {populationStatusLabel && (
        <StructureStatusStats populationLabel={populationStatusLabel} buildingTilesLabel={buildingTilesStatusLabel} />
      )}
      {structure.category === StructureType.Realm && (
        <StructureRealmActions structureEntityId={structure.entityId} className="shrink-0" />
      )}
    </div>
  );
});

StructureChip.displayName = "StructureChip";
