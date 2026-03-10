import Button from "@/ui/design-system/atoms/button";
import {
  BLITZ_CARD_BASE_STYLES,
  BLITZ_CARD_FONT_IMPORT,
  BLITZ_CARD_GOLD_THEME,
} from "@/ui/shared/lib/blitz-card-shared";
import Copy from "lucide-react/dist/esm/icons/copy";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Share2 from "lucide-react/dist/esm/icons/share-2";
import X from "lucide-react/dist/esm/icons/x";
import { useEffect, useRef, useState } from "react";
import { MOCK_CHEST_OPENING } from "../hooks/mock-data";
import { useChestSounds } from "../hooks/use-chest-sounds";
import { useRevealShare } from "../hooks/use-reveal-share";
import { AssetRarity, ChestAsset, RARITY_STYLES } from "../utils/cosmetics";
import { ChestStageContainer, ChestStageContent } from "./chest-stage-container";
import { TiltCard } from "./tilt-card";
import { createCardRevealAnimation } from "./use-gsap-timeline";

interface RevealStageProps {
  assets: ChestAsset[];
  chestRarity: AssetRarity;
  chestTypeLabel: string;
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

  .blitz-card-root.reveal-card-shell {
    --reveal-ambient:
      radial-gradient(34% 44% at 22% 44%, rgba(191, 149, 63, 0.18) 0%, transparent 72%),
      radial-gradient(40% 54% at 50% 42%, rgba(191, 149, 63, 0.18) 0%, transparent 74%),
      radial-gradient(34% 44% at 78% 44%, rgba(191, 149, 63, 0.18) 0%, transparent 72%);
    --reveal-vignette: radial-gradient(
      118% 108% at 50% 46%,
      rgba(0, 0, 0, 0) 0%,
      rgba(0, 0, 0, 0.18) 56%,
      rgba(0, 0, 0, 0.76) 100%
    );
    --reveal-smoke-opacity: 0.06;
    --reveal-smoke-scale: 1.04;
  }

  .blitz-card-root.reveal-card-shell .bg-smoke {
    opacity: var(--reveal-smoke-opacity);
    transform: translate(-50%, -50%) rotate(180deg) scale(var(--reveal-smoke-scale));
  }

  .blitz-card-root.reveal-card-shell .reveal-ambient {
    background: var(--reveal-ambient);
    mix-blend-mode: screen;
    opacity: 0.92;
    z-index: 2;
  }

  .blitz-card-root.reveal-card-shell .dark-overlay {
    background: var(--reveal-vignette);
  }

  .blitz-card-root.reveal-card-shell.layout-count-1 {
    --reveal-ambient:
      radial-gradient(26% 30% at 50% 43%, rgba(250, 232, 179, 0.28) 0%, rgba(191, 149, 63, 0.22) 38%, transparent 76%),
      radial-gradient(54% 58% at 50% 44%, rgba(191, 149, 63, 0.2) 0%, rgba(98, 69, 20, 0.1) 52%, transparent 82%);
    --reveal-vignette: radial-gradient(
      92% 96% at 50% 43%,
      rgba(0, 0, 0, 0) 0%,
      rgba(0, 0, 0, 0.1) 42%,
      rgba(0, 0, 0, 0.74) 82%,
      rgba(0, 0, 0, 0.9) 100%
    );
    --reveal-smoke-opacity: 0.08;
    --reveal-smoke-scale: 0.84;
  }

  .blitz-card-root.reveal-card-shell.layout-count-2 {
    --reveal-ambient:
      radial-gradient(28% 38% at 39% 43%, rgba(243, 224, 172, 0.2) 0%, rgba(191, 149, 63, 0.16) 42%, transparent 76%),
      radial-gradient(28% 38% at 61% 43%, rgba(243, 224, 172, 0.2) 0%, rgba(191, 149, 63, 0.16) 42%, transparent 76%),
      radial-gradient(34% 24% at 50% 49%, rgba(191, 149, 63, 0.1) 0%, transparent 88%);
    --reveal-vignette: radial-gradient(
      104% 102% at 50% 45%,
      rgba(0, 0, 0, 0) 0%,
      rgba(0, 0, 0, 0.14) 48%,
      rgba(0, 0, 0, 0.74) 88%,
      rgba(0, 0, 0, 0.88) 100%
    );
    --reveal-smoke-opacity: 0.07;
    --reveal-smoke-scale: 0.94;
  }

