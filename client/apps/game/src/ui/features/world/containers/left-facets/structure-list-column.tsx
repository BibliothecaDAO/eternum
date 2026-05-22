import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_LABEL } from "@/ui/design-system/atoms/hud-typography";
import { OVERLAY_SURFACE_ACTIVE, OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import { EconomyFacet } from "@/ui/features/world/containers/left-facets/economy";
import { LeftFacetTabs } from "@/ui/features/world/containers/left-facets/left-facet-tabs";
import { MilitaryFacet } from "@/ui/features/world/containers/left-facets/military";
import { OverviewFacet } from "@/ui/features/world/containers/left-facets/overview";
import { useFavoriteStructures } from "@/ui/features/world/containers/top-header/favorites";
import { STRUCTURE_GROUP_CONFIG } from "@/ui/features/world/containers/top-header/structure-groups";
import { StructureRealmActions, type StructureWithMetadata } from "@/ui/features/world/containers/top-header/structure-picker/chip";
import { useStructuresWithMetadata } from "@/ui/features/world/containers/top-header/structure-picker/use-structures-with-metadata";
import {
  formatPopulationStatusLabel,
  formatUsedBuildingTilesLabel,
} from "@/ui/features/world/containers/structure-status";
import { resolveStructureUiCapabilities } from "@/ui/lib/structure-capabilities";
import { Position } from "@bibliothecadao/eternum";
import { useDojo, useQuery } from "@bibliothecadao/react";
import { getLevelName, type ID, RealmLevels, StructureType } from "@bibliothecadao/types";
import Castle from "lucide-react/dist/esm/icons/castle";
import Crown from "lucide-react/dist/esm/icons/crown";
import Hexagon from "lucide-react/dist/esm/icons/hexagon";
import type { LucideIcon } from "lucide-react";
import Pencil from "lucide-react/dist/esm/icons/pencil";
import Pickaxe from "lucide-react/dist/esm/icons/pickaxe";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import Star from "lucide-react/dist/esm/icons/star";
import Tent from "lucide-react/dist/esm/icons/tent";
import Users from "lucide-react/dist/esm/icons/users";
import { createElement, memo, useCallback, useMemo } from "react";

// Re-uses the existing categorization → icon mapping from the old picker pill.
const CATEGORY_ICONS: Partial<Record<StructureType, LucideIcon>> = {
  [StructureType.Realm]: Crown,
  [StructureType.Village]: Castle,
  [StructureType.Camp]: Tent,
  [StructureType.FragmentMine]: Pickaxe,
  [StructureType.Hyperstructure]: Sparkles,
};

const getCategoryIcon = (category: StructureType | number | undefined): LucideIcon => {
  if (category === undefined) return Crown;
  return CATEGORY_ICONS[category as StructureType] ?? Crown;
};

const CategoryIcon = ({
  category,
  className,
}: {
  category: StructureType | number | undefined;
  className?: string;
}) => createElement(getCategoryIcon(category), { className });

// Glanceable red/amber/green dot. Red = no defenders, amber = under-staffed or
// any other under-maintained state, green = all good. Non-realm structures
// skip the dot.
const resolveStatusDot = (
  structure: StructureWithMetadata,
): { tone: "green" | "amber" | "red"; title: string } | null => {
  const capabilities = resolveStructureUiCapabilities(structure.structure);
  if (!capabilities.hasPopulationDetails) return null;

  const base = structure.structure.base;
  const occupied = Number(base?.troop_guard_count ?? 0);
  const max = Number(base?.troop_max_guard_count ?? 0);

  if (max > 0 && occupied === 0) {
    return { tone: "red", title: "No defenders stationed." };
  }
  if (max > 0 && occupied < max) {
    return { tone: "amber", title: `Guards: ${occupied}/${max}` };
  }
  return { tone: "green", title: "Operating normally." };
};

const STATUS_DOT_TONE: Record<"green" | "amber" | "red", string> = {
  green: "bg-emerald-300/80 shadow-[0_0_6px_rgba(110,231,183,0.6)]",
  amber: "bg-amber-300 shadow-[0_0_6px_rgba(252,211,77,0.6)]",
  red: "bg-rose-400 shadow-[0_0_6px_rgba(244,114,114,0.7)]",
};

// Compact stat chip (pop / tiles). Two side-by-side, sized to fit the 280px column.
const StatChip = ({ icon: Icon, label, title }: { icon: LucideIcon; label: string; title?: string }) => (
  <span
    className="inline-flex items-center gap-1 rounded border border-gold/15 bg-black/30 px-1.5 py-0.5 text-[10px] text-gold/75"
    title={title}
  >
    <Icon className="h-3 w-3 text-gold/55" />
    <span className="font-semibold tabular-nums">{label}</span>
  </span>
);

interface StructureCardProps {
  structure: StructureWithMetadata;
  isActive: boolean;
  isFavorite: boolean;
  onSelect: (entityId: ID) => void;
  onToggleFavorite: (entityId: ID) => void;
  onRequestRename: (entityId: ID) => void;
  leftFacet: "overview" | "economy" | "military";
  attention?: Partial<Record<"overview" | "economy" | "military", boolean>>;
}

/**
 * Single row in the always-visible structure list. Collapsed by default —
 * status / pop / tiles / actions visible in two compact rows. The active card
 * also renders the facet tabs + active facet content underneath, so the
 * column reads as: list of structures, expanded around the one you control.
 */
const StructureCard = memo(
  ({
    structure,
    isActive,
    isFavorite,
    onSelect,
    onToggleFavorite,
    onRequestRename,
    leftFacet,
    attention,
  }: StructureCardProps) => {
    const capabilities = resolveStructureUiCapabilities(structure.structure);
    const groupConfig = structure.groupColor ? STRUCTURE_GROUP_CONFIG[structure.groupColor] : null;
    const statusDot = resolveStatusDot(structure);
    const levelAbbrev = capabilities.hasPopulationDetails
      ? getLevelName(
          Math.min(Math.max(structure.realmLevel, RealmLevels.Settlement), RealmLevels.Empire) as RealmLevels,
        ).charAt(0)
      : null;
    const populationLabel = capabilities.hasPopulationDetails
      ? formatPopulationStatusLabel(structure.population, structure.populationCapacity)
      : null;
    const buildingTilesLabel =
      capabilities.hasPopulationDetails &&
      structure.buildingTilesOccupied !== null &&
      structure.buildingTilesTotal !== null
        ? formatUsedBuildingTilesLabel(structure.buildingTilesOccupied, structure.buildingTilesTotal)
        : null;

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

    return (
      <div
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={handleKeyDown}
        className={cn(
          "pointer-events-auto cursor-pointer rounded-xl transition",
          isActive
            ? cn(OVERLAY_SURFACE_ACTIVE, "border border-gold/60 shadow-[0_0_18px_rgba(223,170,84,0.18)]")
            : cn(OVERLAY_SURFACE_BASE, "hover:border-gold/50"),
        )}
        aria-pressed={isActive}
        title={structure.displayName}
      >
        {/* Row 1: status dot · icon · name · level · favorite */}
        <div className="flex items-center gap-1.5 px-2.5 pt-2">
          {statusDot && (
            <span
              className={cn("h-2 w-2 flex-shrink-0 rounded-full", STATUS_DOT_TONE[statusDot.tone])}
              title={statusDot.title}
              aria-label={statusDot.title}
            />
          )}
          <CategoryIcon
            category={structure.category}
            className={cn("h-4 w-4 flex-shrink-0", groupConfig ? groupConfig.textClass : "text-gold")}
          />
          {groupConfig && (
            <span className={cn("h-1.5 w-1.5 flex-shrink-0 rounded-full", groupConfig.dotClass)} />
          )}
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-sm font-semibold",
              groupConfig ? groupConfig.textClass : "text-gold",
            )}
          >
            {structure.displayName}
          </span>
          {levelAbbrev && (
            <span className="flex-shrink-0 rounded-sm border border-gold/25 bg-black/30 px-1 text-[9px] uppercase tracking-wide text-gold/70">
              {levelAbbrev}
            </span>
          )}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleFavorite(structure.entityId);
            }}
            className="flex-shrink-0 rounded p-0.5 text-gold/60 hover:text-gold"
            title={isFavorite ? "Remove from favorites" : "Favorite structure"}
            aria-label={isFavorite ? "Remove from favorites" : "Favorite structure"}
          >
            <Star className={cn("h-3.5 w-3.5", isFavorite ? "fill-current text-gold" : "text-gold/60")} />
          </button>
          {isActive && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onRequestRename(structure.entityId);
              }}
              className="flex-shrink-0 rounded border border-gold/30 p-0.5 text-gold/70 hover:text-gold"
              title="Rename structure"
              aria-label="Rename structure"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Row 2: pop · tiles · level-up + provision + info (realm only) */}
        {capabilities.hasPopulationDetails && (
          <div className="flex flex-wrap items-center gap-1.5 px-2.5 pb-2 pt-1.5">
            {populationLabel && <StatChip icon={Users} label={populationLabel} title="Population used / capacity" />}
            {buildingTilesLabel && (
              <StatChip icon={Hexagon} label={buildingTilesLabel} title="Used / total building tiles" />
            )}
            {structure.category === StructureType.Realm && (
              <div className="ml-auto" onClick={(event) => event.stopPropagation()}>
                <StructureRealmActions structureEntityId={structure.entityId} />
              </div>
            )}
          </div>
        )}

        {/* Expanded body: facet tabs + active facet content for the controlled
            structure. Click handlers inside use stopPropagation so opening a
            sub-modal doesn't re-trigger card selection. */}
        {isActive && (
          <div className="flex flex-col gap-2 px-2 pb-2" onClick={(event) => event.stopPropagation()}>
            <LeftFacetTabs attention={attention} />
            {leftFacet === "overview" && <OverviewFacet structureEntityId={structure.entityId} />}
            {leftFacet === "economy" && <EconomyFacet structureEntityId={structure.entityId} />}
            {leftFacet === "military" && <MilitaryFacet structureEntityId={structure.entityId} />}
          </div>
        )}
      </div>
    );
  },
);

