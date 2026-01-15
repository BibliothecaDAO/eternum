import { useCallback, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { AssetRarity } from "../utils/cosmetics";

interface UseRevealShareOptions {
  chestRarity: AssetRarity;
}

interface UseRevealShareReturn {
  captureRef: React.RefObject<HTMLDivElement>;
  shareOnX: () => void;
  copyImageToClipboard: () => Promise<void>;
  isCapturing: boolean;
}

const RARITY_MESSAGES: Record<AssetRarity, string> = {
  [AssetRarity.Common]: "Just opened a Common chest in @RealmsEternum!",
  [AssetRarity.Uncommon]: "Pulled some Uncommon loot from @RealmsEternum!",
  [AssetRarity.Rare]: "Got a Rare pull from @RealmsEternum!",
  [AssetRarity.Epic]: "EPIC pull from @RealmsEternum! Let's go!",
  [AssetRarity.Legendary]: "LEGENDARY pull from @RealmsEternum! This is insane!",
  [AssetRarity.Mythic]: "MYTHIC pull from @RealmsEternum! Absolutely legendary!",
};

/**
 * Hook for capturing and sharing chest reveal results.
 * Provides screenshot capture and social sharing functionality.
 */
export function useRevealShare({ chestRarity }: UseRevealShareOptions): UseRevealShareReturn {
  const captureRef = useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // Build share message based on rarity
  const buildShareMessage = useCallback(() => {
    const message = RARITY_MESSAGES[chestRarity] || RARITY_MESSAGES[AssetRarity.Common];
    return `${message}\n\n#Eternum #Realms #NFT`;
  }, [chestRarity]);

  // Share on X/Twitter
  const shareOnX = useCallback(() => {
    const message = buildShareMessage();
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`;
    window.open(twitterUrl, "_blank", "width=550,height=420");
  }, [buildShareMessage]);

  // Capture element as PNG and copy to clipboard
  const copyImageToClipboard = useCallback(async () => {
    if (!captureRef.current) return;

    setIsCapturing(true);

    try {
      // Capture the element as PNG
      const dataUrl = await toPng(captureRef.current, {
        backgroundColor: "#0f172a", // slate-900
        pixelRatio: 2,
        cacheBust: true,
      });

      // Convert data URL to blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();

      // Copy to clipboard
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob,
        }),
      ]);

      // Optionally show success feedback here
      console.log("Image copied to clipboard!");
    } catch (error) {
      console.error("Failed to copy image:", error);
    } finally {
      setIsCapturing(false);
    }
  }, []);

  return {
    captureRef,
    shareOnX,
    copyImageToClipboard,
    isCapturing,
  };
}
