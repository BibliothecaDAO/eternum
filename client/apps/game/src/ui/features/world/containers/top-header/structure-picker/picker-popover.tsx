import type { VillageIconKey } from "@/config/game-modes";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { Tabs } from "@/ui/design-system/atoms";
import clsx from "clsx";
import Castle from "lucide-react/dist/esm/icons/castle";
import Crown from "lucide-react/dist/esm/icons/crown";
import type { LucideIcon } from "lucide-react";
import Pencil from "lucide-react/dist/esm/icons/pencil";
import Pickaxe from "lucide-react/dist/esm/icons/pickaxe";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import Tent from "lucide-react/dist/esm/icons/tent";
import { type ID, StructureType } from "@bibliothecadao/types";
import { memo, useMemo, useState } from "react";
import { StructureChip, type StructureWithMetadata } from "./chip";

const VILLAGE_ICON_BY_KEY: Record<VillageIconKey, LucideIcon> = {
  castle: Castle,
  tent: Tent,
};

const MAX_VISIBLE_STRUCTURE_ROWS = 5;

interface StructurePickerPopoverProps {
  structures: StructureWithMetadata[];
  selectedEntityId: ID;
  onSelectStructure: (entityId: ID) => void;
  onToggleFavorite: (entityId: ID) => void;
  className?: string;
}

export const StructurePickerPopover = memo(
  ({ structures, selectedEntityId, onSelectStructure, onToggleFavorite, className }: StructurePickerPopoverProps) => {
    const mode = useGameModeConfig();
    const setPendingRenameStructureEntityId = useUIStore((state) => state.setPendingRenameStructureEntityId);

    const [activeTab, setActiveTab] = useState(0);
    const [showAllStructures, setShowAllStructures] = useState(false);

    const structureTabs = useMemo<Array<{ key: string; label: string; categories: StructureType[]; icon: LucideIcon }>>(
      () => [
        { key: "realms", label: mode.labels.realms, categories: [StructureType.Realm], icon: Crown },
        {
          key: "villages",
          label: mode.labels.villages,
          categories: [StructureType.Village, StructureType.Camp],
          icon: VILLAGE_ICON_BY_KEY[mode.ui.villageIconKey as VillageIconKey],
        },
        {
          key: "rifts",
          label: mode.labels.fragmentMines,
          categories: [StructureType.FragmentMine],
          icon: Pickaxe,
        },
        {
          key: "hyperstructures",
          label: "Hyperstructures",
          categories: [StructureType.Hyperstructure],
          icon: Sparkles,
        },
      ],
      [mode],
    );

    const categoryCounts = useMemo(() => {
      const counts: Partial<Record<StructureType, number>> = {};
      for (const structure of structures) {
        counts[structure.category] = (counts[structure.category] ?? 0) + 1;
      }
      return counts;
    }, [structures]);

    const tabCounts = useMemo(
      () =>
        structureTabs.map((tab) =>
          tab.categories.reduce((total, category) => total + (categoryCounts[category] ?? 0), 0),
        ),
      [structureTabs, categoryCounts],
    );

    const orderedStructures = useMemo(() => {
      const currentTab = structureTabs[activeTab] ?? structureTabs[0];
      return currentTab?.categories?.length === 0
        ? structures
        : structures.filter((structure) => currentTab.categories.includes(structure.category));
    }, [activeTab, structureTabs, structures]);

    const selectedStructure = useMemo(
      () => structures.find((structure) => structure.entityId === selectedEntityId),
      [structures, selectedEntityId],
    );

    return (
      <div
        className={clsx(
          "rounded-xl p-3",
          "border border-gold/30 bg-gradient-to-b from-[#1a1410]/95 to-[#231a10]/95 shadow-[0_8px_24px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(223,170,84,0.18)] backdrop-blur-sm",
          className,
        )}
      >
        {selectedStructure && (
          <div className="mb-3 flex items-center justify-between gap-2 border-b border-gold/15 pb-2">
            <span className="truncate text-sm font-semibold text-gold" title={selectedStructure.displayName}>
              {selectedStructure.displayName}
            </span>
            <button
              type="button"
              onClick={() => setPendingRenameStructureEntityId(selectedStructure.entityId)}
              className="flex-shrink-0 rounded border border-gold/30 p-1 text-gold/70 hover:bg-gold/10"
              title="Rename structure"
              aria-label="Rename structure"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </div>
        )}

        <Tabs
          selectedIndex={activeTab}
          onChange={setActiveTab}
          variant="selection"
          size="small"
          className="text-xs text-gold"
        >
          <Tabs.List>
            {structureTabs.map((tab, index) => {
              const Icon = tab.icon;
              const count = tabCounts[index] ?? 0;
              const isActiveTab = activeTab === index;
              const isHiddenTab = count === 0 && tab.key !== "realms";
              return (
                <Tabs.Tab
                  key={tab.key}
                  aria-label={tab.label}
                  title={tab.label}
                  disabled={isHiddenTab}
                  className={clsx(
                    "!mx-0 border",
                    isHiddenTab && "hidden",
                    isActiveTab
                      ? "border-gold/60 bg-black/40 text-[#f4c24d]"
                      : "border-gold/25 bg-black/20 text-gold/70 hover:border-gold/40 hover:text-gold/90",
                  )}
                >
                  <span className="flex items-center gap-1">
                    <span className={clsx("text-[12px] font-semibold", isActiveTab ? "text-[#f4c24d]" : "text-gold/60")}>
                      {count}
                    </span>
                    <Icon className={clsx("h-4 w-4", isActiveTab ? "text-[#f4c24d]" : "text-gold/60")} />
                  </span>
                  <span className="sr-only">{tab.label}</span>
                </Tabs.Tab>
              );
            })}
          </Tabs.List>
        </Tabs>

        {orderedStructures.length > 0 && (
          <div className="mt-3 flex flex-col gap-1">
            {(showAllStructures ? orderedStructures : orderedStructures.slice(0, MAX_VISIBLE_STRUCTURE_ROWS)).map(
              (structure) => (
                <StructureChip
                  key={structure.entityId}
                  structure={structure}
                  isSelected={structure.entityId === selectedEntityId}
                  onSelectStructure={onSelectStructure}
                  onToggleFavorite={onToggleFavorite}
                />
              ),
            )}
            {(() => {
              const hiddenCount = Math.max(orderedStructures.length - MAX_VISIBLE_STRUCTURE_ROWS, 0);
              if (hiddenCount === 0) return null;
              return (
                <button
                  type="button"
                  onClick={() => setShowAllStructures((prev) => !prev)}
                  className="w-full rounded border border-gold/20 bg-black/30 px-2 py-1 text-[10px] uppercase tracking-wide text-gold/70 hover:border-gold/40 hover:text-gold"
                >
                  {showAllStructures ? "Show fewer" : `Show ${hiddenCount} more`}
                </button>
              );
            })()}
          </div>
        )}
      </div>
    );
  },
);

StructurePickerPopover.displayName = "StructurePickerPopover";