StructureCard.displayName = "StructureCard";

interface StructureListColumnProps {
  attention?: Partial<Record<"overview" | "economy" | "military", boolean>>;
}

/**
 * Always-visible structure list that replaces the old picker pill +
 * dropdown. Each player structure is rendered as a status card; the active
 * one expands inline to host the facet tabs and bubbles. Browsing is just
 * scrolling the column.
 */
export const StructureListColumn = memo(({ attention }: StructureListColumnProps) => {
  const { setup } = useDojo();
  const components = setup.components;
  const { isMapView } = useQuery();

  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const setStructureEntityId = useUIStore((state) => state.setStructureEntityId);
  const setSelectedHex = useUIStore((state) => state.setSelectedHex);
  const playerStructures = useUIStore((state) => state.playerStructures);
  const structureNameVersion = useUIStore((state) => state.structureNameVersion);
  const setPendingRenameStructureEntityId = useUIStore((state) => state.setPendingRenameStructureEntityId);
  const leftFacet = useUIStore((state) => state.leftFacet);

  const goToStructure = useGoToStructure(setup);
  const { favorites, toggleFavorite } = useFavoriteStructures();

  const structuresWithMetadata = useStructuresWithMetadata({
    structures: playerStructures,
    components,
    nameUpdateVersion: structureNameVersion,
  });

  const favoritesSet = useMemo(() => new Set(favorites), [favorites]);

  // Sort: active first, then favorites in user-defined order, then by
  // category (Realms → Villages → Mines → Hyperstructures), then by name.
  const orderedStructures = useMemo(() => {
    const favoriteOrder = new Map(favorites.map((id, index) => [id, index]));
    return structuresWithMetadata.toSorted((a, b) => {
      if (a.entityId === structureEntityId) return -1;
      if (b.entityId === structureEntityId) return 1;
      const aFav = favoriteOrder.has(a.entityId);
      const bFav = favoriteOrder.has(b.entityId);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      if (aFav && bFav) {
        return (favoriteOrder.get(a.entityId) ?? 0) - (favoriteOrder.get(b.entityId) ?? 0);
      }
      const catDiff = Number(a.category) - Number(b.category);
      if (catDiff !== 0) return catDiff;
      return a.displayName.localeCompare(b.displayName);
    });
  }, [favorites, structureEntityId, structuresWithMetadata]);

  const handleSelectStructure = useCallback(
    (entityId: ID) => {
      if (entityId === structureEntityId) return;
      const target = playerStructures.find((structure) => structure.entityId === entityId);
      const coords = target?.structure?.base;

      if (coords && coords.coord_x !== undefined && coords.coord_y !== undefined) {
        const col = Number(coords.coord_x);
        const row = Number(coords.coord_y);
        if (Number.isFinite(col) && Number.isFinite(row)) {
          setSelectedHex({ col, row });
        }
        void goToStructure(entityId, new Position({ x: coords.coord_x, y: coords.coord_y }), isMapView);
      } else {
        setStructureEntityId(entityId);
      }
    },
    [goToStructure, isMapView, playerStructures, setSelectedHex, setStructureEntityId, structureEntityId],
  );

  const handleRequestRename = useCallback(
    (entityId: ID) => setPendingRenameStructureEntityId(entityId),
    [setPendingRenameStructureEntityId],
  );

  if (orderedStructures.length === 0) {
    return (
      <div className={cn("pointer-events-auto rounded-xl px-3 py-2", OVERLAY_SURFACE_BASE)}>
        <span className={HUD_LABEL}>No structures synced yet</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {orderedStructures.map((structure) => (
        <StructureCard
          key={structure.entityId}
          structure={structure}
          isActive={structure.entityId === structureEntityId}
          isFavorite={favoritesSet.has(structure.entityId)}
          onSelect={handleSelectStructure}
          onToggleFavorite={toggleFavorite}
          onRequestRename={handleRequestRename}
          leftFacet={leftFacet}
          attention={attention}
        />
      ))}
    </div>
  );
});

StructureListColumn.displayName = "StructureListColumn";
