import type { GameIcon } from "@/ui/design-system/atoms/game-icon";
import {
  Castle,
  Crosshair,
  Crown,
  Hexagon,
  Pickaxe,
  Shield,
  Sparkles,
  Star,
  Tent,
  Users,
} from "@/ui/design-system/atoms/game-icons";
import { byStructureCategory } from "@/lib/structure-category-table";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import { STRUCTURE_GROUP_CONFIG } from "@/ui/features/world/containers/top-header/structure-groups";
import type { StructureWithMetadata } from "@/ui/features/world/containers/top-header/structure-picker/use-structures-with-metadata";
import {
  formatPopulationStatusLabel,
  formatUsedBuildingTilesLabel,
} from "@/ui/features/world/containers/structure-status";
import { resolveStructureUiCapabilities } from "@/ui/lib/structure-capabilities";
import { type ID, StructureType } from "@bibliothecadao/types";
import { createElement, memo, useCallback } from "react";

// Category → icon, same lookup the picker uses elsewhere. Centralized here so
// every consumer of StructureStatusRow gets the same iconography.
// A new category fails typecheck here until it has an icon.
const CATEGORY_ICONS: Record<StructureType, GameIcon> = {
  [StructureType.Realm]: Crown,
  [StructureType.Village]: Castle,
  [StructureType.Camp]: Tent,
  [StructureType.Mine]: Pickaxe,
  [StructureType.Hyperstructure]: Sparkles,
  [StructureType.Bank]: Crown,
  [StructureType.BitcoinMine]: Crown,
  [StructureType.Rift]: Crown,
  [StructureType.Ruin]: Crown,
  [StructureType.Stragglers]: Crown,
};

const getCategoryIcon = (category: StructureType | number | undefined): GameIcon => {
  if (category === undefined) return Crown;
  return byStructureCategory(CATEGORY_ICONS, category, "status row icon", Crown);
};

const CategoryIcon = ({ category, className }: { category: StructureType | number | undefined; className?: string }) =>
  createElement(getCategoryIcon(category), { className });

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
  green: "text-emerald-300 drop-shadow-[0_0_4px_rgba(110,231,183,0.55)]",
  amber: "text-amber-300 drop-shadow-[0_0_4px_rgba(252,211,77,0.55)]",
  red: "text-rose-400 drop-shadow-[0_0_4px_rgba(244,114,114,0.7)]",
};

const InlineStat = ({ icon: Icon, label, title }: { icon: GameIcon; label: string; title?: string }) => (
  <span className="inline-flex items-center gap-0.5 text-sm font-semibold tabular-nums text-gold/75" title={title}>
    <Icon className="h-3 w-3 text-kit-muted" />
    <span>{label}</span>
  </span>
);

interface StructureStatusRowProps {
  structure: StructureWithMetadata;
  isActive: boolean;
  onSelect: (entityId: ID) => void;
  /**
   * Modal sidebars pass `true` when this row has something needing the player's
   * attention (production stall, empty guard slot, etc.). A small gold dot is
   * painted next to the level chip.
   */
  hasAttention?: boolean;
  /**
   * Which stats badges to render under the name. `default` = pop + building
   * tiles (construction). `military` = guard armies + explorer
   * armies, which is what the Military modal cares about.
   */
  statsVariant?: "default" | "military";
}

/**
 * The status row every workspace sidebar uses as its realm switcher, so a
 * player who jumps between Build / Military / Production sees the same row in
 * the same order in the same place every time.
 */
export const StructureStatusRow = memo(
  ({ structure, isActive, onSelect, hasAttention, statsVariant = "default" }: StructureStatusRowProps) => {
    const capabilities = resolveStructureUiCapabilities(structure.structure);
    const groupConfig = structure.groupColor ? STRUCTURE_GROUP_CONFIG[structure.groupColor] : null;
    const statusTone = resolveStatusTone(structure);
    // Use numeric realm level (1..6) instead of the letter abbreviation —
    // shorter, sortable at a glance, no Settlement-vs-Hamlet mental lookup.
    const levelBadge =
      capabilities.hasPopulationDetails && Number.isFinite(structure.realmLevel)
        ? String(Math.max(1, Math.trunc(structure.realmLevel)))
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
    const isFavorite = structure.isFavorite;

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

    const starTone = statusTone ? STATUS_TONE_TEXT[statusTone.tone] : "text-kit-muted";
    const starTitle = statusTone?.title ?? (isFavorite ? "Pinned to the top" : "Structure");

    return (
      <div
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={handleKeyDown}
        className={cn(
          "pointer-events-auto cursor-pointer rounded-xl transition",
          isActive
            ? "border border-gold/65 ring-1 ring-gold/30 bg-gradient-to-b from-[#231913]/97 to-[#2c2018]/97 shadow-[0_0_18px_rgba(223,170,84,0.3),inset_0_1px_0_rgba(255,214,102,0.28)] backdrop-blur-sm"
            : cn(OVERLAY_SURFACE_BASE, "hover:border-gold/50"),
        )}
        aria-pressed={isActive}
        title={structure.displayName}
      >
        {/* Row 1 — status star · icon · name · attention dot */}
        <div className="flex items-center gap-1.5 px-2.5 pt-2">
          <span className={cn("flex-shrink-0 p-0.5", starTone)} title={starTitle} aria-label={starTitle}>
            <Star className={cn("h-3.5 w-3.5", isFavorite && "fill-current")} />
          </span>
          <CategoryIcon
            category={structure.category}
            className={cn("h-4 w-4 flex-shrink-0", groupConfig ? groupConfig.textClass : "text-gold")}
          />
          {groupConfig && <span className={cn("h-1.5 w-1.5 flex-shrink-0 rounded-full", groupConfig.dotClass)} />}
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-sm font-semibold",
              groupConfig ? groupConfig.textClass : "text-gold",
            )}
          >
            {structure.displayName}
          </span>
          {hasAttention && (
            <span
              className="h-2 w-2 flex-shrink-0 rounded-full bg-gold shadow-[0_0_6px_rgba(223,170,84,0.7)]"
              aria-hidden="true"
              title="Needs attention"
            />
          )}
        </div>

        {/* Row 2 — stats: numeric level + variant-specific badges. */}
        {(levelBadge || populationLabel || buildingTilesLabel || guardsLabel || explorersLabel) && (
          <div className="flex items-center gap-1.5 px-2.5 pt-1 pb-2">
            {levelBadge && (
              <span
                className="flex-shrink-0 rounded-sm border border-gold/25 bg-black/30 px-1.5 text-sm font-semibold tabular-nums text-gold/80"
                title="Realm level"
              >
                {levelBadge}
              </span>
            )}
            {populationLabel && <InlineStat icon={Users} label={populationLabel} title="Population used / capacity" />}
            {buildingTilesLabel && (
              <InlineStat icon={Hexagon} label={buildingTilesLabel} title="Used / total building tiles" />
            )}
            {explorersLabel && <InlineStat icon={Crosshair} label={explorersLabel} title="Field armies / max" />}
            {guardsLabel && <InlineStat icon={Shield} label={guardsLabel} title="Guard slots occupied / max" />}
          </div>
        )}
      </div>
    );
  },
);

StructureStatusRow.displayName = "StructureStatusRow";
