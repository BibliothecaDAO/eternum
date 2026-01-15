import { AssetRarity } from "@/utils/cosmetics";
import { toPng } from "html-to-image";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

interface UseRevealShareOptions {
  chestRarity: AssetRarity;
}

interface UseRevealShareReturn {
  captureRef: React.RefObject<HTMLDivElement>;
  copyImageToClipboard: () => Promise<void>;
  shareOnX: () => void;
  isCapturing: boolean;
}

// Format rarity for display (capitalize first letter)
function formatRarity(rarity: AssetRarity): string {
  return rarity.charAt(0).toUpperCase() + rarity.slice(1);
}

// Build the X share message
function buildShareMessage(chestRarity: AssetRarity): string {
  const formattedRarity = formatRarity(chestRarity);

  return `I just opened a @realms_gg Loot Chest 💰

Participate in the most insane fully onchain game powered by @Starknet`;
}

// Generate X intent URL
function getXShareUrl(message: string): string {
  const encodedMessage = encodeURIComponent(message);
  return `https://twitter.com/intent/tweet?text=${encodedMessage}`;
}

// Download image as fallback
function downloadImage(dataUrl: string, filename: string): void {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

export function useRevealShare({ chestRarity }: UseRevealShareOptions): UseRevealShareReturn {
  const captureRef = useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const copyImageToClipboard = useCallback(async () => {
    if (!captureRef.current) {
      toast.error("Unable to capture image");
      return;
    }

    setIsCapturing(true);

    try {
      // Capture the node as PNG with 2x scale for crisp rendering
      const dataUrl = await toPng(captureRef.current, {
        pixelRatio: 2,
        backgroundColor: "#0a0a0f", // Match the dark background
        cacheBust: true,
      });

      // Convert data URL to blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();

      // Try to copy to clipboard
      try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        toast.success("Image copied to clipboard!");
      } catch {
        // Clipboard API not supported, fall back to download
        downloadImage(dataUrl, "eternum-chest-reveal.png");
        toast.success("Clipboard not supported — downloaded instead");
      }
    } catch (error) {
      console.error("Failed to capture image:", error);
      toast.error("Failed to capture image");
    } finally {
      setIsCapturing(false);
    }
  }, []);

  const shareOnX = useCallback(() => {
    const message = buildShareMessage(chestRarity);
    const url = getXShareUrl(message);
    window.open(url, "_blank", "noopener,noreferrer");
  }, [chestRarity]);

  return {
    captureRef,
    copyImageToClipboard,
    shareOnX,
    isCapturing,
  };
}
