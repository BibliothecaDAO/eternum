import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Copy, Loader2, Share2 } from "lucide-react";

import { Button } from "@/ui/design-system/atoms";
import { BlitzHighlightCardWithSelector } from "@/ui/shared/components/blitz-highlight-card";
import {
  BLITZ_CARD_DIMENSIONS,
  BLITZ_DEFAULT_SHARE_ORIGIN,
  type BlitzHighlightPlayer,
  buildBlitzShareMessage,
} from "@/ui/shared/lib/blitz-highlight";
import { copyElementAsPng, openShareOnX } from "@/ui/shared/lib/share-image";
import type { LandingLeaderboardEntry } from "@/services/leaderboard/landing-leaderboard-service";
import { displayAddress } from "@/ui/utils/utils";

interface ScoreCardContentProps {
  worldName: string;
  playerEntry: LandingLeaderboardEntry | null;
  isLoading?: boolean;
  error?: string | null;
  showActions?: boolean;
}

const getDisplayName = (entry: LandingLeaderboardEntry): string => {
  const candidate = entry.displayName?.trim();
  if (candidate) {
    return candidate;
  }
  return displayAddress(entry.address);
};

const toHighlightPlayer = (entry: LandingLeaderboardEntry): BlitzHighlightPlayer => ({
  rank: entry.rank,
  name: getDisplayName(entry),
  points: entry.points,
  address: entry.address,
  exploredTiles: entry.exploredTiles ?? null,
  exploredTilePoints: entry.exploredTilePoints ?? null,
  riftsTaken: entry.riftsTaken ?? null,
  riftPoints: entry.riftPoints ?? null,
  hyperstructuresConquered: entry.hyperstructuresConquered ?? null,
  hyperstructurePoints: entry.hyperstructurePoints ?? null,
  relicCratesOpened: entry.relicCratesOpened ?? null,
  relicCratePoints: entry.relicCratePoints ?? null,
  campsTaken: entry.campsTaken ?? null,
  campPoints: entry.campPoints ?? null,
  hyperstructuresHeld: entry.hyperstructuresHeld ?? null,
  hyperstructuresHeldPoints: entry.hyperstructuresHeldPoints ?? null,
});

export const ScoreCardContent = ({
  worldName,
  playerEntry,
  isLoading = false,
  error = null,
  showActions = true,
}: ScoreCardContentProps) => {
  const [isCopyingImage, setIsCopyingImage] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const highlightPlayer = useMemo<BlitzHighlightPlayer | null>(
    () => (playerEntry ? toHighlightPlayer(playerEntry) : null),
    [playerEntry],
  );

  const highlightRank = highlightPlayer?.rank ?? null;
  const highlightPoints = highlightPlayer?.points ?? null;

  const shareMessage = useMemo(
    () =>
      buildBlitzShareMessage({
        rank: highlightRank,
        points: highlightPoints,
        eventLabel: `${worldName} on Realms Blitz`,
        origin: typeof window !== "undefined" ? window.location.origin : BLITZ_DEFAULT_SHARE_ORIGIN,
      }),
    [highlightPoints, highlightRank, worldName],
  );

  const handleCopyImage = useCallback(async () => {
    if (!highlightPlayer || !cardRef.current) {
      toast.error("Your highlight card is still loading.");
      return;
    }

    setIsCopyingImage(true);

    try {
      const cardNode = cardRef.current.querySelector(".blitz-card-root") as HTMLElement | null;

      if (!cardNode) {
        throw new Error("Unable to find the highlight card markup.");
      }

      const { width, height } = BLITZ_CARD_DIMENSIONS;
      const result = await copyElementAsPng({
        element: cardNode,
        filename: `realms-highlight-${worldName}-${Date.now()}.png`,
        backgroundColor: "#030d14",
        pixelRatio: 2,
        canvasWidth: width,
        canvasHeight: height,
        renderWidth: width,
        renderHeight: height,
      });

      if (result === "copied") {
        toast.success("Copied highlight image to clipboard!");
      } else {
        toast.info("Clipboard not available; downloaded image instead.");
      }
    } catch (caughtError) {
      console.error("Failed to copy highlight image", caughtError);
      toast.error("Copy failed. Please try again.");
    } finally {
      setIsCopyingImage(false);
    }
  }, [highlightPlayer, worldName]);

  const handleShareOnX = useCallback(() => {
    if (!highlightPlayer) {
      toast.error("Final standings are still loading.");
      return;
    }

    const didOpen = openShareOnX(shareMessage);
    if (!didOpen) {
      toast.error("Sharing is not supported in this environment.");
    }
  }, [highlightPlayer, shareMessage]);

  const handleCopyMessage = useCallback(() => {
    if (!shareMessage) return;

    navigator.clipboard
      .writeText(shareMessage)
      .then(() => toast.success("Message copied to clipboard!"))
      .catch(() => toast.error("Failed to copy message"));
  }, [shareMessage]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="w-10 h-10 text-gold animate-spin" />
        <p className="mt-4 text-sm text-white/60">Loading your score...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  if (!highlightPlayer) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-sm text-white/60">No score data found for this game</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-center" ref={cardRef}>
        <BlitzHighlightCardWithSelector title="Realms Blitz" subtitle="Blitz Leaderboard" highlight={highlightPlayer} />
      </div>

      {showActions && (
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button
            onClick={handleCopyImage}
            variant="gold"
            className="w-full flex-1 justify-center gap-2 !px-4 !py-2.5"
            forceUppercase={false}
            isLoading={isCopyingImage}
            disabled={isCopyingImage || !highlightPlayer}
          >
            <Copy className="h-4 w-4" />
            <span>{isCopyingImage ? "Preparing image..." : "Copy highlight image"}</span>
          </Button>
          <Button
            onClick={handleShareOnX}
            variant="outline"
            className="w-full flex-1 justify-center gap-2 !px-4 !py-2.5"
            forceUppercase={false}
            disabled={!highlightPlayer}
          >
            <Share2 className="h-4 w-4" />
            <span>Share on X</span>
          </Button>
          <Button
            onClick={handleCopyMessage}
            variant="secondary"
            className="w-full flex-1 justify-center gap-2 !px-4 !py-2.5"
            forceUppercase={false}
          >
            <Copy className="h-4 w-4" />
            <span>Copy message</span>
          </Button>
        </div>
      )}
    </>
  );
};
