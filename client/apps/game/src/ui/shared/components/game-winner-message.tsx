import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import Button from "@/ui/design-system/atoms/button";
import { BlitzHighlightCard } from "@/ui/shared/components/blitz-highlight-card";
import { BLITZ_CARD_DIMENSIONS, BlitzHighlightPlayer, buildBlitzShareMessage } from "@/ui/shared/lib/blitz-highlight";
import { copySvgToClipboard } from "@/ui/shared/lib/copy-svg";
import { displayAddress, getRealmCountPerHyperstructure } from "@/ui/utils/utils";
import { getAddressName, getGuildFromPlayerAddress, getIsBlitz, LeaderboardManager } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ContractAddress } from "@bibliothecadao/types";
import { Copy, Share2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

export const GameWinnerMessage = () => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const { currentBlockTimestamp } = useBlockTimestamp();

  const gameWinner = useUIStore((state) => state.gameWinner);
  const gameEndAt = useUIStore((state) => state.gameEndAt);

  void currentBlockTimestamp; // DEBUG: remove once hasGameEnded hook restored
  void gameEndAt; // DEBUG: remove once hasGameEnded hook restored

  const isBlitz = getIsBlitz();

  const [isVisible, setIsVisible] = useState(true);
  const [isAnimating, setIsAnimating] = useState(true);
  const [topThreePlayers, setTopThreePlayers] = useState<BlitzHighlightPlayer[]>([]);
  const [playerRank, setPlayerRank] = useState<number | null>(null);
  const [highlightedPlayer, setHighlightedPlayer] = useState<BlitzHighlightPlayer | null>(null);
  const [isCopying, setIsCopying] = useState(false);

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
        const displayName =
          getAddressName(address, components) || displayAddress(address.toString(16)) || "Unknown player";
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

      const formattedTopThree = rankedPlayers
        .slice(0, 3)
        .map(([address, points], index) => createTopPlayer(address, index + 1, points));

      const playerAddress = ContractAddress(account.address);
      const myIndex = rankedPlayers.findIndex(([address]) => address === playerAddress);
      let myPlayer: BlitzHighlightPlayer | null = null;

      if (myIndex >= 0) {
        const [address, points] = rankedPlayers[myIndex];
        myPlayer = createTopPlayer(address, myIndex + 1, points);
      }

      setTopThreePlayers(formattedTopThree);
      setPlayerRank(myIndex >= 0 ? myIndex + 1 : null);
      setHighlightedPlayer(myPlayer ?? formattedTopThree[0] ?? null);
    } catch (error) {
      console.error("Failed to load final leaderboard", error);
      setTopThreePlayers([]);
      setPlayerRank(null);
      setHighlightedPlayer(null);
    }
  }, [account.address, components, hasGameEnded]);

  const copyLeaderboardImage = useCallback(async () => {
    if (topThreePlayers.length === 0 || !leaderboardSvgRef.current) {
      toast.error("Final standings are still loading.");
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
  }, [topThreePlayers]);

  const highlightPoints = highlightedPlayer?.points ?? null;

  const handleShareOnX = useCallback(() => {
    if (topThreePlayers.length === 0) {
      toast.error("Final standings are still loading.");
      return;
    }

    const shareText = buildBlitzShareMessage({
      rank: playerRank,
      points: highlightPoints,
      eventLabel: isBlitz ? "Realms Blitz" : "the Realms leaderboard",
      origin: typeof window !== "undefined" ? window.location.origin : undefined,
    });

    const shareIntent = new URL("https://twitter.com/intent/tweet");
    shareIntent.searchParams.set("text", shareText);

    if (typeof window !== "undefined") {
      window.open(shareIntent.toString(), "_blank", "noopener,noreferrer");
    }
  }, [highlightPoints, isBlitz, playerRank, topThreePlayers]);

  if (!hasGameEnded || !isVisible) return null;

  const highlight = highlightedPlayer;
  const cardTitle = isBlitz ? "Realms Blitz" : "Realms";
  const cardSubtitle = isBlitz ? "Blitz Leaderboard" : "Final Leaderboard";
  const championName = topThreePlayers[0]?.name || gameWinner?.name;
  const championGuild = topThreePlayers[0]?.guildName || gameWinner?.guildName;
  const winnerLine = championName ? (championGuild ? `${championName} — ${championGuild}` : championName) : null;

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
              {winnerLine && (
                <p className="text-sm font-medium text-cyan-100/70 md:text-base">Champion · {winnerLine}</p>
              )}
            </div>

            <div className="flex flex-col gap-6 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-[3px] md:px-8 md:py-7">
              <p className="text-center text-[11px] uppercase tracking-[0.28em] text-white/60 md:text-xs">
                Capture the moment and share your Blitz flex.
              </p>

              <div className="flex justify-center">
                {topThreePlayers.length > 0 ? (
                  <BlitzHighlightCard
                    ref={leaderboardSvgRef}
                    title={cardTitle}
                    subtitle={cardSubtitle}
                    winnerLine={winnerLine}
                    highlight={highlight}
                  />
                ) : (
                  <div className="flex h-[220px] w-full max-w-[720px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-sm text-white/60">
                    Final standings are syncing…
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 md:flex-row">
                <Button
                  onClick={copyLeaderboardImage}
                  disabled={isCopying || topThreePlayers.length === 0}
                  className="w-full flex-1 justify-center gap-2 !px-4 !py-3 md:!px-6"
                  variant="gold"
                  aria-busy={isCopying}
                  forceUppercase={false}
                >
                  <Copy className="h-4 w-4" />
                  <span>{isCopying ? "Preparing image…" : "Copy highlight image"}</span>
                </Button>
                <Button
                  onClick={handleShareOnX}
                  disabled={topThreePlayers.length === 0}
                  className="w-full flex-1 justify-center gap-2 !px-4 !py-3 md:!px-6"
                  variant="outline"
                  forceUppercase={false}
                >
                  <Share2 className="h-4 w-4" />
                  <span>Share on X</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
