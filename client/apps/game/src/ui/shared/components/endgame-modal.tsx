import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import Button from "@/ui/design-system/atoms/button";
import { BlitzHighlightCard } from "@/ui/shared/components/blitz-highlight-card";
import {
  BLITZ_CARD_DIMENSIONS,
  BLITZ_DEFAULT_SHARE_ORIGIN,
  BlitzHighlightPlayer,
  buildBlitzShareMessage,
  formatOrdinal,
} from "@/ui/shared/lib/blitz-highlight";
import { copySvgToClipboard } from "@/ui/shared/lib/copy-svg";
import { currencyIntlFormat, getRealmCountPerHyperstructure } from "@/ui/utils/utils";
import { getAddressName, getGuildFromPlayerAddress, getIsBlitz, LeaderboardManager } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ContractAddress } from "@bibliothecadao/types";
import { Copy, Share2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

export const EndgameModal = () => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const { currentBlockTimestamp } = useBlockTimestamp();

  const gameEndAt = useUIStore((state) => state.gameEndAt);

  const isBlitz = getIsBlitz();

  const [isVisible, setIsVisible] = useState(true);
  const [isAnimating, setIsAnimating] = useState(true);
  const [highlightedPlayer, setHighlightedPlayer] = useState<BlitzHighlightPlayer | null>(null);
  const [championPlayer, setChampionPlayer] = useState<BlitzHighlightPlayer | null>(null);
  const [isCopying, setIsCopying] = useState(false);
  const [isRanked, setIsRanked] = useState<boolean>(true);

  const leaderboardSvgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsAnimating(false), 500);
    return () => clearTimeout(timer);
  }, []);

  const hasGameEnded = useMemo(() => {
    return currentBlockTimestamp > (gameEndAt ?? 0);
  }, [currentBlockTimestamp, gameEndAt]);

  useEffect(() => {
    if (!hasGameEnded) return;

    try {
      const manager = LeaderboardManager.instance(components, getRealmCountPerHyperstructure());
      manager.updatePoints();

      const rankedPlayers = manager.playersByRank;
      const createTopPlayer = (address: ContractAddress, rank: number, points: number): BlitzHighlightPlayer => {
        const rawName = getAddressName(address, components);
        const trimmedName = rawName?.trim();
        const displayName = trimmedName && trimmedName.length > 0 ? trimmedName : "Unknown player";
        const guildName = getGuildFromPlayerAddress(address, components)?.name;

        const addressHex = address.toString(16);
        const normalizedAddress = addressHex.startsWith("0x") ? addressHex : `0x${addressHex}`;

        return {
          rank,
          name: displayName,
          guildName: guildName || undefined,
          points,
          address: normalizedAddress,
        } satisfies BlitzHighlightPlayer;
      };

      if (rankedPlayers.length > 0) {
        const [topAddress, topPoints] = rankedPlayers[0];
        setChampionPlayer(createTopPlayer(topAddress, 1, topPoints));
      } else {
        setChampionPlayer(null);
      }

      const playerAddress = ContractAddress(account.address);
      const myIndex = rankedPlayers.findIndex(([address]) => address === playerAddress);
      let myPlayer: BlitzHighlightPlayer | null = null;

      if (myIndex >= 0) {
        const [address, points] = rankedPlayers[myIndex];
        myPlayer = createTopPlayer(address, myIndex + 1, points);
        setIsRanked(true);
      } else {
        setIsRanked(false);
      }

      setHighlightedPlayer(myPlayer ?? null);
    } catch (error) {
      console.error("Failed to load final leaderboard", error);
      setHighlightedPlayer(null);
      setChampionPlayer(null);
      setIsRanked(false);
    }
  }, [account.address, components, hasGameEnded]);

  const highlight = highlightedPlayer;

  const copyLeaderboardImage = useCallback(async () => {
    if (!highlight || !leaderboardSvgRef.current) {
      toast.error("Your final standings are still loading.");
      return;
    }

    setIsCopying(true);

    try {
      await copySvgToClipboard(leaderboardSvgRef.current, {
        width: BLITZ_CARD_DIMENSIONS.width,
        height: BLITZ_CARD_DIMENSIONS.height,
        successMessage: "Blitz highlight copied to your clipboard.",
        errorMessage: "Unable to copy the highlight image.",
        unsupportedMessage: "Copying images is not supported in this environment.",
      });
    } catch {
      // Errors are surfaced via toast inside copySvgToClipboard
    } finally {
      setIsCopying(false);
    }
  }, [highlight]);

  const highlightPoints = highlight?.points ?? null;

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

  if (!hasGameEnded || !isVisible) return null;

  const cardTitle = isBlitz ? "Realms Blitz" : "Realms";
  const cardSubtitle = isBlitz ? "Blitz Leaderboard" : "Final Leaderboard";
  const playerName = highlight?.name ?? null;
  const playerGuild = highlight?.guildName ?? null;
  const playerLine = playerName ? (playerGuild ? `${playerName} — ${playerGuild}` : playerName) : null;
  const championLine = championPlayer
    ? championPlayer.guildName
      ? `${championPlayer.name} — ${championPlayer.guildName}`
      : championPlayer.name
    : playerLine;
  const placementLabel = highlight ? formatOrdinal(highlight.rank) : null;
  const pointsLabel = highlightPoints !== null ? currencyIntlFormat(highlightPoints, 0) : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-center px-4 pt-[54px]">
      <div
        className={`absolute inset-0 z-0 cursor-pointer bg-[rgba(3,8,11,0.75)] backdrop-blur-sm transition-opacity duration-500 ${
          isAnimating ? "pointer-events-none opacity-0" : "pointer-events-auto opacity-100"
        }`}
        onClick={() => setIsVisible(false)}
      />

      <div
        className={`relative z-10 w-full max-w-[760px] transform transition-all duration-500 ${
          isAnimating ? "pointer-events-none -translate-y-4 opacity-0" : "pointer-events-auto translate-y-0 opacity-100"
        }`}
      >
        <div className="relative overflow-hidden rounded-[60px] border border-[#123947]/70 bg-[#030d14] text-cyan-50 shadow-[0_34px_80px_rgba(2,12,20,0.72)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_-12%,rgba(64,200,233,0.35),transparent_65%)]" />

          <div className="relative flex flex-col gap-6 px-6 pb-8 pt-12 md:px-12 md:pt-16">
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.42em] text-cyan-200/70 md:text-sm">
                {cardTitle}
              </p>
              <h2 className="text-3xl font-semibold uppercase tracking-[0.24em] text-white md:text-[36px]">
                {cardSubtitle}
              </h2>
              {isRanked && playerLine && (
                <p className="text-sm font-medium text-cyan-100/80 md:text-base">{playerLine}</p>
              )}
              {isRanked && placementLabel && pointsLabel && (
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/70 md:text-sm">
                  {placementLabel} • {pointsLabel} pts
                </p>
              )}
              {!isRanked && (
                <p className="mt-2 text-sm font-medium text-cyan-100/80 md:text-base">
                  You are not ranked in the leaderboard.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-6 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-[3px] md:px-8 md:py-7">
              <p className="text-center text-[11px] uppercase tracking-[0.28em] text-white/60 md:text-xs">
                Copy the Blitz highlight card or take the share link straight to X.
              </p>
              <div className="flex justify-center">
                {isRanked ? (
                  highlight ? (
                    <BlitzHighlightCard
                      ref={leaderboardSvgRef}
                      title={cardTitle}
                      subtitle={cardSubtitle}
                      winnerLine={championLine}
                      highlight={highlight}
                    />
                  ) : (
                    <div className="flex h-[220px] w-full max-w-[720px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-sm text-white/60">
                      Your Blitz standings are syncing…
                    </div>
                  )
                ) : (
                  <div className="flex h-[180px] w-full max-w-[720px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-base text-white/70">
                    Sorry, you are not ranked in the final leaderboard.
                  </div>
                )}
              </div>
              {isRanked && (
                <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:gap-4">
                  <Button
                    onClick={copyLeaderboardImage}
                    disabled={isCopying || !highlight}
                    className="w-full md:flex-1 min-w-[180px] justify-center gap-2 !px-4 !py-3 md:!px-5"
                    variant="gold"
                    aria-busy={isCopying}
                    forceUppercase={false}
                  >
                    <Copy className="h-4 w-4" />
                    <span className="text-sm font-semibold leading-tight text-center">
                      {isCopying ? "Preparing image…" : "Copy image"}
                    </span>
                  </Button>
                  <Button
                    onClick={handleShareOnX}
                    disabled={!highlight}
                    className="w-full md:flex-1 min-w-[180px] justify-center gap-2 !px-4 !py-3 md:!px-5"
                    variant="outline"
                    forceUppercase={false}
                  >
                    <Share2 className="h-4 w-4" />
                    <span className="text-sm font-semibold leading-tight text-center">Share on X</span>
                  </Button>
                  <Button
                    onClick={handleViewLeaderboard}
                    className="w-full md:flex-1 min-w-[180px] justify-center !px-4 !py-3 md:!px-5"
                    variant="outline"
                    forceUppercase={false}
                  >
                    <span className="text-sm font-semibold leading-tight text-center">View leaderboard</span>
                  </Button>
                </div>
              )}
              {!isRanked && (
                <div className="flex justify-center mt-2">
                  <Button
                    onClick={handleViewLeaderboard}
                    className="w-full md:flex-1 min-w-[180px] justify-center !px-4 !py-3 md:!px-5"
                    variant="outline"
                    forceUppercase={false}
                  >
                    <span className="text-sm font-semibold leading-tight text-center">View leaderboard</span>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
