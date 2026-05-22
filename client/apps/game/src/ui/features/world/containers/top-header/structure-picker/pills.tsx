import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useFavoriteStructures } from "@/ui/features/world/containers/top-header/favorites";
import { STRUCTURE_GROUP_CONFIG } from "@/ui/features/world/containers/top-header/structure-groups";
import { Pill } from "@/ui/design-system/molecules/pill";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Position } from "@bibliothecadao/eternum";
import { useDojo, useQuery } from "@bibliothecadao/react";
import { type ID, StructureType } from "@bibliothecadao/types";
import Castle from "lucide-react/dist/esm/icons/castle";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import Crown from "lucide-react/dist/esm/icons/crown";
import type { LucideIcon } from "lucide-react";
import Pickaxe from "lucide-react/dist/esm/icons/pickaxe";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import Tent from "lucide-react/dist/esm/icons/tent";
import { createElement, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { resolveStructureUiCapabilities } from "@/ui/lib/structure-capabilities";
import { type StructureWithMetadata } from "./chip";
import { StructurePickerPopover } from "./picker-popover";
import { useStructuresWithMetadata } from "./use-structures-with-metadata";

const CATEGORY_ICONS: Partial<Record<StructureType, LucideIcon>> = {
  [StructureType.Realm]: Crown,
  [StructureType.Village]: Castle,
  [StructureType.Camp]: Tent,
  [StructureType.FragmentMine]: Pickaxe,
  [StructureType.Hyperstructure]: Sparkles,
};

const getCategoryIcon = (category: StructureType | number | undefined): LucideIcon => {
  if (category === undefined) return Crown;
  const icon = CATEGORY_ICONS[category as StructureType];
  return icon ?? Crown;
};

// Render helper that resolves a category icon from a static lookup and emits
// it via createElement. Avoids assigning a "Component" identifier inside
// render, which the react-hooks/static-components rule (rightly) flags when
// the value comes from a function call rather than a stable binding.
const CategoryIcon = ({
  category,
  className,
}: {
  category: StructureType | number | undefined;
  className?: string;
}) => createElement(getCategoryIcon(category), { className });

// Resolve the green/amber/red status dot for the active pill. Goal: a glanceable
// hint that the player should look at this structure (empty defense slot,
// stalled production, etc.) without claiming any specific facet.
const resolveStatusDot = (
  structure: StructureWithMetadata,
):
  | { tone: "green" | "amber" | "red"; title: string }
  | null => {
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
  return { tone: "green", title: "All good." };
};

const STATUS_DOT_TONE: Record<"green" | "amber" | "red", string> = {
  green: "bg-emerald-300/80 shadow-[0_0_6px_rgba(110,231,183,0.6)]",
  amber: "bg-amber-300 shadow-[0_0_6px_rgba(252,211,77,0.6)]",
  red: "bg-rose-400 shadow-[0_0_6px_rgba(244,114,114,0.7)]",
};

/**
 * StructurePickerStrip — top-zone surface that replaces the old
 * LeftPanelHeader (selected-structure title + 4 category tabs + chip list).
 *
 * Lays out: active pill, up to 4 pinned-favorite pills, then a `⋯` overflow
 * button that opens the full categorized picker popover. The same popover is
 * also opened by clicking the active pill — discoverable from either entry.
 */
export const StructurePickerStrip = memo(() => {
  const { setup } = useDojo();
  const components = setup.components;
  const { isMapView } = useQuery();

  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const setStructureEntityId = useUIStore((state) => state.setStructureEntityId);
  const setSelectedHex = useUIStore((state) => state.setSelectedHex);
  const playerStructures = useUIStore((state) => state.playerStructures);
  const goToStructure = useGoToStructure(setup);

  const { toggleFavorite } = useFavoriteStructures();
  const structureNameVersion = useUIStore((state) => state.structureNameVersion);
  const structuresWithMetadata = useStructuresWithMetadata({
    structures: playerStructures,
    components,
    nameUpdateVersion: structureNameVersion,
  });

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // Anchor the portaled popover to the trigger's current viewport rect.
  // Re-measure on open, on window resize, and on scroll so the popover tracks
  // the trigger even if the rest of the HUD reflows.
  useLayoutEffect(() => {
    if (!isPopoverOpen) return;
    const measure = () => {
      if (!wrapperRef.current) return;
      const rect = wrapperRef.current.getBoundingClientRect();
      setPopoverPosition({ top: rect.bottom + 8, left: rect.left });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [isPopoverOpen]);

  const handleSelectStructure = useCallback(
    (entityId: ID) => {
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

      setIsPopoverOpen(false);
    },
    [playerStructures, goToStructure, isMapView, setSelectedHex, setStructureEntityId],
  );

  // Close popover on outside click. Because the popover is portaled to the
  // document body, "inside" means either the trigger wrapper OR the popover
  // content itself.
  useEffect(() => {
    if (!isPopoverOpen) return;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (wrapperRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setIsPopoverOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isPopoverOpen]);

  const activeStructure = useMemo(
    () => structuresWithMetadata.find((structure) => structure.entityId === structureEntityId),
    [structuresWithMetadata, structureEntityId],
  );

  // Nothing to render yet (fresh load, no structures synced).
  if (structuresWithMetadata.length === 0) {
    return null;
  }

  return (
    <div ref={wrapperRef} className="relative flex flex-shrink-0 items-center gap-2">
      {activeStructure ? (
        <Pill
          tone="default"
          active={isPopoverOpen}
          onClick={() => setIsPopoverOpen((prev) => !prev)}
          title={activeStructure.displayName}
          aria-label="Open structure picker"
          className="max-w-[260px] gap-1.5 normal-case tracking-normal text-xs"
        >
          {(() => {
            const groupConfig = activeStructure.groupColor ? STRUCTURE_GROUP_CONFIG[activeStructure.groupColor] : null;
            const statusDot = resolveStatusDot(activeStructure);
            const levelLabel = activeStructure.realmLevelLabel;
            return (
              <>
                <CategoryIcon
                  category={activeStructure.category}
                  className={cn("h-4 w-4 flex-shrink-0", groupConfig ? groupConfig.textClass : "text-gold")}
                />
                {groupConfig && <span className={cn("h-1.5 w-1.5 flex-shrink-0 rounded-full", groupConfig.dotClass)} />}
                <span className={cn("max-w-[200px] truncate font-semibold", groupConfig ? groupConfig.textClass : "text-gold")}>
                  {activeStructure.displayName}
                </span>
                {levelLabel && (
                  <span className="flex-shrink-0 rounded-sm border border-gold/25 bg-black/30 px-1 text-[9px] uppercase tracking-wide text-gold/70">
                    {levelLabel.charAt(0)}
                  </span>
                )}
                {statusDot && (
                  <span
                    className={cn("h-2 w-2 flex-shrink-0 rounded-full", STATUS_DOT_TONE[statusDot.tone])}
                    title={statusDot.title}
                    aria-label={statusDot.title}
                  />
                )}
                <ChevronDown
                  className={cn("h-3.5 w-3.5 flex-shrink-0 transition-transform", isPopoverOpen && "rotate-180")}
                  aria-hidden="true"
                />
              </>
            );
          })()}
        </Pill>
      ) : (
        <Pill tone="default" onClick={() => setIsPopoverOpen((prev) => !prev)} className="text-xs">
          Select structure
        </Pill>
      )}

      {isPopoverOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popoverRef}
            className="fixed w-[360px] pointer-events-auto"
            style={{ top: popoverPosition.top, left: popoverPosition.left, zIndex: 60 }}
          >
            <StructurePickerPopover
              structures={structuresWithMetadata}
              selectedEntityId={structureEntityId}
              onSelectStructure={handleSelectStructure}
              onToggleFavorite={toggleFavorite}
            />
          </div>,
          document.body,
        )}
    </div>
  );
});

StructurePickerStrip.displayName = "StructurePickerStrip";
