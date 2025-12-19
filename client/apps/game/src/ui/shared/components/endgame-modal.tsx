import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { usePlayerStore } from "@/hooks/store/use-player-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import Button from "@/ui/design-system/atoms/button";
import { type LandingLeaderboardEntry } from "@/ui/features/landing/lib/landing-leaderboard-service";
import { useLandingLeaderboardStore } from "@/ui/features/landing/lib/use-landing-leaderboard-store";
import { BlitzHighlightCardWithSelector } from "@/ui/shared/components/blitz-highlight-card";
import {
  BLITZ_CARD_DIMENSIONS,
  BLITZ_DEFAULT_SHARE_ORIGIN,
  BlitzHighlightPlayer,
  buildBlitzShareMessage,
} from "@/ui/shared/lib/blitz-highlight";
import { displayAddress } from "@/ui/utils/utils";
import { getIsBlitz } from "@bibliothecadao/eternum";
import { toPng } from "html-to-image";
import { Copy, Share2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

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

export const EndgameModal = () => {
  const account = useAccountStore((state) => state.account);
  const playerAddress = account?.address && account.address !== "0x0" ? account.address : null;
  const normalizedPlayerAddress = playerAddress?.toLowerCase() ?? null;

  const currentPlayerData = usePlayerStore((state) => state.currentPlayerData);
  const playerDataLoading = usePlayerStore((state) => state.isLoading);

  const gameEndAt = useUIStore((state) => state.gameEndAt);

  const fetchLeaderboard = useLandingLeaderboardStore((state) => state.fetchLeaderboard);
  const fetchPlayerEntry = useLandingLeaderboardStore((state) => state.fetchPlayerEntry);
  const championEntry = useLandingLeaderboardStore((state) => state.championEntry);
  const isLeaderboardFetching = useLandingLeaderboardStore((state) => state.isFetching);
  const playerEntryState = useLandingLeaderboardStore((state) =>
    normalizedPlayerAddress ? state.playerEntries[normalizedPlayerAddress] : undefined,
  );

  const playerEntry = playerEntryState?.data ?? null;
  const playerEntryLoading = Boolean(playerEntryState?.isFetching);

  const highlight = useMemo(() => {
    if (!playerEntry) {
      return null;
    }

    const base = toHighlightPlayer(playerEntry);

    if (currentPlayerData && typeof currentPlayerData.hyperstructuresCount === "number") {
      return {
        ...base,
        hyperstructuresHeld: currentPlayerData.hyperstructuresCount,
      };
    }

    return base;
  }, [playerEntry, currentPlayerData]);
  const championPlayer = useMemo(() => (championEntry ? toHighlightPlayer(championEntry) : null), [championEntry]);

  const { currentBlockTimestamp } = useBlockTimestamp();

  const hasGameEnded = useMemo(() => {
    if (!gameEndAt) {
      return false;
    }

    return currentBlockTimestamp > gameEndAt;
  }, [currentBlockTimestamp, gameEndAt]);

  useEffect(() => {
    if (!hasGameEnded) {
      return;
    }

    void fetchLeaderboard({ force: true });
  }, [fetchLeaderboard, hasGameEnded]);

  useEffect(() => {
    if (!hasGameEnded || !playerAddress) {
      return;
    }

    void fetchPlayerEntry(playerAddress, { force: true });
  }, [fetchPlayerEntry, hasGameEnded, playerAddress]);

  const [isVisible, setIsVisible] = useState(true);
  const [isAnimating, setIsAnimating] = useState(true);
  const [isCopying, setIsCopying] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsAnimating(false), 500);
    return () => clearTimeout(timer);
  }, []);

  const isBlitz = getIsBlitz();

  const hasPlayerActivity = useMemo(() => {
    if (!currentPlayerData) {
      return false;
    }

    return (
      currentPlayerData.explorerIds.length > 0 ||
      currentPlayerData.structureIds.length > 0 ||
      currentPlayerData.realmsCount > 0 ||
      currentPlayerData.hyperstructuresCount > 0 ||
      currentPlayerData.bankCount > 0 ||
      currentPlayerData.mineCount > 0 ||
      currentPlayerData.villageCount > 0
    );
  }, [currentPlayerData]);

  const totalPoints = playerEntry?.points ?? 0;
  const isRanked = totalPoints > 0;
  const isLoadingLeaderboard = isLeaderboardFetching || playerEntryLoading;

  const hasEligiblePlayer = useMemo(() => {
    if (!playerAddress) {
      return false;
    }

    if (!(playerDataLoading || hasPlayerActivity || !currentPlayerData)) {
      return false;
    }

    return isLoadingLeaderboard || isRanked;
  }, [currentPlayerData, hasPlayerActivity, isLoadingLeaderboard, isRanked, playerAddress, playerDataLoading]);

  const shouldDisplayModal = hasGameEnded && hasEligiblePlayer;

  const leaderboardUrl = useMemo(() => {
    if (typeof window !== "undefined") {
      return new URL("/leaderboard", window.location.origin).toString();
    }

    return `${BLITZ_DEFAULT_SHARE_ORIGIN}/leaderboard`;
  }, []);

  const handleShareOnX = useCallback(() => {
    if (!highlight) {
      toast.error("Your final standings are still loading.");
      return;
    }

    const shareText = buildBlitzShareMessage({
      rank: highlight.rank,
      points: highlight.points,
      eventLabel: isBlitz ? "Realms Blitz" : "the Realms leaderboard",
      origin: typeof window !== "undefined" ? window.location.origin : undefined,
    });

    const shareIntent = new URL("https://twitter.com/intent/tweet");
    shareIntent.searchParams.set("text", shareText);

    if (typeof window !== "undefined") {
      window.open(shareIntent.toString(), "_blank", "noopener,noreferrer");
    }
  }, [highlight, isBlitz]);

  const handleViewLeaderboard = useCallback(() => {
    if (typeof window === "undefined") {
      toast.error("Opening the leaderboard is not supported in this environment.");
      return;
    }

    window.location.href = leaderboardUrl;
  }, [leaderboardUrl]);

  const handleCopyImage = useCallback(async () => {
    if (typeof window === "undefined") {
      toast.error("Copying the image is not supported in this environment.");
      return;
    }

    if (!cardRef.current) {
      toast.error("Your highlight card is still loading.");
      return;
    }

    if (!("ClipboardItem" in window) || !navigator.clipboard?.write) {
      toast.error("Copying images is not supported in this browser.");
      return;
    }

    setIsCopying(true);

    try {
      const cardNode = cardRef.current.querySelector(".blitz-card-root") as HTMLElement | null;

      if (!cardNode) {
        throw new Error("Unable to find the highlight card markup.");
      }

      const width = BLITZ_CARD_DIMENSIONS.width;
      const height = BLITZ_CARD_DIMENSIONS.height;

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

      const blob = await fetch(dataUrl).then((res) => res.blob());
      const clipboardItem = new ClipboardItem({ "image/png": blob });

      try {
        await navigator.clipboard.write([clipboardItem]);
        toast.success("Copied highlight image to clipboard!");
      } catch (clipboardError) {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `realms-highlight-${Date.now()}.png`;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        link.remove();
        toast.info("Clipboard not available; downloaded image instead.");
      }
    } catch (error) {
      toast.error("Copy failed. Please try again.");
    } finally {
      setIsCopying(false);
    }
  }, [cardRef]);

  if (!shouldDisplayModal || !isVisible) {
    return null;
  }

  const cardTitle = isBlitz ? "Realms Blitz" : "Realms";
  const cardSubtitle = isBlitz ? "Blitz Leaderboard" : "Final Leaderboard";
  const playerName = highlight?.name ?? null;
  const championLine = championPlayer?.name ?? playerName;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 py-8 pt-[72px]">
      <div
        className={`fixed inset-0 z-0 cursor-pointer bg-[rgba(3,8,11,0.80)] backdrop-blur-sm transition-opacity duration-500 ${
          isAnimating ? "pointer-events-none opacity-0" : "pointer-events-auto opacity-100"
        }`}
        onClick={() => setIsVisible(false)}
      />

      <div
        className={`relative z-10 flex w-full max-w-[980px] flex-col items-center gap-6 transition-all duration-500 ${
          isAnimating ? "pointer-events-none -translate-y-4 opacity-0" : "pointer-events-auto translate-y-0 opacity-100"
        }`}
      >
        {isRanked && highlight ? (
          <div ref={cardRef} className="w-full max-w-[940px]">
            <BlitzHighlightCardWithSelector
              title={cardTitle}
              subtitle={cardSubtitle}
              winnerLine={championLine}
              highlight={highlight}
            />
          </div>
        ) : isLoadingLeaderboard ? (
          <div className="flex h-[220px] w-full max-w-[720px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-sm text-white/60">
            Your Blitz standings are syncing…
          </div>
        ) : (
          <div className="flex h-[180px] w-full max-w-[720px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-base text-white/70">
            Sorry, you are not ranked in the final leaderboard.
          </div>
        )}

        <div className="flex w-full max-w-[720px] flex-col gap-3 sm:flex-row sm:justify-center sm:gap-4">
          {isRanked && highlight ? (
            <>
              <Button
                onClick={handleCopyImage}
                disabled={isCopying}
                className="flex-1 justify-center gap-2 !px-5 !py-3"
                variant="gold"
                aria-busy={isCopying}
                forceUppercase={false}
              >
                <Copy className="h-4 w-4" />
                <span className="text-sm font-semibold">{isCopying ? "Preparing image…" : "Copy image"}</span>
              </Button>
              <Button
                onClick={handleShareOnX}
                disabled={!highlight}
                className="flex-1 justify-center gap-2 !px-5 !py-3"
                variant="outline"
                forceUppercase={false}
              >
                <Share2 className="h-4 w-4" />
                <span className="text-sm font-semibold">Share on X</span>
              </Button>
              <Button
                onClick={handleViewLeaderboard}
                className="flex-1 justify-center !px-5 !py-3"
                variant="outline"
                forceUppercase={false}
              >
                <span className="text-sm font-semibold">View leaderboard</span>
              </Button>
            </>
          ) : (
            <Button
              onClick={handleViewLeaderboard}
              className="flex-1 justify-center !px-5 !py-3 sm:max-w-[240px]"
              variant="outline"
              forceUppercase={false}
            >
              <span className="text-sm font-semibold">View leaderboard</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
