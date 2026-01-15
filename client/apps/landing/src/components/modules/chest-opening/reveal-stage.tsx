import { Button } from "@/components/ui/button";
import { useChestSounds } from "@/hooks/use-chest-sounds";
import { useRevealShare } from "@/hooks/use-reveal-share";
import { AssetRarity, ChestAsset, RARITY_STYLES } from "@/utils/cosmetics";
import { Copy, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ChestStageContainer, ChestStageContent, ChestStageHeader } from "./chest-stage-container";
import { TiltCard } from "./tilt-card";
import { createCardRevealAnimation } from "./use-gsap-timeline";

// X (Twitter) brand icon
function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

interface RevealStageProps {
  assets: ChestAsset[];
  chestRarity: AssetRarity;
  onComplete: () => void;
  showContent: boolean;
  // Action handlers for buttons
  onClose?: () => void;
  onOpenAnother?: () => void;
  remainingChestsCount?: number;
  isDone?: boolean;
}

// Helper to preload a single image
const preloadImage = (src: string): Promise<boolean> => {
  return new Promise((resolve) => {
    if (!src) {
      resolve(false);
      return;
    }
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => {
      console.warn(`Failed to preload image: ${src}`);
      resolve(false);
    };
    img.src = src;
  });
};

// Helper to fetch metadata from IPFS and get the image URL
const fetchMetadataAndGetImage = async (metadataUrl: string): Promise<string | null> => {
  try {
    const response = await fetch(metadataUrl);
    if (!response.ok) {
      console.warn(`Failed to fetch metadata from ${metadataUrl}`);
      return null;
    }
    const metadata = await response.json();
    // The image field may be an IPFS URL (ipfs://...) or HTTP URL
    let imageUrl = metadata.image;
    if (imageUrl?.startsWith("ipfs://")) {
      // Convert IPFS URL to HTTP gateway URL
      imageUrl = imageUrl.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
    }
    return imageUrl || null;
  } catch (error) {
    console.warn(`Error fetching metadata from ${metadataUrl}:`, error);
    return null;
  }
};

// Check if path is a local image (starts with /) or an IPFS URL
const isLocalImage = (path: string): boolean => {
  return path.startsWith("/");
};

// Rarity order for comparison
const RARITY_ORDER: AssetRarity[] = [
  AssetRarity.Common,
  AssetRarity.Uncommon,
  AssetRarity.Rare,
  AssetRarity.Epic,
  AssetRarity.Legendary,
  AssetRarity.Mythic,
];

// Helper to reorder assets with the highest rarity item in the middle
const reorderWithRarestInMiddle = (assets: ChestAsset[]): ChestAsset[] => {
  if (assets.length <= 1) return assets;

  // Find the index of the rarest asset
  let rarestIndex = 0;
  let highestRarityIndex = RARITY_ORDER.indexOf(assets[0].rarity);

  for (let i = 1; i < assets.length; i++) {
    const rarityIndex = RARITY_ORDER.indexOf(assets[i].rarity);
    if (rarityIndex > highestRarityIndex) {
      highestRarityIndex = rarityIndex;
      rarestIndex = i;
    }
  }

  // Calculate the middle position
  const middleIndex = Math.floor(assets.length / 2);

  // If rarest is already in the middle, return as-is
  if (rarestIndex === middleIndex) return assets;

  // Create a new array with the rarest item moved to the middle
  const result = [...assets];
  const [rarestItem] = result.splice(rarestIndex, 1);
  result.splice(middleIndex, 0, rarestItem);

  return result;
};

// Helper to resolve and preload all asset images
// Uses local images as primary, falls back to IPFS metadata if local fails
const resolveAndPreloadAssetImages = async (assets: ChestAsset[]): Promise<Map<string, string>> => {
  const imageMap = new Map<string, string>();

  await Promise.all(
    assets.map(async (asset) => {
      if (!asset.imagePath) return;

      if (isLocalImage(asset.imagePath)) {
        // Local image - try to preload directly
        const success = await preloadImage(asset.imagePath);
        if (success) {
          imageMap.set(asset.attributesRaw, asset.imagePath);
        }
        // If local image fails, we could try IPFS fallback here if needed
      } else {
        // IPFS metadata URL - fetch metadata and get image URL
        const imageUrl = await fetchMetadataAndGetImage(asset.imagePath);
        if (imageUrl) {
          await preloadImage(imageUrl);
          imageMap.set(asset.attributesRaw, imageUrl);
        }
      }
    }),
  );

  return imageMap;
};

