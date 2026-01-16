import Button from "@/ui/design-system/atoms/button";
import { ArrowUpDown, ChevronDown, Filter, Package, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { ChestEpoch } from "../hooks/use-chest-opening-flow";
import { MergedNftData } from "../utils/types";
import { ChestCard } from "./chest-card";
import { ChestStageContainer } from "./chest-stage-container";

type SortMode = "id-asc" | "id-desc";

interface ChestSelectionModalProps {
  isOpen: boolean;
  chests: MergedNftData[];
  onSelect: (chestId: string, epoch: ChestEpoch) => void;
  onClose: () => void;
  isLoading?: boolean;
  selectedChestId?: string | null;
}

// Helper to extract chest epoch from metadata using Epoch and ID attributes
function getChestEpoch(metadata: MergedNftData["metadata"] | undefined): ChestEpoch {
  if (!metadata?.attributes) {
    return "eternum-rewards-s1";
  }

  const idAttr = metadata.attributes.find((a) => a.trait_type === "ID");
  const epochAttr = metadata.attributes.find((a) => a.trait_type === "Epoch");

  if (idAttr && epochAttr) {
    const idValue = String(idAttr.value).toLowerCase();
    const epochValue = String(epochAttr.value).toLowerCase();

    // Infer Blitz/Eternum rewards by ID, and the season by Epoch string and fallback on ID
    if (idValue.includes("blitz")) {
      // Prefer explicit Epoch detection, fallback to s0 if found in ID
      if (epochValue.includes("0") || idValue.includes("(s0)")) {
        return "blitz-rewards-s0";
      }
      if (epochValue.includes("1") || idValue.includes("(s1)")) {
        // For future-proofing if s1 Blitz exists
        // return "blitz-rewards-s1";
        return "blitz-rewards-s0"; // fallback to s0 (as s1 does not exist yet)
      }
      return "blitz-rewards-s0"; // Default for legacy/ambiguous "blitz"
    }
    if (idValue.includes("eternum")) {
      if (epochValue.includes("1") || idValue.includes("(s1)")) {
        return "eternum-rewards-s1";
      }
      if (epochValue.includes("0") || idValue.includes("(s0)")) {
        // For future-proofing if s0 Eternum exists
        // return "eternum-rewards-s0";
        return "eternum-rewards-s1"; // fallback to s1 (unlikely but for coverage)
      }
      return "eternum-rewards-s1"; // Default for ambiguous "eternum"
    }
  }

  // Default to eternum-rewards-s1
  return "eternum-rewards-s1";
}

// Extract all trait values for a specific trait type
function getTraitValue(metadata: MergedNftData["metadata"] | undefined, traitType: string): string | null {
  if (!metadata?.attributes) return null;
  const attr = metadata.attributes.find((a) => a.trait_type.toLowerCase() === traitType.toLowerCase());
  return attr ? String(attr.value) : null;
}

// Filter dropdown component
interface FilterDropdownProps {
  label: string;
  value: string | null;
  options: string[];
  onChange: (value: string | null) => void;
}

function FilterDropdown({ label, value, options, onChange }: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <Button
        variant={value ? "primary" : "outline"}
        size="xs"
        onClick={() => setIsOpen(!isOpen)}
        className={`gap-1 text-xs min-w-[100px] justify-between ${
          value ? "" : "text-white/70 border-white/20 hover:bg-white/10 hover:text-white"
        }`}
      >
        <span className="truncate">{value || label}</span>
        <ChevronDown className="w-3 h-3 flex-shrink-0" />
      </Button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-20 bg-slate-800 border border-white/10 rounded-lg shadow-xl max-h-[300px] overflow-y-auto min-w-[150px]">
            <button
              onClick={() => {
                onChange(null);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-white/10 ${!value ? "bg-gold/10" : ""}`}
            >
              All {label}s
            </button>
            {options.map((option) => (
              <button
                key={option}
                onClick={() => {
                  onChange(option);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-white/10 ${value === option ? "bg-gold/10" : ""}`}
              >
                {option}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function ChestSelectionModal({
  isOpen,
  chests,
  onSelect,
  onClose,
  isLoading = false,
  selectedChestId = null,
}: ChestSelectionModalProps) {
  console.log("chest selection modal");
  const gridRef = useRef<HTMLDivElement>(null);
  const [sortMode, setSortMode] = useState<SortMode>("id-desc");
  const [filters, setFilters] = useState<Record<string, string | null>>({});

  // Extract all unique trait types and their values from all chests
  const traitOptions = useMemo(() => {
    const traits: Record<string, Set<string>> = {};

    chests.forEach((chest) => {
      if (!chest.metadata?.attributes) return;

      chest.metadata.attributes.forEach((attr) => {
        const traitType = attr.trait_type;
        if (!traits[traitType]) {
          traits[traitType] = new Set();
        }
        traits[traitType].add(String(attr.value));
      });
    });

    // Convert Sets to sorted arrays
    const result: Record<string, string[]> = {};
    Object.entries(traits).forEach(([traitType, values]) => {
      result[traitType] = Array.from(values).sort((a, b) => {
        // Try numeric sort first
        const numA = Number(a);
        const numB = Number(b);
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB;
        }
        return a.localeCompare(b);
      });
    });

    return result;
  }, [chests]);

  // Get list of trait types
  const traitTypes = useMemo(() => Object.keys(traitOptions).sort(), [traitOptions]);

  // Filter and sort chests
  const filteredAndSortedChests = useMemo(() => {
    let result = [...chests];

    // Apply all active filters
    Object.entries(filters).forEach(([traitType, filterValue]) => {
      if (filterValue) {
        result = result.filter((chest) => {
          const value = getTraitValue(chest.metadata, traitType);
          return value === filterValue;
        });
      }
    });

    // Apply sorting
    result.sort((a, b) => {
      if (sortMode === "id-asc") {
        return Number(a.token_id) - Number(b.token_id);
      } else {
        return Number(b.token_id) - Number(a.token_id);
      }
    });

    return result;
  }, [chests, filters, sortMode]);

  // Count active filters
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  // Clear all filters
  const clearFilters = () => {
    setFilters({});
  };

  // Update a specific filter
  const updateFilter = (traitType: string, value: string | null) => {
    setFilters((prev) => ({
      ...prev,
      [traitType]: value,
    }));
  };

  // Toggle sort mode
  const toggleSortMode = () => {
    setSortMode((current) => (current === "id-desc" ? "id-asc" : "id-desc"));
  };

  // Handle chest selection - extract epoch from metadata
  const handleSelect = (chest: MergedNftData) => {
    if (isLoading) return;
    const epoch = getChestEpoch(chest.metadata);
    onSelect(String(chest.token_id), epoch);
  };

  if (!isOpen) return null;

  return (
    <ChestStageContainer onClose={onClose} showCloseButton>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gold/10 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gold">Select a Chest</h2>
              <p className="text-sm text-white/60 mt-1">Choose which chest you want to open</p>
            </div>
            {/* Sort toggle */}
            <Button
              variant="outline"
              size="xs"
              onClick={toggleSortMode}
              className="gap-2 text-gold border-gold/50 hover:bg-gold/10"
            >
              <ArrowUpDown className="w-4 h-4" />
              ID {sortMode === "id-desc" ? "↓" : "↑"}
            </Button>
          </div>

          {/* Filter dropdowns */}
          {traitTypes.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <Filter className="w-4 h-4 text-white/50" />
              {traitTypes.map((traitType) => (
                <FilterDropdown
                  key={traitType}
                  label={traitType}
                  value={filters[traitType] || null}
                  options={traitOptions[traitType]}
                  onChange={(value) => updateFilter(traitType, value)}
                />
              ))}
              {activeFilterCount > 0 && (
                <Button
                  variant="outline"
                  size="xs"
                  onClick={clearFilters}
                  className="gap-1 text-xs text-white/60 hover:text-white hover:bg-white/10"
                >
                  <X className="w-3 h-3" />
                  Clear ({activeFilterCount})
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredAndSortedChests.length === 0 ? (
            // Empty state
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="w-16 h-16 text-gold/30 mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">
                {chests.length === 0 ? "No Chests Available" : "No Matching Chests"}
              </h3>
              <p className="text-sm text-white/50 max-w-sm">
                {chests.length === 0
                  ? "You don't have any loot chests to open. Acquire chests through gameplay or the marketplace."
                  : "No chests match the current filters. Try adjusting your selection."}
              </p>
              {activeFilterCount > 0 && (
                <Button
                  variant="outline"
                  size="xs"
                  onClick={clearFilters}
                  className="mt-4 text-gold border-gold/50 hover:bg-gold/10"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            // Chest grid
            <div ref={gridRef} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filteredAndSortedChests.map((chest, index) => (
                <ChestCard
                  key={chest.token_id}
                  chest={chest}
                  onSelect={() => handleSelect(chest)}
                  isSelected={selectedChestId === String(chest.token_id)}
                  isLoading={isLoading}
                  index={index}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gold/10 flex justify-between items-center flex-shrink-0">
          <span className="text-sm text-white/50">
            {activeFilterCount > 0
              ? `${filteredAndSortedChests.length} of ${chests.length} chest${chests.length !== 1 ? "s" : ""}`
              : `${chests.length} chest${chests.length !== 1 ? "s" : ""} available`}
          </span>
        </div>
      </div>
    </ChestStageContainer>
  );
}
