import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MergedNftData } from "@/types";
import gsap from "gsap";
import { ArrowUpDown, ChevronDown, Filter, Package, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChestStageContainer } from "./chest-stage-container";
import { ChestEpoch } from "./use-chest-opening-flow";

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
  if (!metadata?.attributes) return "eternum-rewards-s1";

  // Get the ID attribute (e.g., "Eternum Rewards Chest", "Blitz Rewards Chest")
  const idAttr = metadata.attributes.find((a) => a.trait_type === "ID");
  // Get the Epoch attribute (e.g., "Season 0", "Season 1")
  const epochAttr = metadata.attributes.find((a) => a.trait_type === "Epoch");

  if (idAttr && epochAttr) {
    const idValue = String(idAttr.value).toLowerCase();
    const epochValue = String(epochAttr.value).toLowerCase();

    // Blitz Rewards Chest + Season 0 → blitz-rewards-s0
    if (idValue.includes("blitz") && epochValue.includes("0")) {
      return "blitz-rewards-s0";
    }
    // Eternum Rewards Chest + Season 1 → eternum-rewards-s1
    if (idValue.includes("eternum") && epochValue.includes("1")) {
      return "eternum-rewards-s1";
    }
  }

  // Default to eternum-rewards-s1
  return "eternum-rewards-s1";
}

interface ChestCardProps {
  chest: MergedNftData;
  onSelect: () => void;
  isSelected: boolean;
  isLoading: boolean;
  index: number;
}

// Extract all trait values for a specific trait type
function getTraitValue(metadata: MergedNftData["metadata"] | undefined, traitType: string): string | null {
  if (!metadata?.attributes) return null;
  const attr = metadata.attributes.find((a) => a.trait_type.toLowerCase() === traitType.toLowerCase());
  return attr ? String(attr.value) : null;
}

function ChestCard({ chest, onSelect, isSelected, isLoading, index }: ChestCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [imageError, setImageError] = useState(false);

  // Transform IPFS URLs to use Pinata gateway
  const image = chest.metadata?.image?.startsWith("ipfs://")
    ? chest.metadata.image.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/")
    : chest.metadata?.image;

  // GSAP hover animations
  useEffect(() => {
    if (!cardRef.current) return;

    const card = cardRef.current;

    const handleMouseEnter = () => {
      gsap.to(card, {
        scale: 1.05,
        y: -8,
        duration: 0.3,
        ease: "power2.out",
      });
    };

    const handleMouseLeave = () => {
      gsap.to(card, {
        scale: 1,
        y: 0,
        duration: 0.3,
        ease: "power2.out",
      });
    };

    card.addEventListener("mouseenter", handleMouseEnter);
    card.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      card.removeEventListener("mouseenter", handleMouseEnter);
      card.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  // Entry animation
  useEffect(() => {
    if (!cardRef.current) return;

    gsap.fromTo(
      cardRef.current,
      {
        opacity: 0,
        y: 30,
        scale: 0.9,
      },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.4,
        delay: index * 0.1,
        ease: "back.out(1.4)",
      },
    );
  }, [index]);

  return (
    <div
      ref={cardRef}
      className={`
        relative rounded-xl overflow-hidden cursor-pointer
        transition-shadow duration-200
        ${isSelected ? "ring-2 ring-gold shadow-xl shadow-gold/20" : "shadow-lg hover:shadow-xl"}
        ${isLoading && isSelected ? "pointer-events-none" : ""}
      `}
      onClick={onSelect}
    >
      {/* Chest image */}
      <div className="aspect-square bg-slate-900 relative">
        {image && !imageError ? (
          <img
            src={image}
            alt={`Chest #${chest.token_id}`}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-16 h-16" />
          </div>
        )}

        {/* Loading overlay */}
        {isLoading && isSelected && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Selection indicator */}
        {isSelected && !isLoading && (
          <div className="absolute top-2 right-2 w-6 h-6 bg-gold rounded-full flex items-center justify-center">
            <span className="text-background text-sm font-bold">✓</span>
          </div>
        )}
      </div>

      {/* Chest info */}
      <div className="p-3 bg-slate-800">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-white">#{chest.token_id}</span>
        </div>
        {/* Show key attributes from metadata */}
        {chest.metadata?.attributes && chest.metadata.attributes.length > 0 && (
          <div className="space-y-0.5">
            {chest.metadata.attributes.slice(0, 3).map((attr, idx) => (
              <div key={idx} className="text-xs text-white/50 truncate">
                <span className="text-white/70">{attr.trait_type}:</span> {attr.value}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Glow effect */}
      <div className="absolute inset-0 pointer-events-none rounded-xl opacity-20 border border-gold/30" />
    </div>
  );
}

// Filter dropdown component
interface FilterDropdownProps {
  label: string;
  value: string | null;
  options: string[];
  onChange: (value: string | null) => void;
}

function FilterDropdown({ label, value, options, onChange }: FilterDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={value ? "default" : "outline"}
          size="sm"
          className={`gap-1 text-xs min-w-[100px] justify-between ${
            value ? "" : "text-white/70 border-white/20 hover:bg-white/10 hover:text-white"
          }`}
        >
          <span className="truncate">{value || label}</span>
          <ChevronDown className="w-3 h-3 flex-shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[300px] overflow-y-auto">
        <DropdownMenuItem onClick={() => onChange(null)} className={!value ? "bg-gold/10" : ""}>
          All {label}s
        </DropdownMenuItem>
        {options.map((option) => (
          <DropdownMenuItem
            key={option}
            onClick={() => onChange(option)}
            className={value === option ? "bg-gold/10" : ""}
          >
            {option}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
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
              size="sm"
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
                  variant="ghost"
                  size="sm"
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
                  size="sm"
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