export function RevealStage({
  assets,
  chestRarity,
  onComplete,
  showContent,
  onClose,
  onOpenAnother,
  remainingChestsCount = 0,
  isDone = false,
}: RevealStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const [animationComplete, setAnimationComplete] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [isPreloading, setIsPreloading] = useState(false);
  const [resolvedAssets, setResolvedAssets] = useState<ChestAsset[]>([]);

  // Sound effects
  const { playCompletion } = useChestSounds();

  // Share functionality
  const { captureRef, copyImageToClipboard, shareOnX, isCapturing } = useRevealShare({
    chestRarity,
  });

  // Fetch metadata and preload images when assets change
  useEffect(() => {
    if (assets.length === 0) return;

    let isMounted = true;
    setIsPreloading(true);
    setImagesLoaded(false);

    resolveAndPreloadAssetImages(assets).then((imageMap) => {
      if (isMounted) {
        // Update assets with resolved image URLs
        const updated = assets.map((asset) => ({
          ...asset,
          imagePath: imageMap.get(asset.attributesRaw) || asset.imagePath,
        }));
        setResolvedAssets(updated);
        setImagesLoaded(true);
        setIsPreloading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [assets]);

  // Run reveal animation when content becomes visible AND images are loaded
  useEffect(() => {
    if (!showContent || !imagesLoaded || !cardsRef.current || animationComplete) return;

    const cards = cardsRef.current.querySelectorAll<HTMLElement>(".reveal-card");
    if (cards.length === 0) return;

    // Find highest rarity for completion sound
    const highestRarity = assets.reduce((highest, asset) => {
      const currentIndex = RARITY_ORDER.indexOf(asset.rarity);
      const highestIndex = RARITY_ORDER.indexOf(highest);
      return currentIndex > highestIndex ? asset.rarity : highest;
    }, AssetRarity.Common);

    // Play completion sound immediately when cards start revealing
    playCompletion(highestRarity);

    // Create and play the reveal animation
    const animation = createCardRevealAnimation(cards, {
      duration: 0.6,
      stagger: 0.2,
      onComplete: () => {
        setAnimationComplete(true);
        // Delay before signaling complete to allow user to see cards
        setTimeout(onComplete, 500);
      },
    });

    return () => {
      animation.kill();
    };
  }, [showContent, imagesLoaded, resolvedAssets, animationComplete, onComplete, assets, playCompletion]);

  // Show content only when images are loaded
  const canShowCards = showContent && imagesLoaded;

  // Use resolved assets for display, reordered with rarest in middle
  const baseAssets = resolvedAssets.length > 0 ? resolvedAssets : assets;
  const displayAssets = reorderWithRarestInMiddle(baseAssets);

  // Determine layout based on number of assets
  const getLayoutClass = () => {
    const count = displayAssets.length;
    if (count === 1) return "justify-center";
    if (count === 2) return "justify-center gap-6";
    if (count === 3) return "justify-center gap-4";
    return "justify-center gap-4 flex-wrap";
  };

  // Get card size based on count and screen
  const getCardSize = () => {
    const count = displayAssets.length;
    if (count === 1) {
      // Smaller size for single item to fit in container without overflow
      return { width: 280, height: 370 };
    }
    if (count <= 3) {
      return { width: 260, height: 340 };
    }
    return { width: 220, height: 290 };
  };

  // The rarest item is already in the middle after reordering
  const middleIndex = Math.floor(displayAssets.length / 2);
  const rarestAsset = displayAssets.length > 0 ? displayAssets[middleIndex] : null;

  const cardSize = getCardSize();

  return (
    <ChestStageContainer>
      <ChestStageContent className="py-4 !justify-start overflow-y-auto">
        <div ref={containerRef} className="flex flex-col items-center w-full">
          {/* Loading state while images preload */}
          {showContent && isPreloading && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 className="w-12 h-12 text-gold animate-spin" />
              <p className="text-white/60 text-sm">Loading your rewards...</p>
            </div>
          )}

          {/* Capture area for screenshot - excludes share buttons */}
          <div ref={captureRef} className="flex flex-col items-center w-full pt-4 pb-6">
            {/* Header - show once images are loaded */}
            <div className={`transition-opacity duration-500 ${canShowCards ? "opacity-100" : "opacity-0"}`}>
              <ChestStageHeader
                title="Chest Opened!"
                subtitle={`You received ${displayAssets.length} item${displayAssets.length !== 1 ? "s" : ""}`}
              />
            </div>

            {/* Cards container - only render when images are loaded */}
            {imagesLoaded && (
              <div
                ref={cardsRef}
                className={`flex ${getLayoutClass()} items-center max-w-full overflow-hidden py-4 px-8`}
              >
                {displayAssets.map((asset, index) => (
                  <div
                    key={`${asset.id}-${index}`}
                    className="reveal-card opacity-0"
                    style={{
                      // Highlight the rarest item (only when multiple items)
                      zIndex: asset === rarestAsset && displayAssets.length > 1 ? 10 : 1,
                      transform: asset === rarestAsset && displayAssets.length > 1 ? "scale(1.05)" : "scale(1)",
                    }}
                  >
                    <TiltCard
                      asset={asset}
                      size={
                        asset === rarestAsset && displayAssets.length > 1
                          ? { width: cardSize.width * 1.1, height: cardSize.height * 1.1 }
                          : cardSize
                      }
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Stats summary - always rendered to prevent layout shift */}
            <div
              className={`mt-6 flex flex-wrap justify-center gap-3 transition-opacity duration-500 ${
                canShowCards && animationComplete ? "opacity-100" : "opacity-0"
              }`}
            >
              {Object.entries(
                displayAssets.reduce(
                  (acc, asset) => {
                    acc[asset.rarity] = (acc[asset.rarity] || 0) + 1;
                    return acc;
                  },
                  {} as Record<string, number>,
                ),
              ).map(([rarity, count]) => {
                const style = RARITY_STYLES[rarity as keyof typeof RARITY_STYLES];
                return (
                  <div key={rarity} className={`px-3 py-1.5 rounded-lg ${style.bg}/20 border ${style.border}`}>
                    <span className={`text-sm font-bold ${style.text}`}>
                      {count}x {rarity.charAt(0).toUpperCase() + rarity.slice(1)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action buttons - outside capture area */}
          <div
            className={`mt-6 flex w-full justify-between items-center px-4 transition-opacity duration-500 ${
              canShowCards && animationComplete ? "opacity-100" : "opacity-0"
            }`}
          >
            {/* Left group: Share buttons */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={shareOnX}
                className="gap-2 text-gold border-gold/50 hover:bg-gold/10"
                disabled={isCapturing}
              >
                <XIcon className="w-4 h-4" />
                Share on X
              </Button>
              <Button
                variant="outline"
                onClick={copyImageToClipboard}
                disabled={isCapturing}
                className="gap-2 text-gold border-gold/50 hover:bg-gold/10"
              >
                {isCapturing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                {isCapturing ? "Preparing..." : "Copy Image"}
              </Button>
            </div>

            {/* Right group: Close and Choose Next buttons */}
            {isDone && (
              <div className="flex gap-3">
                {onClose && (
                  <Button
                    variant="outline"
                    size="default"
                    onClick={onClose}
                    className="text-gold border-gold/50 hover:bg-gold/10 gap-2"
                  >
                    <X className="w-4 h-4" />
                    Close
                  </Button>
                )}
                {onOpenAnother && remainingChestsCount > 0 && (
                  <Button variant="cta" size="default" onClick={onOpenAnother} className="gap-2">
                    Choose Next Chest ({remainingChestsCount} available)
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </ChestStageContent>
    </ChestStageContainer>
  );
}

// Collection summary component (optional, can be shown after reveal)
interface CollectionSummaryProps {
  assets: ChestAsset[];
  totalOwned?: number;
  collectionSize?: number;
}

export function CollectionSummary({ assets, totalOwned = 0, collectionSize = 22 }: CollectionSummaryProps) {
  // Group by rarity
  const byRarity = assets.reduce(
    (acc, asset) => {
      acc[asset.rarity] = (acc[asset.rarity] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="bg-slate-900/80 rounded-xl p-6 backdrop-blur-sm border border-gold/10">
      <h3 className="text-lg font-bold text-gold mb-4">Items Received</h3>

      {/* Rarity breakdown */}
      <div className="space-y-2">
        {Object.entries(byRarity).map(([rarity, count]) => {
          const style = RARITY_STYLES[rarity as keyof typeof RARITY_STYLES];
          return (
            <div key={rarity} className="flex items-center justify-between">
              <span className={`${style.text} capitalize`}>{rarity}</span>
              <span className="text-white font-mono">{count}</span>
            </div>
          );
        })}
      </div>

      {/* Collection progress */}
      {collectionSize > 0 && (
        <div className="mt-4 pt-4 border-t border-gold/10">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/60">Collection Progress</span>
            <span className="text-gold font-bold">
              {totalOwned}/{collectionSize}
            </span>
          </div>
          <div className="mt-2 h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gold rounded-full transition-all duration-500"
              style={{ width: `${(totalOwned / collectionSize) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
