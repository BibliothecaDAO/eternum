import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { useTooltipStore } from "@/hooks/store/use-tooltip-store";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { useRealmLevelUp } from "@/ui/modules/entity-details/hooks/use-realm-level-up";
import { formatIncomingEta } from "@/ui/modules/entity-details/hooks/use-structure-upgrade";
import {
  formatPopulationStatusLabel,
  formatUsedBuildingTilesLabel,
} from "@/ui/features/world/containers/structure-status";
import {
  STRUCTURE_GROUP_CONFIG,
  type StructureGroupColor,
} from "@/ui/features/world/containers/top-header/structure-groups";
import { resolveStructureUiCapabilities } from "@/ui/lib/structure-capabilities";
import { getLevelName, ID, RealmLevels, ResourcesIds, type Structure, StructureType } from "@bibliothecadao/types";
import clsx from "clsx";

import { memo, useCallback, type KeyboardEvent, type MouseEvent } from "react";

export type StructureWithMetadata = Structure & {
  displayName: string;
  originalName: string;
  realmLevel: number;
  realmLevelLabel: string | null;
  population: number;
  guardCount: number | undefined;
  /** Field armies alive today; an army from an earlier expedition day is dead by rule and never counts. */
  explorerCount: number;
  populationCapacity: number;
  buildingTilesOccupied: number | null;
  buildingTilesTotal: number | null;
  groupColor: StructureGroupColor | null;
  isFavorite: boolean;
  canUpgrade: boolean;
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

const StructureInfoStat = ({ icon: Icon, label, title }: { icon: IconMeaning; label: string; title: string }) => (
  <span
    className="inline-flex items-center gap-1 rounded border border-gold/15 bg-black/25 px-1.5 py-0.5 text-xxs text-gold/75"
    title={title}
  >
    <SemanticIcon name={Icon} className="h-3 w-3 text-gold/60" />
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
    <StructureInfoStat icon={"people" as const} label={populationLabel} title="Population used / capacity" />
    {buildingTilesLabel ? (
      <StructureInfoStat icon={"hexagon" as const} label={buildingTilesLabel} title="Used / total building tiles" />
    ) : null}
  </div>
);

type StructureRealmActionsProps = {
  structureEntityId: ID | null;
  className?: string;
};

/**
 * The realm's level-up step beside its chip: one button that provisions a fresh Blitz realm or levels it up, as the
 * realm's own step says (useRealmLevelUp), with its requirements a hover away. The button says why it waits.
 */
export const StructureRealmActions = ({ structureEntityId, className }: StructureRealmActionsProps) => {
  const step = useRealmLevelUp(typeof structureEntityId === "number" ? structureEntityId : null);
  const setTooltip = useTooltipStore((state) => state.setTooltip);

  if (!step) {
    return null;
  }

  const requirementsContent = (() => {
    if (step.mode === "max") {
      return <div className="text-xs text-gold/80">Castle fully upgraded.</div>;
    }
    if (!step.requirements?.length) {
      return <div className="text-xs text-gold/80">No upgrade requirements found.</div>;
    }

    return (
      <div className="min-w-[220px] space-y-2 text-gold">
        <div className="flex items-center justify-between">
          <span className="text-xxs uppercase tracking-[0.25em] text-gold/60">Upgrade</span>
          {step.nextLevelName && <span className="text-xxs text-gold/80">to {step.nextLevelName}</span>}
        </div>
        <div className="space-y-1">
          {step.requirements.map((req) => {
            const isMet = req.current !== undefined && req.current >= req.amount;
            return (
              <div
                key={`${req.resource}-${req.amount}`}
                className={clsx(
                  "rounded border px-2 py-1",
                  isMet ? "border-gold/20 bg-gold/5" : "border-red-400/40 bg-red-500/5",
                )}
              >
                <div className="flex items-center gap-2">
                  <ResourceIcon resource={req.resource} size="xs" withTooltip={false} />
                  <span className="flex-1 text-xs text-gold/80">{ResourcesIds[req.resource]}</span>
                  <span className={clsx("text-xs font-semibold", isMet ? "text-gold" : "text-red-300")}>
                    {req.current === undefined ? "—" : Math.floor(req.current).toLocaleString()} /{" "}
                    {req.amount.toLocaleString()}
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
    setTooltip({
      anchorElement: event.currentTarget,
      position: "bottom",
      content: requirementsContent,
    });
  };

  const hideRequirementsTooltip = () => setTooltip(null);

  const renderIcon = () => {
    if (step.loading) return <SemanticIcon name="refresh" className="h-3.5 w-3.5 animate-spin" />;
    if (step.mode === "max") return <SemanticIcon name="defend" className="h-3.5 w-3.5" />;
    if (step.mode === "provision") return <SemanticIcon name="pickaxe" className="h-3.5 w-3.5" />;
    if (step.nextLevel >= 3) {
      return (
        <span className="relative flex h-4 w-4 items-center justify-center">
          <SemanticIcon name="chevron-up" className="absolute h-3 w-3 -translate-y-[6px]" />
          <SemanticIcon name="chevron-up" className="absolute h-3 w-3" />
          <SemanticIcon name="chevron-up" className="absolute h-3 w-3 translate-y-[6px]" />
        </span>
      );
    }
    if (step.nextLevel === 2) return <SemanticIcon name="chevron-up" className="h-3.5 w-3.5" />;
    return <SemanticIcon name="chevron-up" className="h-3.5 w-3.5" />;
  };

  const takeStep = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    step.run();
  };

  return (
    <div className={clsx("flex items-center gap-2", className)}>
      <button
        type="button"
        onClick={takeStep}
        disabled={!step.ready}
        className={clsx(
          "inline-flex items-center justify-center rounded-md border px-2 py-1 text-xxs font-semibold uppercase tracking-wide transition",
          step.ready
            ? "border-gold/60 bg-gold/10 text-gold hover:bg-gold/25 shadow-[0_0_12px_rgba(255,204,102,0.55)] animate-pulse"
            : "border-gold/20 bg-black/30 text-gold/50 cursor-not-allowed",
        )}
        aria-label={step.word}
        title={step.refusal ?? step.word}
      >
        {renderIcon()}
      </button>
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
        <SemanticIcon name="info" className="h-3.5 w-3.5" />
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
        <SemanticIcon
          name="star"
          className={clsx("h-3.5 w-3.5", structure.isFavorite ? "opacity-100" : "opacity-40 grayscale")}
        />
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
