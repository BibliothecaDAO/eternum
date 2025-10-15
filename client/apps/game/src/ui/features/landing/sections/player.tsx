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
    <section className="w-full mb-2 max-w-2xl space-y-4 overflow-y-auto rounded-3xl border border-white/10 bg-black/60 p-5 text-white/90 shadow-[0_35px_70px_-25px_rgba(12,10,35,0.85)] backdrop-blur-xl max-h-[70vh] sm:max-w-3xl sm:space-y-5 sm:p-6 sm:max-h-[72vh] xl:max-h-[74vh] xl:space-y-6 xl:p-7 2xl:max-h-[86vh] 2xl:max-w-4xl 2xl:p-8">
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
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_25px_55px_-25px_rgba(12,10,35,0.7)] sm:p-5 xl:p-6">
          <div className="flex flex-col items-center gap-1.5 text-center sm:gap-2">
            <h3 className="text-sm font-semibold text-white sm:text-base">Share your victory</h3>
            <p className="text-xs text-white/60 sm:text-sm">
              Copy the Blitz highlight card or take the share link straight to X.
            </p>
          </div>

          <div className="mt-4 flex justify-center sm:mt-5 xl:mt-6">
            {highlightPlayer ? (
              <div className="w-full max-w-[420px] sm:max-w-[520px] xl:max-w-[580px] 2xl:max-w-[720px]">
                <BlitzHighlightCard
                  ref={cardRef}
                  title="Realms Blitz"
                  subtitle="Blitz Leaderboard"
                  winnerLine={highlightPlayer.name}
                  highlight={highlightPlayer}
                />
              </div>
            ) : (
              <div className="flex h-[170px] w-full max-w-[420px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-xs text-white/60 sm:h-[190px] sm:max-w-[520px] sm:text-sm xl:max-w-[580px] xl:text-sm 2xl:max-w-[720px] 2xl:h-[220px]">
                Final standings will appear once the next Blitz round completes.
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:mt-5 sm:gap-2.5 md:flex-row xl:mt-6">
            <Button
              onClick={handleCopyImage}
              variant="gold"
              className="w-full flex-1 justify-center gap-2 !px-4 !py-2 sm:!py-2.5 xl:!py-3 md:!px-6"
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
              className="w-full flex-1 justify-center gap-2 !px-4 !py-2 sm:!py-2.5 xl:!py-3 md:!px-6"
              forceUppercase={false}
              disabled={!highlightPlayer}
            >
              <Share2 className="h-4 w-4" />
              <span>Share on X</span>
            </Button>
            <Button
              onClick={handleCopyMessage}
              variant="secondary"
              className="w-full flex-1 justify-center gap-2 !px-4 !py-2 sm:!py-2.5 xl:!py-3 md:!px-6"
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