  .blitz-card-root.reveal-card-shell.layout-count-3 {
    --reveal-ambient:
      radial-gradient(24% 40% at 24% 44%, rgba(191, 149, 63, 0.16) 0%, transparent 74%),
      radial-gradient(30% 48% at 50% 42%, rgba(243, 224, 172, 0.16) 0%, rgba(191, 149, 63, 0.12) 42%, transparent 76%),
      radial-gradient(24% 40% at 76% 44%, rgba(191, 149, 63, 0.16) 0%, transparent 74%),
      linear-gradient(180deg, rgba(191, 149, 63, 0.06) 0%, transparent 44%);
    --reveal-vignette: radial-gradient(
      118% 108% at 50% 46%,
      rgba(0, 0, 0, 0) 0%,
      rgba(0, 0, 0, 0.18) 56%,
      rgba(0, 0, 0, 0.76) 100%
    );
    --reveal-smoke-opacity: 0.06;
    --reveal-smoke-scale: 1.04;
  }

  .blitz-card-root.reveal-card-shell.layout-count-3 .reveal-grid {
    margin-top: 0;
  }

  .blitz-card-root.reveal-card-shell.layout-count-2 .reveal-meta-card {
    min-height: 30px;
  }

  .blitz-card-root.reveal-card-shell.layout-count-3 .reveal-card-stack {
    gap: 5px;
  }

  .blitz-card-root.reveal-card-shell.layout-count-3 .reveal-card-top {
    gap: 4px;
  }

  .blitz-card-root.reveal-card-shell.layout-count-3 .reveal-meta-card {
    min-height: 24px;
    border-radius: 10px;
    padding: 3px 7px;
    gap: 1px;
  }

  .blitz-card-root.reveal-card-shell.layout-count-3 .reveal-meta-type {
    font-size: 9px;
  }

  .blitz-card-root.reveal-card-shell.layout-count-3 .reveal-meta-rarity {
    font-size: 9px;
  }
  .blitz-card-root.reveal-card-shell.layout-count-3 .reveal-meta-troop {
    font-size: 12px;
  }

  .blitz-card-root.reveal-card-shell .reveal-center {
    position: absolute;
    left: 166px;
    top: 132px;
    width: 584px;
    height: 330px;
    z-index: 4;
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: center;
    justify-content: flex-start;
  }

  .blitz-card-root.reveal-card-shell .reveal-grid {
    width: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    margin-top: 16px;
  }

