import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { MergedNftData } from "@/types";
import { AssetRarity, RARITY_STYLES } from "@/utils/cosmetics";
import gsap from "gsap";
import { ArrowUpDown, Package } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getChestRarityFromMetadata } from "./mock-data";

// Rarity order for sorting (highest to lowest)
const RARITY_ORDER: AssetRarity[] = [
  AssetRarity.Legendary,
  AssetRarity.Epic,
  AssetRarity.Rare,
  AssetRarity.Uncommon,
  AssetRarity.Common,
];

type RarityFilter = AssetRarity | "all";

interface ChestSelectionModalProps {
  isOpen: boolean;
  chests: MergedNftData[];
  onSelect: (chestId: string, rarity: AssetRarity) => void;
  onClose: () => void;
  isLoading?: boolean;
  selectedChestId?: string | null;
}

interface ChestCardProps {
  chest: MergedNftData;
  onSelect: () => void;
  isSelected: boolean;
  isLoading: boolean;
  index: number;
}

function ChestCard({ chest, onSelect, isSelected, isLoading, index }: ChestCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const rarity = getChestRarityFromMetadata(chest.metadata);
  const rarityStyle = RARITY_STYLES[rarity];

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
        ${isSelected ? `ring-2 ring-gold shadow-xl ${rarityStyle.glow}` : "shadow-lg hover:shadow-xl"}
        ${isLoading && isSelected ? "pointer-events-none" : ""}
      `}
      onClick={onSelect}
    >
      {/* Chest image */}
      <div className="aspect-square bg-slate-900 relative">
        {image ? (
          <img src={image} alt={`Chest #${chest.token_id}`} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-16 h-16 text-gold/50" />
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
          <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${rarityStyle.bg} text-white`}>
            {rarity}
          </span>
        </div>
        {/* Show key attributes from metadata */}
        {chest.metadata?.attributes && chest.metadata.attributes.length > 0 && (
          <div className="space-y-0.5">
            {chest.metadata.attributes.slice(0, 2).map((attr, idx) => (
              <div key={idx} className="text-xs text-white/50 truncate">
                <span className="text-white/70">{attr.trait_type}:</span> {attr.value}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Glow effect for rarity */}
      <div className={`absolute inset-0 pointer-events-none rounded-xl opacity-20 ${rarityStyle.border} border`} />
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
  const gridRef = useRef<HTMLDivElement>(null);
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>("all");
  const [sortByRarity, setSortByRarity] = useState(false);

  // Filter and sort chests
  const filteredAndSortedChests = useMemo(() => {
    let result = [...chests];

    // Apply rarity filter
    if (rarityFilter !== "all") {
      result = result.filter((chest) => {
        const rarity = getChestRarityFromMetadata(chest.metadata);
        return rarity === rarityFilter;
      });
    }

    // Apply rarity sort (highest to lowest)
    if (sortByRarity) {
      result.sort((a, b) => {
        const aRarity = getChestRarityFromMetadata(a.metadata);
        const bRarity = getChestRarityFromMetadata(b.metadata);
        return RARITY_ORDER.indexOf(aRarity) - RARITY_ORDER.indexOf(bRarity);
      });
    }

    return result;
  }, [chests, rarityFilter, sortByRarity]);

  // Get rarity counts for filter badges
  const rarityCounts = useMemo(() => {
    const counts: Record<AssetRarity, number> = {
      [AssetRarity.Common]: 0,
      [AssetRarity.Uncommon]: 0,
      [AssetRarity.Rare]: 0,
      [AssetRarity.Epic]: 0,
      [AssetRarity.Legendary]: 0,
    };
    chests.forEach((chest) => {
      const rarity = getChestRarityFromMetadata(chest.metadata);
      counts[rarity]++;
    });
    return counts;
  }, [chests]);

  // Handle chest selection
  const handleSelect = (chest: MergedNftData) => {
    if (isLoading) return;

    const rarity = getChestRarityFromMetadata(chest.metadata);
    onSelect(String(chest.token_id), rarity);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col bg-slate-900 border-gold/20">
        <DialogTitle className="sr-only">Select a Chest to Open</DialogTitle>

        {/* Header */}
        <div className="px-6 py-4 border-b border-gold/10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gold">Select a Chest</h2>
              <p className="text-sm text-white/60 mt-1">Choose which chest you want to open</p>
            </div>
            {/* Sort toggle */}
            <Button
              variant={sortByRarity ? "default" : "outline"}
              size="sm"
              onClick={() => setSortByRarity(!sortByRarity)}
              className="gap-2"
            >
              <ArrowUpDown className="w-4 h-4" />
              {sortByRarity ? "By Rarity" : "Sort"}
            </Button>
          </div>

          {/* Rarity filter chips */}
          {chests.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              <Button
                variant={rarityFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setRarityFilter("all")}
                className="text-xs"
              >
                All ({chests.length})
              </Button>
              {RARITY_ORDER.map((rarity) => {
                const count = rarityCounts[rarity];
                if (count === 0) return null;
                const style = RARITY_STYLES[rarity];
                return (
                  <Button
                    key={rarity}
                    variant={rarityFilter === rarity ? "default" : "outline"}
                    size="sm"
                    onClick={() => setRarityFilter(rarity)}
                    className={`text-xs capitalize ${rarityFilter === rarity ? style.bg : ""}`}
                  >
                    {rarity} ({count})
                  </Button>
                );
              })}
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
                  : "No chests match the current filter. Try selecting a different rarity."}
              </p>
              {rarityFilter !== "all" && (
                <Button variant="outline" size="sm" onClick={() => setRarityFilter("all")} className="mt-4">
                  Clear Filter
                </Button>
              )}
            </div>
          ) : (
            // Chest grid
            <div ref={gridRef} className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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
        <div className="px-6 py-4 border-t border-gold/10 flex justify-between items-center">
          <span className="text-sm text-white/50">
            {rarityFilter !== "all"
              ? `${filteredAndSortedChests.length} of ${chests.length} chest${chests.length !== 1 ? "s" : ""}`
              : `${chests.length} chest${chests.length !== 1 ? "s" : ""} available`}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
