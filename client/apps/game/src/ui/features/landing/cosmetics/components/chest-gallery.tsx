import { ChestCard } from "@/ui/features/landing/chest-opening/components";
import { ChestEpoch } from "@/ui/features/landing/chest-opening/hooks/use-chest-opening-flow";
import { MergedNftData } from "@/ui/features/landing/chest-opening/utils/types";
import { Package } from "lucide-react";

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

export function ChestGallery({ chests, onOpenChest, isLoading = false, openingChestId }: ChestGalleryProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="aspect-square animate-pulse rounded-xl bg-white/5" />
        ))}
      </div>
    );
  }

  if (chests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Package className="w-16 h-16 text-gold/30 mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">No Chests Available</h3>
        <p className="text-sm text-white/50 max-w-sm">
          You don't have any loot chests to open. Acquire chests through gameplay or the marketplace.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {chests.map((chest, index) => {
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
  );
}
