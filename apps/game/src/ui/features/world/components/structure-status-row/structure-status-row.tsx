import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { realmLevelNumber } from "@/ui/lib/realm-level";

import { structureMeaning } from "@/ui/design-system/domain-icon-meaning";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { STRUCTURE_GROUP_CONFIG } from "@/ui/features/world/containers/top-header/structure-groups";
import {
  StructureRealmActions,
  type StructureWithMetadata,
} from "@/ui/features/world/containers/top-header/structure-picker/chip";
import {
  formatPopulationStatusLabel,
  formatUsedBuildingTilesLabel,
} from "@/ui/features/world/containers/structure-status";
import { resolveStructureUiCapabilities } from "@/ui/lib/structure-capabilities";
import { type ID, StructureType } from "@bibliothecadao/types";
import { memo, useCallback } from "react";

const getCategoryIcon = (category: StructureType | number | undefined): IconMeaning =>
  category === undefined ? "realm" : structureMeaning(category);

const CategoryIcon = ({
  category,
  className,
}: {
  category: StructureType | number | undefined;
  className?: string;
}) => <SemanticIcon name={getCategoryIcon(category)} className={className} />;

/**
 * Status tone for the favorite star. Same tri-state we ship today:
 * red = no defenders, amber = under-staffed, green = all good. Non-realm
 * structures skip the tint.
 */
const resolveStatusTone = (
  structure: StructureWithMetadata,
): { tone: "green" | "amber" | "red"; title: string } | null => {
  const capabilities = resolveStructureUiCapabilities(structure.structure);
  if (!capabilities.hasPopulationDetails) return null;

  const occupied = structure.guardCount;
  if (occupied === undefined) return { tone: "amber", title: "Guards: —" };
  const max = structure.structure.base.troop_max_guard_count;

  if (max > 0 && occupied === 0) {
    return { tone: "red", title: "No defenders stationed." };
  }
  if (max > 0 && occupied < max) {
    return { tone: "amber", title: `Guards: ${occupied}/${max}` };
  }
  return { tone: "green", title: "Operating normally." };
};

const STATUS_TONE_TEXT: Record<"green" | "amber" | "red", string> = {
  green: "text-hud-good",
  amber: "text-hud-warn",
  red: "text-hud-bad",
};

const InlineStat = ({ icon: Icon, label, title }: { icon: IconMeaning; label: string; title?: string }) => (
  <span className="inline-flex items-center gap-0.5 text-hud-label tabular-nums text-hud-muted" title={title}>
    <SemanticIcon name={Icon} className="h-3 w-3 text-hud-muted" />
    <span>{label}</span>
  </span>
);

interface StructureStatusRowProps {
  structure: StructureWithMetadata;
  isActive: boolean;
  onSelect: (entityId: ID) => void;
  /**
   * "full" → left rail (favorite star, level, pop, tiles, realm actions, pencil).
   * "compact" → modal sidebar (star + icon + name + level + attention dot).
   */
  variant?: "full" | "compact";
  onToggleFavorite?: (entityId: ID) => void;
  onRequestRename?: (entityId: ID) => void;
  /**
   * Modal sidebars pass `true` when this row has something needing the player's
   * attention (production stall, empty guard slot, etc.). A small gold dot is
   * painted next to the level chip.
   */
  hasAttention?: boolean;
  /**
   * Which stats badges to render under the name. `default` = pop + building
   * tiles (left rail / construction). `military` = guard armies + explorer
   * armies, which is what the Military modal cares about.
   */
  statsVariant?: "default" | "military";
}

/**
 * Shared status row used by the left rail and by every modal sidebar that
 * needs a realm switcher. One component, two variants — the visual language
 * stays identical so a player who jumps between Build / Military / Production
 * modals sees the same row in the same order in the same place every time.
 */
