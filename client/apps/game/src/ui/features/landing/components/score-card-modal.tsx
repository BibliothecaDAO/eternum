import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { Copy, X, Loader2, Share2 } from "lucide-react";

import { useAccountStore } from "@/hooks/store/use-account-store";
import { Button } from "@/ui/design-system/atoms";
import { BlitzHighlightCardWithSelector } from "@/ui/shared/components/blitz-highlight-card";
import {
  BLITZ_CARD_DIMENSIONS,
  BLITZ_DEFAULT_SHARE_ORIGIN,
  type BlitzHighlightPlayer,
  buildBlitzShareMessage,
} from "@/ui/shared/lib/blitz-highlight";
import {
  fetchLandingLeaderboardEntryByAddress,
  type LandingLeaderboardEntry,
} from "@/services/leaderboard/landing-leaderboard-service";
import { displayAddress } from "@/ui/utils/utils";

interface ScoreCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  worldName: string;
}

export interface ScoreCardContentProps {
  worldName: string;
  playerEntry: LandingLeaderboardEntry | null;
  isLoading?: boolean;
  error?: string | null;
  showActions?: boolean;
}

const buildToriiSqlUrl = (gameName: string) => `https://api.cartridge.gg/x/${gameName}/torii/sql`;

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
    if (typeof window === "undefined") {
      toast.error("Copying the image is not supported in this environment.");
      return;
    }

    if (!highlightPlayer || !cardRef.current) {
      toast.error("Your highlight card is still loading.");
      return;
    }

    if (!("ClipboardItem" in window) || !navigator.clipboard?.write) {
      toast.error("Copying images is not supported in this browser.");
      return;
    }

    setIsCopyingImage(true);

    try {
      const cardNode = cardRef.current.querySelector(".blitz-card-root") as HTMLElement | null;

      if (!cardNode) {
        throw new Error("Unable to find the highlight card markup.");
      }

      const { width, height } = BLITZ_CARD_DIMENSIONS;
      const fontReady =
        typeof document !== "undefined" && "fonts" in document ? document.fonts.ready.catch(() => undefined) : null;
      const waiters = fontReady ? [fontReady] : [];
      await Promise.all(waiters);

      const dataUrl = await toPng(cardNode, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#030d14",
        canvasWidth: width,
        canvasHeight: height,
        style: {
          width: `${width}px`,
          height: `${height}px`,
        },
      });

      const blob = await fetch(dataUrl).then((response) => response.blob());
      const clipboardItem = new ClipboardItem({ "image/png": blob });

      try {
        await navigator.clipboard.write([clipboardItem]);
        toast.success("Copied highlight image to clipboard!");
      } catch {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `realms-highlight-${worldName}-${Date.now()}.png`;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        link.remove();
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

    const shareIntent = new URL("https://twitter.com/intent/tweet");
    shareIntent.searchParams.set("text", shareMessage);

    if (typeof window === "undefined") {
      toast.error("Sharing is not supported in this environment.");
      return;
    }

    window.open(shareIntent.toString(), "_blank", "noopener,noreferrer");
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

/**
 * Modal to display player's score card for an ended game
 * Features: BlitzHighlightCard display, copy image, share to X, copy message
 */
export const ScoreCardModal = ({ isOpen, onClose, worldName }: ScoreCardModalProps) => {
  const [playerEntry, setPlayerEntry] = useState<LandingLeaderboardEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const account = useAccountStore((state) => state.account);
  const playerAddress = account?.address && account.address !== "0x0" ? account.address : null;

  useEffect(() => {
    if (!isOpen || !playerAddress) {
      setPlayerEntry(null);
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const toriiUrl = buildToriiSqlUrl(worldName);
        const data = await fetchLandingLeaderboardEntryByAddress(playerAddress, toriiUrl);
        setPlayerEntry(data);
      } catch (err) {
        console.error("Failed to fetch player score:", err);
        setError("Failed to load score data");
      } finally {
        setIsLoading(false);
      }
    };

    void fetchData();
  }, [isOpen, playerAddress, worldName]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-[1000px]">
        <div className="rounded-2xl border border-gold/30 bg-gradient-to-b from-[#0a0a0a] to-[#050505] backdrop-blur-xl overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gold/20">
            <h2 className="font-serif text-lg text-gold">Your Score - {worldName}</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" aria-label="Close">
              <X className="w-5 h-5 text-white/60" />
            </button>
          </div>

          <div className="p-4 sm:p-6">
            <ScoreCardContent worldName={worldName} playerEntry={playerEntry} isLoading={isLoading} error={error} />
          </div>
        </div>
      </div>
    </div>
  );
};
