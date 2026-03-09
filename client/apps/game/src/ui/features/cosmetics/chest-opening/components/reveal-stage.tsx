import {
  BLITZ_CARD_BASE_STYLES,
  BLITZ_CARD_FONT_IMPORT,
  BLITZ_CARD_GOLD_THEME,
} from "@/ui/shared/lib/blitz-card-shared";
import Button from "@/ui/design-system/atoms/button";
import { useChestSounds } from "../hooks/use-chest-sounds";
import { useRevealShare } from "../hooks/use-reveal-share";
import { AssetRarity, ChestAsset } from "../utils/cosmetics";
import Copy from "lucide-react/dist/esm/icons/copy";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Share2 from "lucide-react/dist/esm/icons/share-2";
import X from "lucide-react/dist/esm/icons/x";
import { useEffect, useRef, useState } from "react";
import { ChestStageContainer, ChestStageContent } from "./chest-stage-container";
import { TiltCard } from "./tilt-card";
import { createCardRevealAnimation } from "./use-gsap-timeline";

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

const CHEST_REVEAL_CARD_STYLES = `
  ${BLITZ_CARD_FONT_IMPORT}
  ${BLITZ_CARD_BASE_STYLES}
  ${BLITZ_CARD_GOLD_THEME}

  .blitz-card-root.reveal-card-shell .reveal-center {
    position: absolute;
    left: 188px;
    top: 138px;
    width: 584px;
    height: 268px;
    z-index: 4;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .blitz-card-root.reveal-card-shell .reveal-grid {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
`;

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
    return "justify-center gap-3 flex-wrap";
  };

  // Get card size based on count and screen
  const getCardSize = () => {
    const count = displayAssets.length;
    if (count === 1) {
      return { width: 240, height: 320 };
    }
    if (count <= 3) {
      return { width: 190, height: 250 };
    }
    return { width: 160, height: 210 };
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
              <p className="text-gold/60 text-sm">Loading your rewards...</p>
            </div>
          )}

          {/* Capture area for screenshot - excludes share buttons */}
          <div className="w-full overflow-x-auto pt-2 pb-4">
            <div ref={captureRef} className="mx-auto min-w-[960px] w-[960px]">
              <div
                className="blitz-card-root card-gold reveal-card-shell no-player"
                aria-label="Loot chest reveal card"
              >
                <style dangerouslySetInnerHTML={{ __html: CHEST_REVEAL_CARD_STYLES }} />

                <div className="bg-mark" />
                <div className="bg-smoke" />
                <div className="bg-texture" />
                <div className="bg-layer gradient-overlay" />
                <div className="bg-layer dark-overlay" />

                <img className="corner-mark" src="/images/logos/Eternum-Mark-Black.png" alt="Eternum mark" />

                <div className="title-stack">
                  <span className="eyebrow">Loot Chest</span>
                  <span className="title">Reveal</span>
                </div>

                <img className="realms-logo" src="/images/logos/realms-world-white.svg" alt="Realms World logo" />

                <div className="reveal-center">
                  {imagesLoaded && (
                    <div ref={cardsRef} className={`reveal-grid ${getLayoutClass()}`}>
                      {displayAssets.map((asset, index) => (
                        <div
                          key={`${asset.id}-${index}`}
                          className="reveal-card opacity-0"
                          style={{
                            // Highlight the rarest item (only when multiple items)
                            zIndex: asset === rarestAsset && displayAssets.length > 1 ? 10 : 1,
                            transform: asset === rarestAsset && displayAssets.length > 1 ? "scale(1.08)" : "scale(1)",
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
                </div>

                <div className="powered">
                  <img src="/images/logos/Starknet.png" alt="Starknet logo" />
                  <div className="copy">Powered by Starknet</div>
                </div>

                <div className="cta">
                  <div className="cta-title">Play Now</div>
                  <div className="cta-subtitle">blitz.realms.world</div>
                </div>

                <div className="bg-layer border-frame" />
              </div>
            </div>
          </div>

          {/* Action buttons - outside capture area */}
          <div
            className={`mt-2 flex w-full justify-between items-center px-4 transition-opacity duration-500 ${
              canShowCards && animationComplete ? "opacity-100" : "opacity-0"
            }`}
          >
            {/* Left group: Share buttons */}
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={copyImageToClipboard}
                disabled={isCapturing}
                className="gap-2 !px-3 !py-2"
                forceUppercase={false}
              >
                {isCapturing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                {isCapturing ? "Copying..." : "Copy PNG"}
              </Button>
              <Button
                variant="outline"
                onClick={shareOnX}
                className="gap-2 !px-3 !py-2"
                forceUppercase={false}
                disabled={isCapturing}
              >
                <Share2 className="h-4 w-4" />
                Share on X
              </Button>
            </div>

            {/* Right group: Close and Choose Next buttons */}
            {isDone && (
              <div className="flex gap-3">
                {onClose && (
                  <Button
                    variant="outline"
                    size="md"
                    onClick={onClose}
                    className="text-gold border-gold/50 hover:bg-gold/10 gap-2"
                  >
                    <X className="w-4 h-4" />
                    Close
                  </Button>
                )}
                {onOpenAnother && remainingChestsCount > 0 && (
                  <Button variant="primary" size="md" onClick={onOpenAnother} className="gap-2">
                    Open Next Chest ({remainingChestsCount} remaining)
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
