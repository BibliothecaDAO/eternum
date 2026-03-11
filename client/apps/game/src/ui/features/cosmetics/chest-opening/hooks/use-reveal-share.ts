import { useCallback, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { AssetRarity } from "../utils/cosmetics";
import { buildChestRevealShareMessage } from "@/ui/shared/lib/x-share-messages";

interface UseRevealShareOptions {
  chestRarity: AssetRarity;
}

interface UseRevealShareReturn {
  captureRef: React.RefObject<HTMLDivElement>;
  shareOnX: () => void;
  copyImageToClipboard: () => Promise<void>;
  isCapturing: boolean;
}

/**
 * Hook for capturing and sharing chest reveal results.
 * Provides screenshot capture and social sharing functionality.
 */
export function useRevealShare({ chestRarity }: UseRevealShareOptions): UseRevealShareReturn {
  const captureRef = useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // Share on X/Twitter
  const shareOnX = useCallback(() => {
    const message = buildChestRevealShareMessage(chestRarity);
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`;
    window.open(twitterUrl, "_blank", "width=550,height=420");
  }, [chestRarity]);

  // Capture element as PNG and copy to clipboard
  const copyImageToClipboard = useCallback(async () => {
    if (!captureRef.current) return;

    setIsCapturing(true);

    try {
      // Capture the element as PNG
      const dataUrl = await toPng(captureRef.current, {
        backgroundColor: "#0a0908", // dark black matching gold theme
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