export const StructureStatusRow = memo(
  ({
    structure,
    isActive,
    onSelect,
    variant = "full",
    onToggleFavorite,
    onRequestRename,
    hasAttention,
    statsVariant = "default",
  }: StructureStatusRowProps) => {
    const capabilities = resolveStructureUiCapabilities(structure.structure);
    const groupConfig = structure.groupColor ? STRUCTURE_GROUP_CONFIG[structure.groupColor] : null;
    const statusTone = resolveStatusTone(structure);
    const levelBadge =
      capabilities.hasPopulationDetails && Number.isFinite(structure.realmLevel)
        ? String(realmLevelNumber(Math.trunc(structure.realmLevel)))
        : null;
    const populationLabel =
      statsVariant === "default" && capabilities.hasPopulationDetails
        ? formatPopulationStatusLabel(structure.population, structure.populationCapacity)
        : null;
    const buildingTilesLabel =
      statsVariant === "default" &&
      capabilities.hasPopulationDetails &&
      structure.buildingTilesOccupied !== null &&
      structure.buildingTilesTotal !== null
        ? formatUsedBuildingTilesLabel(structure.buildingTilesOccupied, structure.buildingTilesTotal)
        : null;

    // Military stats: occupied/max guards and current/max explorer armies.
    const base = structure.structure.base;
    const guardOccupied = structure.guardCount;
    const guardMax = base.troop_max_guard_count;
    const explorerOccupied = structure.explorerCount;
    const explorerMax = base.troop_max_explorer_count;
    const showMilitaryStats =
      statsVariant === "military" && capabilities.hasPopulationDetails && (guardMax > 0 || explorerMax > 0);
    const guardsLabel = showMilitaryStats && guardMax > 0 ? `${guardOccupied ?? "—"}/${guardMax}` : null;
    const explorersLabel = showMilitaryStats && explorerMax > 0 ? `${explorerOccupied}/${explorerMax}` : null;
    const isRealm = structure.category === StructureType.Realm;
    const isFavorite = structure.isFavorite;
    const isFull = variant === "full";

    const handleCardClick = useCallback(() => {
      onSelect(structure.entityId);
    }, [onSelect, structure.entityId]);

    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleCardClick();
        }
      },
      [handleCardClick],
    );

    const starTone = statusTone ? STATUS_TONE_TEXT[statusTone.tone] : "text-hud-muted";
    const starTitle = statusTone?.title ?? (isFavorite ? "Remove from favorites" : "Favorite structure");

    return (
      <div
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={handleKeyDown}
        className={cn(
          "pointer-events-auto cursor-pointer rounded-xl border bg-hud-surface transition",
          isFull && "h-16",
          isActive
            ? "border-hud-line-strong ring-1 ring-hud-line-strong"
            : "border-hud-line hover:border-hud-line-strong",
        )}
        aria-pressed={isActive}
        title={structure.displayName}
      >
        {/* Row 1 — name + actions: star · icon · name · chevrons · info · pencil */}
        <div className="flex items-center gap-1.5 px-2.5 pt-2">
          <button
            type="button"
            onClick={
              onToggleFavorite
                ? (event) => {
                    event.stopPropagation();
                    onToggleFavorite(structure.entityId);
                  }
                : undefined
            }
            disabled={!onToggleFavorite}
            className={cn(
              "flex-shrink-0 rounded p-0.5 transition-colors",
              starTone,
              !onToggleFavorite && "cursor-default",
            )}
            title={starTitle}
            aria-label={starTitle}
          >
            <SemanticIcon name="star" className={cn("h-3.5 w-3.5", isFavorite && "fill-current")} />
          </button>
          {isFull && onRequestRename && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onRequestRename(structure.entityId);
              }}
              className="flex-shrink-0 rounded border border-hud-line p-0.5 text-hud-muted hover:text-hud-ink"
              title="Rename structure"
              aria-label="Rename structure"
            >
              <SemanticIcon name="edit" className="h-3 w-3" />
            </button>
          )}
          <CategoryIcon
            category={structure.category}
            className={cn("h-4 w-4 flex-shrink-0", groupConfig ? groupConfig.textClass : "text-hud-ink")}
          />
          {groupConfig && <span className={cn("h-1.5 w-1.5 flex-shrink-0 rounded-full", groupConfig.dotClass)} />}
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-hud-strong ",
              groupConfig ? groupConfig.textClass : "text-hud-ink",
            )}
          >
            {structure.displayName}
          </span>
          {hasAttention && (
            <span
              className="h-2 w-2 flex-shrink-0 rounded-full bg-hud-gold"
              aria-hidden="true"
              title="Needs attention"
            />
          )}
          {isFull && isRealm && (
            <div className="flex-shrink-0" onClick={(event) => event.stopPropagation()}>
              <StructureRealmActions structureEntityId={structure.entityId} />
            </div>
          )}
        </div>

        {/* Row 2 — stats: numeric level + variant-specific badges. */}
        {(levelBadge || populationLabel || buildingTilesLabel || guardsLabel || explorersLabel) && (
          <div className="flex items-center gap-1.5 px-2.5 pt-1 pb-2">
            {levelBadge && (
              <span
                className="flex-shrink-0 rounded-sm border border-hud-line bg-hud-well px-1.5 text-hud-label tabular-nums text-hud-ink"
                title="Realm level"
              >
                {levelBadge}
              </span>
            )}
            {populationLabel && (
              <InlineStat icon={"people" as const} label={populationLabel} title="Population used / capacity" />
            )}
            {buildingTilesLabel && (
              <InlineStat icon={"hexagon" as const} label={buildingTilesLabel} title="Used / total building tiles" />
            )}
            {explorersLabel && (
              <InlineStat icon={"target" as const} label={explorersLabel} title="Field armies / max" />
            )}
            {guardsLabel && (
              <InlineStat icon={"defend" as const} label={guardsLabel} title="Guard slots occupied / max" />
            )}
          </div>
        )}
      </div>
    );
  },
);

StructureStatusRow.displayName = "StructureStatusRow";
