import { ChestCard } from "@/ui/features/landing/chest-opening/components";
import { ChestEpoch } from "@/ui/features/landing/chest-opening/hooks/use-chest-opening-flow";
import { MergedNftData } from "@/ui/features/landing/chest-opening/utils/types";
import { ArrowUpDown, ChevronDown, Filter, Package, X } from "lucide-react";
import { useMemo, useState } from "react";

type SortMode = "id-asc" | "id-desc";

interface ChestGalleryProps {
  chests: MergedNftData[];
  onOpenChest: (chestId: string, epoch: ChestEpoch) => void;
  isLoading?: boolean;
  openingChestId?: string | null;
}

// Helper to extract chest epoch from metadata
function getChestEpoch(metadata: MergedNftData["metadata"] | undefined): ChestEpoch {
  if (!metadata?.attributes) {
    return "eternum-rewards-s1";
  }

  const idAttr = metadata.attributes.find((a) => a.trait_type === "ID");
  const epochAttr = metadata.attributes.find((a) => a.trait_type === "Epoch");

  if (idAttr && epochAttr) {
    const idValue = String(idAttr.value).toLowerCase();
    const epochValue = String(epochAttr.value).toLowerCase();

    if (idValue.includes("blitz")) {
      if (epochValue.includes("0") || idValue.includes("(s0)")) {
        return "blitz-rewards-s0";
      }
      return "blitz-rewards-s0";
    }
    if (idValue.includes("eternum")) {
      if (epochValue.includes("1") || idValue.includes("(s1)")) {
        return "eternum-rewards-s1";
      }
      return "eternum-rewards-s1";
    }
  }

  return "eternum-rewards-s1";
}

// Helper to get trait value from metadata
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
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl border transition-colors
          ${
            value
              ? "bg-gold/20 border-gold/40 text-gold"
              : "bg-gold/5 border-gold/20 text-gold/70 hover:bg-gold/10 hover:border-gold/30"
          }
        `}
      >
        <span className="truncate max-w-[80px]">{value || label}</span>
        <ChevronDown className={`w-3 h-3 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          {/* Dropdown */}
          <div className="absolute top-full left-0 mt-1 z-50 min-w-[140px] max-h-[200px] overflow-y-auto rounded-xl border border-gold/20 bg-black/95 backdrop-blur-xl shadow-xl">
            <button
              onClick={() => {
                onChange(null);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                !value ? "bg-gold/20 text-gold" : "text-gold/70 hover:bg-gold/10 hover:text-gold"
              }`}
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
                className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                  value === option ? "bg-gold/20 text-gold" : "text-gold/70 hover:bg-gold/10 hover:text-gold"
                }`}
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

export function ChestGallery({ chests, onOpenChest, isLoading = false, openingChestId }: ChestGalleryProps) {
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

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="aspect-square animate-pulse rounded-2xl border border-gold/10 bg-gold/5" />
        ))}
      </div>
    );
  }

  if (chests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Package className="w-16 h-16 mb-4" />
        <h3 className="text-lg font-medium text-gold mb-2">No Chests Available</h3>
        <p className="text-sm text-gold/50 max-w-sm">
          You don't have any loot chests to open. Acquire chests through gameplay or the marketplace.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filter and Sort Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {traitTypes.length > 0 && (
            <>
              <Filter className="w-4 h-4 text-gold/50" />
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
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 px-2 py-1.5 text-xs text-gold/60 hover:text-gold transition-colors"
                >
                  <X className="w-3 h-3" />
                  Clear ({activeFilterCount})
                </button>
              )}
            </>
          )}
        </div>

        {/* Sort */}
        <button
          onClick={toggleSortMode}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl border border-gold/20 bg-gold/5 text-gold/70 hover:bg-gold/10 hover:border-gold/30 transition-colors"
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
          ID {sortMode === "id-desc" ? "↓" : "↑"}
        </button>
      </div>

      {/* Results count */}
      <div className="text-xs text-gold/50">
        {activeFilterCount > 0
          ? `${filteredAndSortedChests.length} of ${chests.length} chest${chests.length !== 1 ? "s" : ""}`
          : `${chests.length} chest${chests.length !== 1 ? "s" : ""}`}
      </div>

      {/* Empty state after filtering */}
      {filteredAndSortedChests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Package className="w-12 h-12 text-gold/30 mb-3" />
          <h3 className="text-base font-medium text-gold mb-2">No Matching Chests</h3>
          <p className="text-sm text-gold/50 max-w-sm mb-4">No chests match the current filters.</p>
          <button
            onClick={clearFilters}
            className="px-4 py-2 text-sm rounded-xl border border-gold/30 text-gold hover:bg-gold/10 transition-colors"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filteredAndSortedChests.map((chest, index) => {
            const epoch = getChestEpoch(chest.metadata);
            const isOpening = openingChestId === String(chest.token_id);

            return (
              <ChestCard
                key={chest.token_id}
                chest={chest}
                onOpen={() => onOpenChest(String(chest.token_id), epoch)}
                isLoading={isOpening}
                index={index}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
