import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/ui/design-system/atoms";
import { BlitzHighlightCard } from "@/ui/shared/components/blitz-highlight-card";
import {
  BLITZ_CARD_DIMENSIONS,
  BLITZ_DEFAULT_SHARE_ORIGIN,
  BlitzHighlightPlayer,
  buildBlitzShareMessage,
} from "@/ui/shared/lib/blitz-highlight";
import { copySvgToClipboard } from "@/ui/shared/lib/copy-svg";
import { displayAddress } from "@/ui/utils/utils";
import { Copy, Share2 } from "lucide-react";
import { toast } from "sonner";

import { fetchLandingLeaderboard, type LandingLeaderboardEntry } from "../lib/landing-leaderboard-service";

const PODIUM_LIMIT = 3;

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
});

export const LandingPlayer = () => {
  const [entries, setEntries] = useState<LandingLeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCopyingImage, setIsCopyingImage] = useState(false);

  const cardRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadLeaderboard = async () => {
      if (!isMounted) {
        return;
      }

      setIsLoading(true);

      try {
        const result = await fetchLandingLeaderboard(PODIUM_LIMIT, 0);

        if (!isMounted) {
          return;
        }

        setEntries(result);
        setError(null);
      } catch (caughtError) {
        if (!isMounted) {
          return;
        }

        const message = caughtError instanceof Error ? caughtError.message : "Unable to load player standings.";
        setEntries([]);
        setError(message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadLeaderboard();

    return () => {
      isMounted = false;
    };
  }, []);

  const highlightEntry = entries[0] ?? null;
  const highlightPlayer = useMemo<BlitzHighlightPlayer | null>(
    () => (highlightEntry ? toHighlightPlayer(highlightEntry) : null),
    [highlightEntry],
  );

  const highlightRank = highlightPlayer?.rank ?? null;
  const highlightPoints = highlightPlayer?.points ?? null;

  const shareMessage = useMemo(
    () =>
      buildBlitzShareMessage({
        rank: highlightRank,
        points: highlightPoints,
        origin: typeof window !== "undefined" ? window.location.origin : BLITZ_DEFAULT_SHARE_ORIGIN,
      }),
    [highlightPoints, highlightRank],
  );

  const handleCopyImage = useCallback(async () => {
    if (!highlightPlayer || !cardRef.current) {
      toast.error("Final standings are still loading.");
      return;
    }

    setIsCopyingImage(true);

    try {
      await copySvgToClipboard(cardRef.current, {
        width: BLITZ_CARD_DIMENSIONS.width,
        height: BLITZ_CARD_DIMENSIONS.height,
        successMessage: "Blitz highlight copied to your clipboard.",
        errorMessage: "Unable to copy the highlight image.",
        unsupportedMessage: "Copying images is not supported in this environment.",
      });
    } catch {
      // Errors are surfaced via toast inside copySvgToClipboard.
    } finally {
      setIsCopyingImage(false);
    }
  }, [highlightPlayer]);

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

  const handleCopyMessage = useCallback(async () => {
    if (!shareMessage.trim()) {
      toast.error("Nothing to copy yet.");
      return;
    }

    if (
      typeof navigator === "undefined" ||
      !navigator.clipboard ||
      typeof navigator.clipboard.writeText !== "function"
    ) {
      toast.error("Clipboard access is not available in this environment.");
      return;
    }

    try {
      await navigator.clipboard.writeText(shareMessage);
      toast.success("Winner message copied to clipboard.");
    } catch (caughtError) {
      console.error("Failed to copy winner message", caughtError);
      toast.error("Unable to copy the winner message.");
    }
  }, [shareMessage]);

  return (
    <section className="w-full max-w-4xl space-y-6 overflow-y-auto rounded-3xl border border-white/10 bg-black/60 p-8 text-white/90 shadow-[0_35px_70px_-25px_rgba(12,10,35,0.85)] backdrop-blur-xl max-h-[82vh] sm:max-h-[85vh] lg:max-h-[88vh]">
      <header className="space-y-2">
        <h2 className="text-3xl font-semibold text-white">Player Highlights</h2>
      </header>

      {isLoading ? (
        <div className="space-y-4" aria-busy aria-live="polite">
          <div className="h-20 animate-pulse rounded-2xl border border-white/5 bg-white/5" />
          <div className="h-36 animate-pulse rounded-2xl border border-white/5 bg-white/5" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200" role="alert">
          <p className="font-semibold text-red-100">Leaderboard unavailable</p>
          <p className="mt-1 text-red-200/80">{error}</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_25px_55px_-25px_rgba(12,10,35,0.7)]">
          <div className="flex flex-col items-center gap-2 text-center">
            <h3 className="text-base font-semibold text-white">Share your victory</h3>
            <p className="text-sm text-white/60">Copy the Blitz highlight card or take the share link straight to X.</p>
          </div>

          <div className="mt-6 flex justify-center">
            {highlightPlayer ? (
              <BlitzHighlightCard
                ref={cardRef}
                title="Realms Blitz"
                subtitle="Blitz Leaderboard"
                winnerLine={highlightPlayer.name}
                highlight={highlightPlayer}
              />
            ) : (
              <div className="flex h-[220px] w-full max-w-[720px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-sm text-white/60">
                Final standings will appear once the next Blitz round completes.
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-col gap-3 md:flex-row">
            <Button
              onClick={handleCopyImage}
              variant="gold"
              className="w-full flex-1 justify-center gap-2 !px-4 !py-3 md:!px-6"
              forceUppercase={false}
              isLoading={isCopyingImage}
              disabled={isCopyingImage || !highlightPlayer}
            >
              <Copy className="h-4 w-4" />
              <span>{isCopyingImage ? "Preparing image…" : "Copy highlight image"}</span>
            </Button>
            <Button
              onClick={handleShareOnX}
              variant="outline"
              className="w-full flex-1 justify-center gap-2 !px-4 !py-3 md:!px-6"
              forceUppercase={false}
              disabled={!highlightPlayer}
            >
              <Share2 className="h-4 w-4" />
              <span>Share on X</span>
            </Button>
            <Button
              onClick={handleCopyMessage}
              variant="secondary"
              className="w-full flex-1 justify-center gap-2 !px-4 !py-3 md:!px-6"
              forceUppercase={false}
            >
              <Copy className="h-4 w-4" />
              <span>Copy message</span>
            </Button>
          </div>
        </div>
      )}
    </section>
  );
};
