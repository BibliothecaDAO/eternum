import { useRef, useEffect, useState } from "react";
import { ChestAsset, RARITY_STYLES } from "@/utils/cosmetics";
import { TiltCard } from "./tilt-card";
import { createCardRevealAnimation } from "./use-gsap-timeline";
import { ChestStageContainer, ChestStageContent, ChestStageHeader } from "./chest-stage-container";

interface RevealStageProps {
  assets: ChestAsset[];
  onComplete: () => void;
  showContent: boolean;
}

export function RevealStage({ assets, onComplete, showContent }: RevealStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const [animationComplete, setAnimationComplete] = useState(false);

  // Run reveal animation when content becomes visible
  useEffect(() => {
    if (!showContent || !cardsRef.current || animationComplete) return;

    const cards = cardsRef.current.querySelectorAll<HTMLElement>(".reveal-card");
    if (cards.length === 0) return;

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
  }, [showContent, assets, animationComplete, onComplete]);

  // Determine layout based on number of assets
  const getLayoutClass = () => {
    const count = assets.length;
    if (count === 1) return "justify-center";
    if (count === 2) return "justify-center gap-6";
    if (count === 3) return "justify-center gap-4";
    return "justify-center gap-4 flex-wrap";
  };

  // Get card size based on count and screen
  const getCardSize = () => {
    const count = assets.length;
    if (count === 1) {
      return { width: 320, height: 420 };
    }
    if (count <= 3) {
      return { width: 260, height: 340 };
    }
    return { width: 220, height: 290 };
  };

  // Find rarest item for highlighting
  const rarestAsset = assets.reduce((rarest, current) => {
    const rarityOrder = ["common", "uncommon", "rare", "epic", "legendary"];
    const rarestIndex = rarityOrder.indexOf(rarest.rarity);
    const currentIndex = rarityOrder.indexOf(current.rarity);
    return currentIndex > rarestIndex ? current : rarest;
  }, assets[0]);

  const cardSize = getCardSize();

  return (
    <ChestStageContainer>
      <ChestStageContent className="py-8">
        <div ref={containerRef} className="flex flex-col items-center w-full overflow-hidden">
          {/* Header */}
          <div className={`transition-opacity duration-500 ${showContent ? "opacity-100" : "opacity-0"}`}>
            <ChestStageHeader
              title="Chest Opened!"
              subtitle={`You received ${assets.length} item${assets.length !== 1 ? "s" : ""}`}
            />
          </div>

          {/* Cards container */}
          <div ref={cardsRef} className={`flex ${getLayoutClass()} items-center max-w-full overflow-hidden py-4 px-8`}>
            {assets.map((asset, index) => (
              <div
                key={`${asset.id}-${index}`}
                className="reveal-card opacity-0"
                style={{
                  // Highlight the rarest item
                  zIndex: asset === rarestAsset ? 10 : 1,
                  transform: asset === rarestAsset ? "scale(1.05)" : "scale(1)",
                }}
              >
                <TiltCard
                  asset={asset}
                  size={
                    asset === rarestAsset && assets.length > 1
                      ? { width: cardSize.width * 1.1, height: cardSize.height * 1.1 }
                      : cardSize
                  }
                />
              </div>
            ))}
          </div>

          {/* Stats summary - always rendered to prevent layout shift */}
          <div
            className={`mt-6 flex flex-wrap justify-center gap-3 transition-opacity duration-500 ${
              showContent && animationComplete ? "opacity-100" : "opacity-0"
            }`}
          >
            {Object.entries(
              assets.reduce(
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

export function CollectionSummary({ assets, totalOwned = 0, collectionSize = 11 }: CollectionSummaryProps) {
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