  .blitz-card-root.reveal-card-shell .reveal-card-stack {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .blitz-card-root.reveal-card-shell .reveal-card-backlight {
    position: absolute;
    top: 18px;
    left: 50%;
    width: 78%;
    height: 72%;
    transform: translateX(-50%);
    border-radius: 999px;
    filter: blur(30px);
    opacity: 0.58;
    pointer-events: none;
    z-index: 0;
  }

  .blitz-card-root.reveal-card-shell .reveal-card-top {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .blitz-card-root.reveal-card-shell .reveal-card-heading {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .blitz-card-root.reveal-card-shell .reveal-card-name {
    width: 100%;
    font-family: "IM Fell English", serif;
    font-size: 13px;
    line-height: 1;
    color: rgba(255, 247, 229, 0.96);
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-shadow: 0 2px 14px rgba(0, 0, 0, 0.4);
  }

  .blitz-card-root.reveal-card-shell .reveal-card-rule {
    width: min(72px, 38%);
    height: 1px;
    background: linear-gradient(90deg, transparent 0%, rgba(191, 149, 63, 0.85) 24%, rgba(252, 246, 186, 0.95) 50%, rgba(191, 149, 63, 0.85) 76%, transparent 100%);
    box-shadow: 0 0 12px rgba(191, 149, 63, 0.28);
    opacity: 0.9;
  }

  .blitz-card-root.reveal-card-shell .reveal-card-visual {
    position: relative;
    transform-origin: center top;
  }

  .blitz-card-root.reveal-card-shell .reveal-card-sheen {
    position: absolute;
    inset: 0;
    border-radius: 18px;
    pointer-events: none;
    mix-blend-mode: screen;
    opacity: 0.5;
  }

  .blitz-card-root.reveal-card-shell .reveal-meta-card {
    width: 100%;
    min-height: 0;
    padding: 0 4px;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    gap: 2px;
  }

  .blitz-card-root.reveal-card-shell .reveal-meta-top {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 8px;
    min-width: 0;
  }

  .blitz-card-root.reveal-card-shell .reveal-meta-type {
    font-family: "Montserrat", sans-serif;
    font-size: 10px;
    line-height: 1;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: rgba(255, 247, 229, 0.9);
    flex: 1 1 auto;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .blitz-card-root.reveal-card-shell .reveal-meta-rarity {
    font-family: "Montserrat", sans-serif;
    font-size: 8px;
    line-height: 1;
    letter-spacing: 0.06em;
    flex-shrink: 0;
    white-space: nowrap;
  }

  .blitz-card-root.reveal-card-shell .reveal-meta-troop {
    font-family: "IM Fell English", serif;
    font-size: 12px;
    line-height: 1;
    font-style: italic;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .blitz-card-root.reveal-card-shell .reveal-meta-troop {
    color: rgba(255, 255, 255, 0.64);
  }

  .blitz-card-root.reveal-card-shell .powered {
    transform: translateY(4px) scale(0.9);
    transform-origin: left bottom;
    opacity: 0.92;
  }

  .blitz-card-root.reveal-card-shell .cta {
    transform: translateY(6px) scale(0.88);
    transform-origin: right bottom;
    opacity: 0.92;
  }
`;

export function RevealStage({
  assets,
  chestRarity,
  chestTypeLabel,
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
  const [mockDisplayCount, setMockDisplayCount] = useState(3);

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
  const reorderedAssets = reorderWithRarestInMiddle(baseAssets);
  const mockSafeCount = Math.max(1, Math.min(mockDisplayCount, reorderedAssets.length));
  const displayAssets = MOCK_CHEST_OPENING ? reorderedAssets.slice(0, mockSafeCount) : reorderedAssets;

  // Keep mock count in sync when the number of available assets changes
  useEffect(() => {
    if (!MOCK_CHEST_OPENING || reorderedAssets.length === 0) return;
    setMockDisplayCount((current) => Math.max(1, Math.min(current, reorderedAssets.length)));
  }, [reorderedAssets.length]);

  // Determine layout based on number of assets
  const getLayoutClass = () => {
    const count = displayAssets.length;
    if (count === 1) return "justify-center";
    if (count === 2) return "justify-center";
    if (count === 3) return "justify-center";
    return "justify-center gap-3 flex-wrap";
  };

  const getBaseCardSize = () => {
    const count = displayAssets.length;
    if (count <= 3) {
      return { width: 216, height: 216 };
    }
    return { width: 160, height: 210 };
  };

  const getLayoutPreset = () => {
    const count = displayAssets.length;
    if (count === 1) {
      return { gap: 0, baseScale: 1.14, heroScale: 1, heroLift: -18, supportLift: 0 };
    }
    if (count === 2) {
      return { gap: 38, baseScale: 1.05, heroScale: 1.04, heroLift: -10, supportLift: 10 };
    }
    if (count === 3) {
      return { gap: 28, baseScale: 1, heroScale: 1.08, heroLift: -12, supportLift: 12 };
    }
    return { gap: 12, baseScale: 1, heroScale: 1, heroLift: 0, supportLift: 0 };
  };

  const scaleCardSize = (size: { width: number; height: number }, scale: number) => ({
    width: Math.round(size.width * scale),
    height: Math.round(size.height * scale),
  });

  // Only 3-item reveals promote a hero card. 2-item reveals stay balanced.
  const middleIndex = Math.floor(displayAssets.length / 2);
  const heroAsset = displayAssets.length === 3 ? displayAssets[middleIndex] : null;
  const isSoloLayout = displayAssets.length === 1;
  const baseCardSize = getBaseCardSize();
  const layoutPreset = getLayoutPreset();
  const layoutCountClass = `layout-count-${Math.min(Math.max(displayAssets.length, 1), 3)}`;
  const mockCountOptions = [1, 2, 3].filter((count) => count <= reorderedAssets.length);

  return (
    <ChestStageContainer>
      {onClose && (
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      )}
      <ChestStageContent className="relative py-4 !justify-start overflow-y-auto">
        <div ref={containerRef} className="flex flex-col items-center w-full">
          {/* Loading state while images preload */}
          {showContent && isPreloading && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 className="w-12 h-12 text-gold animate-spin" />
              <p className="text-gold/60 text-sm">Loading your rewards...</p>
            </div>
          )}

          {/* Capture area for screenshot - excludes share buttons */}
          <div className={`w-full overflow-x-auto pb-4 ${onClose ? "pt-10" : "pt-2"}`}>
            <div ref={captureRef} className="mx-auto min-w-[960px] w-[960px]">
              <div
                className={`blitz-card-root card-gold reveal-card-shell no-player ${layoutCountClass}`}
                aria-label="Loot chest reveal card"
              >
                <style dangerouslySetInnerHTML={{ __html: CHEST_REVEAL_CARD_STYLES }} />

                <div className="bg-mark" />
                <div className="bg-smoke" />
                <div className="bg-texture" />
                <div className="bg-layer reveal-ambient" />
                <div className="bg-layer gradient-overlay" />
                <div className="bg-layer dark-overlay" />

                <img className="corner-mark" src="/images/logos/Eternum-Mark-Black.png" alt="Eternum mark" />

                <div className="title-stack">
                  <span className="eyebrow">{chestTypeLabel}</span>
                  <span className="title">Loot Chest Opening</span>
                </div>

                <img className="realms-logo" src="/images/logos/realms-world-white.svg" alt="Realms World logo" />

                <div className="reveal-center">
                  {imagesLoaded && (
                    <div ref={cardsRef} className={`reveal-grid ${getLayoutClass()}`} style={{ gap: layoutPreset.gap }}>
                      {displayAssets.map((asset, index) => {
                        const isHero = isSoloLayout || asset === heroAsset;
                        const cardScale = layoutPreset.baseScale * (isHero ? layoutPreset.heroScale : 1);
                        const displayCardSize = scaleCardSize(baseCardSize, cardScale);
                        const verticalOffset = isSoloLayout ? layoutPreset.heroLift : 0;
                        const rarityStyle = RARITY_STYLES[asset.rarity];
                        const rarityLabel = asset.rarity.toUpperCase();
                        return (
                          <div
                            key={`${asset.id}-${index}`}
                            className="reveal-card reveal-card-stack opacity-0"
                            style={{
                              width: displayCardSize.width,
                              marginTop: verticalOffset,
                              zIndex: isHero ? 10 : 1,
                            }}
                          >
                            <div
                              className="reveal-card-backlight"
                              style={{
                                background: `radial-gradient(circle, ${rarityStyle.hex}80 0%, ${rarityStyle.hex}20 46%, transparent 76%)`,
                                opacity: isHero ? 0.82 : 0.58,
                              }}
                            />
                            <div className="reveal-card-top">
                              <div className="reveal-card-heading">
                                <div className="reveal-card-name">{asset.name}</div>
                                <div className="reveal-card-rule" />
                              </div>
                              <div className="reveal-card-visual">
                                <TiltCard asset={asset} showText={false} size={displayCardSize} />
                                <div
                                  className="reveal-card-sheen"
                                  style={{
                                    background: `linear-gradient(140deg, ${rarityStyle.hex}30 0%, transparent 34%, transparent 72%, ${rarityStyle.hex}1c 100%)`,
                                  }}
                                />
                              </div>
                            </div>
                            {canShowCards && animationComplete && (
                              <div className="reveal-meta-card">
                                <div className="reveal-meta-top">
                                  <span className="reveal-meta-type">{asset.type}</span>
                                  <span className="reveal-meta-rarity" style={{ color: rarityStyle.hex }}>
                                    {rarityLabel}
                                  </span>
                                </div>
                                {asset.troopType && <div className="reveal-meta-troop">{asset.troopType}</div>}
                              </div>
                            )}
                          </div>
                        );
                      })}
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
              showContent ? "opacity-100" : "opacity-0"
            }`}
          >
            {/* Left group: Share buttons */}
            <div className="flex items-center gap-3">
              {MOCK_CHEST_OPENING && mockCountOptions.length > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-gold/20 bg-black/30 px-2 py-1">
                  <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-gold/55">Items</span>
                  <div className="flex items-center gap-1">
                    {mockCountOptions.map((count) => {
                      const isActive = mockDisplayCount === count;
                      return (
                        <button
                          key={count}
                          type="button"
                          onClick={() => {
                            setAnimationComplete(false);
                            setMockDisplayCount(count);
                          }}
                          className={`min-w-7 rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
                            isActive ? "bg-gold text-dark" : "text-gold/70 hover:bg-white/10 hover:text-gold"
                          }`}
                          aria-pressed={isActive}
                        >
                          {count}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
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

            {/* Right group: Choose Next button */}
            {isDone && (
              <div className="flex gap-3">
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
