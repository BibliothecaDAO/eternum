import { useAccountStore } from "@/hooks/store/use-account-store";
import {
  claimGameReviewRewards,
  finalizeGameRankingAndMMR,
  type GameReviewData,
} from "@/services/review/game-review-service";
import { Button } from "@/ui/design-system/atoms";
import { BlitzAwardsOptionSixCardWithSelector } from "@/ui/shared/components/blitz-awards-variant-cards";
import { BlitzGameStatsCardWithSelector } from "@/ui/shared/components/blitz-game-stats-card";
import { BlitzLeaderboardCardWithSelector } from "@/ui/shared/components/blitz-leaderboard-card";
import { BlitzMapFingerprintCardWithSelector } from "@/ui/shared/components/blitz-map-fingerprint-card";
import { BLITZ_CARD_DIMENSIONS } from "@/ui/shared/lib/blitz-highlight";
import { displayAddress } from "@/ui/utils/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toPng } from "html-to-image";
import { ArrowLeft, ArrowRight, Copy, Flag, Gift, Loader2, Share2, Shield, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { toast } from "sonner";

import { useGameReviewData } from "../hooks/use-game-review-data";
import { UnifiedGameGrid, type GameData, type WorldSelection } from "./game-selector/game-card-grid";
import { ScoreCardContent } from "./score-card-modal";

type ReviewStepId =
  | "finished"
  | "personal"
  | "stats"
  | "awards"
  | "map-fingerprint"
  | "leaderboard"
  | "submit-score"
  | "claim-rewards"
  | "next-game";

interface GameReviewModalProps {
  isOpen: boolean;
  world: WorldSelection | null;
  nextGame: GameData | null;
  showUpcomingGamesStep?: boolean;
  onClose: () => void;
  onRegistrationComplete: () => void;
  onRequireSignIn: () => void;
}

const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const SHARE_CARD_DIMENSIONS = BLITZ_CARD_DIMENSIONS;
const SHARE_PREVIEW_MAX_WIDTH = SHARE_CARD_DIMENSIONS.width;
const EXPORT_STAGE_PADDING_X = 36;
const EXPORT_STAGE_PADDING_Y = 24;
const CARD_PREVIEW_STYLE: CSSProperties = {
  maxWidth: `${SHARE_PREVIEW_MAX_WIDTH}px`,
};
const MAP_FINGERPRINT_ZOOM_LEVELS = [0.2, 0.3, 0.4, 0.6, 0.8, 1, 1.25, 1.5] as const;
const MAP_FINGERPRINT_DEFAULT_ZOOM = MAP_FINGERPRINT_ZOOM_LEVELS[3];
const MAP_FINGERPRINT_GOLD_LEVELS = [0.4, 0.65, 0.8, 1] as const;
const MAP_FINGERPRINT_DEFAULT_GOLD_LEVEL = MAP_FINGERPRINT_GOLD_LEVELS[0];

const formatValue = (value: number): string => numberFormatter.format(Math.max(0, Math.round(value)));

const STEP_LABELS: Record<ReviewStepId, string> = {
  finished: "Game Finished",
  personal: "Personal Score Card",
  stats: "Global Stats",
  awards: "Blitz Awards",
  "map-fingerprint": "Map Fingerprint",
  leaderboard: "Global Leaderboard",
  "submit-score": "Submit Score + MMR",
  "claim-rewards": "Claim Rewards",
  "next-game": "Next Deployed Games Calendar",
};

const isAwardsStep = (step: ReviewStepId): boolean => {
  return step === "awards";
};

const isTimeFocusedAwardsStep = (step: ReviewStepId): boolean => {
  return step === "awards";
};

const buildStepShareMessage = ({
  step,
  data,
  nextGame,
}: {
  step: ReviewStepId;
  data: GameReviewData;
  nextGame: GameData | null;
}): string => {
  const worldLabel = data.worldName;

  if (step === "stats") {
    return [
      `${worldLabel} just ended on @realms_gg Blitz!`,
      `${formatValue(data.stats.numberOfPlayers)} players battled across ${formatValue(data.stats.totalTilesExplored)} tiles with ${formatValue(data.stats.totalTransactions)} total transactions.`,
      `${formatValue(data.stats.totalDeadTroops)} troops fell in battle.`,
      "",
      "Think you can survive the next round?",
      "blitz.realms.world",
      "#Realms #Eternum #Starknet",
    ].join("\n");
  }

  if (isAwardsStep(step)) {
    const normalizeAddress = (value: string | null | undefined): string | null => {
      if (!value) return null;
      const trimmed = value.trim();
      if (!trimmed) return null;

      try {
        const prefixed = trimmed.startsWith("0x") || trimmed.startsWith("0X") ? trimmed : `0x${trimmed}`;
        const parsed = BigInt(prefixed);
        if (parsed === 0n) return null;
        return `0x${parsed.toString(16)}`.toLowerCase();
      } catch {
        return null;
      }
    };

    const formatDuration = (seconds: number): string => {
      if (!Number.isFinite(seconds) || seconds < 0) return "None";
      const total = Math.floor(seconds);
      const hours = Math.floor(total / 3600);
      const minutes = Math.floor((total % 3600) / 60);
      const remaining = total % 60;
      if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
      if (minutes > 0) return `${minutes}m ${remaining}s`;
      return `${remaining}s`;
    };

    const leaderboardNames = new Map<string, string>();
    for (const entry of data.leaderboard) {
      const normalized = normalizeAddress(entry.address);
      if (!normalized) continue;
      leaderboardNames.set(normalized, entry.displayName?.trim() || displayAddress(normalized));
    }

    const resolveWinnerName = (
      metric: { playerAddress: string; value: number } | null,
      formatter: (value: number) => string,
    ): string => {
      if (!metric) return "None";
      const normalized = normalizeAddress(metric.playerAddress);
      if (!normalized) return "None";
      const name = leaderboardNames.get(normalized) || displayAddress(normalized);
      return `${name} (${formatter(metric.value)})`;
    };

    const includeOnlyTimeMetrics = isTimeFocusedAwardsStep(step);

    return [
      `${worldLabel} Blitz Awards on @realms_gg:`,
      `First Blood: ${resolveWinnerName(data.stats.firstBlood, formatDuration)}`,
      `First T3 Troops: ${resolveWinnerName(data.stats.timeToFirstT3Seconds, formatDuration)}`,
      `First Hyperstructure: ${resolveWinnerName(data.stats.timeToFirstHyperstructureSeconds, formatDuration)}`,
      ...(includeOnlyTimeMetrics
        ? []
        : [
            `Most Troops Killed: ${resolveWinnerName(data.stats.mostTroopsKilled, formatValue)}`,
            `Highest Explored Tiles: ${resolveWinnerName(data.stats.highestExploredTiles, formatValue)}`,
            `Most Structures Owned: ${resolveWinnerName(data.stats.biggestStructuresOwned, formatValue)}`,
          ]),
      "",
      "blitz.realms.world",
      "#Realms #Eternum #Starknet",
    ].join("\n");
  }

  if (step === "leaderboard") {
    const podiumLines = data.topPlayers.map((entry) => {
      const name = (entry.displayName?.trim() || displayAddress(entry.address)).trim();
      return `#${entry.rank} ${name} - ${formatValue(entry.points)} pts`;
    });
    return [
      `Final standings for ${worldLabel} on @realms_gg Blitz:`,
      "",
      ...(podiumLines.length > 0 ? podiumLines : ["Top players are in!"]),
      "",
      "Can you dethrone the champions?",
      "blitz.realms.world",
      "#Realms #Eternum #Starknet",
    ].join("\n");
  }

  if (step === "map-fingerprint") {
    if (!data.mapSnapshot.available) {
      return [`${worldLabel} map snapshot is unavailable.`, "#Realms #Eternum #Starknet"].join("\n");
    }

    const signature = data.mapSnapshot.fingerprintBiome;

    return [
      `${worldLabel} final map fingerprint (Biome View)`,
      `Signature: ${signature}`,
      "",
      "Can you leave your own mark on the next map?",
      "blitz.realms.world",
      "#Realms #Eternum #Starknet",
    ].join("\n");
  }

  if (step === "personal" && data.personalScore) {
    return [
      `${worldLabel} personal result:`,
      `Rank #${data.personalScore.rank} with ${formatValue(data.personalScore.points)} points.`,
      "",
      "blitz.realms.world",
      "#Realms #Eternum #Starknet",
    ].join("\n");
  }

  if (step === "next-game" && nextGame) {
    return [`Next game: ${nextGame.name}`, "Registration is open on Realms Blitz.", "#Realms #Eternum"].join("\n");
  }

  return [`${worldLabel} review is complete.`, "#Realms #Eternum"].join("\n");
};

const getMmrStatus = (data: GameReviewData): string => {
  if (!data.finalization.mmrEnabled) return "MMR is disabled for this world.";
  if (data.finalization.mmrCommitted) return "MMR has already been committed.";
  if (!data.finalization.mmrTokenAddress) return "MMR token is not configured.";
  if (data.finalization.registeredPlayers.length < data.finalization.mmrMinPlayers) {
    return `MMR unavailable: requires at least ${data.finalization.mmrMinPlayers} players.`;
  }
  return "MMR is eligible and will be submitted with score finalization.";
};

const canRetryMmrUpdate = (data: GameReviewData): boolean => {
  const finalization = data.finalization;
  return (
    finalization.rankingFinalized &&
    finalization.mmrEnabled &&
    !finalization.mmrCommitted &&
    Boolean(finalization.mmrTokenAddress) &&
    finalization.registeredPlayers.length >= finalization.mmrMinPlayers
  );
};

const formatCountdown = (seconds: number): string => {
  if (seconds <= 0) return "0s";

  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const secs = Math.floor(seconds % 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
};

const isSingleRegistrantNoGame = (finalization: GameReviewData["finalization"]): boolean =>
  finalization.registrationCount === 1 && !finalization.rankingFinalized;

const getSecondsUntilScoreSubmissionOpen = (
  finalization: GameReviewData["finalization"],
  nowTs: number,
): number | null => {
  if (isSingleRegistrantNoGame(finalization)) {
    return 0;
  }

  const opensAt = finalization.scoreSubmissionOpensAt;
  if (finalization.rankingFinalized) {
    return 0;
  }
  if (!opensAt) return null;

  const remaining = opensAt - nowTs + 1;
  return remaining > 0 ? remaining : 0;
};

const isScoreSubmissionWindowOpen = (finalization: GameReviewData["finalization"], nowTs: number): boolean => {
  const secondsUntilOpen = getSecondsUntilScoreSubmissionOpen(finalization, nowTs);
  return secondsUntilOpen === 0;
};

const GameFinishedStep = ({ data }: { data: GameReviewData }) => {
  const winner = data.topPlayers[0];
  const winnerLabel = winner ? winner.displayName?.trim() || displayAddress(winner.address) : "No winner available yet";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-gold">
        <Flag className="h-4 w-4" />
        <h3 className="font-serif text-xl">Game Is Finished</h3>
      </div>
      <p className="text-xs uppercase tracking-wider text-gold/60">World: {data.worldName}</p>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-gold/20 bg-dark/80 p-3">
          <p className="text-[11px] uppercase tracking-wider text-gold/60">Winner</p>
          <p className="mt-1 text-sm text-white">{winnerLabel}</p>
        </div>
        <div className="rounded-xl border border-gold/20 bg-dark/80 p-3">
          <p className="text-[11px] uppercase tracking-wider text-gold/60">Registered Players</p>
          <p className="mt-1 text-sm text-white">{formatValue(data.stats.numberOfPlayers)}</p>
        </div>
        <div className="rounded-xl border border-gold/20 bg-dark/80 p-3">
          <p className="text-[11px] uppercase tracking-wider text-gold/60">Total Transactions</p>
          <p className="mt-1 text-sm text-white">{formatValue(data.stats.totalTransactions)}</p>
        </div>
      </div>
    </div>
  );
};

const SubmitScoreStep = ({
  data,
  nowTs,
  hasSigner,
  isSubmitting,
  onSubmit,
  onRequireSignIn,
}: {
  data: GameReviewData;
  nowTs: number;
  hasSigner: boolean;
  isSubmitting: boolean;
  onSubmit: () => void;
  onRequireSignIn: () => void;
}) => {
  const scoreSubmitted = data.finalization.rankingFinalized;
  const secondsUntilOpen = getSecondsUntilScoreSubmissionOpen(data.finalization, nowTs);
  const submissionWindowOpen = isScoreSubmissionWindowOpen(data.finalization, nowTs);
  const canRetryMMR = canRetryMmrUpdate(data);
  const canSubmitScore = !scoreSubmitted && submissionWindowOpen;
  const canRunPrimaryAction = canSubmitScore || canRetryMMR;
  const submissionUnlockTime =
    data.finalization.scoreSubmissionOpensAt != null
      ? new Date((data.finalization.scoreSubmissionOpensAt + 1) * 1000)
      : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-gold">
        <Shield className="h-4 w-4" />
        <h3 className="font-serif text-xl">Submit Score (+ MMR if Eligible)</h3>
      </div>
      <p className="text-xs uppercase tracking-wider text-gold/60">Game: {data.worldName}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-gold/20 bg-dark/80 p-3">
          <p className="text-[11px] uppercase tracking-wider text-gold/60">Score Submission Status</p>
          <p className="mt-1 text-sm text-white">
            {scoreSubmitted ? "Score is already submitted and finalized." : "Score submission is pending."}
          </p>
        </div>
        <div className="rounded-xl border border-gold/20 bg-dark/80 p-3">
          <p className="text-[11px] uppercase tracking-wider text-gold/60">MMR Status</p>
          <p className="mt-1 text-sm text-white">{getMmrStatus(data)}</p>
        </div>
      </div>

      {!hasSigner && canRunPrimaryAction && (
        <div className="rounded-xl border border-orange/30 bg-orange/10 p-3 text-sm text-orange">
          Connect a wallet to submit score.
        </div>
      )}

      {!scoreSubmitted && !submissionWindowOpen && secondsUntilOpen != null && secondsUntilOpen > 0 && (
        <div className="rounded-xl border border-gold/35 bg-gold/10 p-3 text-sm text-gold">
          <div className="font-medium">Point registration is still open.</div>
          <div className="mt-1">Score submission unlocks in {formatCountdown(secondsUntilOpen)}.</div>
          {submissionUnlockTime && (
            <div className="mt-1 text-xs text-gold/75">
              Opens at {submissionUnlockTime.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}.
            </div>
          )}
        </div>
      )}
      {!scoreSubmitted && !submissionWindowOpen && secondsUntilOpen == null && (
        <div className="rounded-xl border border-gold/35 bg-gold/10 p-3 text-sm text-gold">
          Submission opens once the game and registration grace period end.
        </div>
      )}
      {canRetryMMR && (
        <div className="rounded-xl border border-gold/35 bg-gold/10 p-3 text-sm text-gold">
          Scores are already finalized. Retry MMR update independently if the previous MMR submission failed.
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          onClick={hasSigner ? onSubmit : onRequireSignIn}
          variant="gold"
          className="w-full justify-center !px-4 !py-2.5"
          forceUppercase={false}
          isLoading={isSubmitting}
          disabled={isSubmitting || !hasSigner || !canRunPrimaryAction}
        >
          {isSubmitting
            ? "Submitting..."
            : canRetryMMR
              ? "Retry MMR update"
              : scoreSubmitted
                ? "Score already submitted"
                : !submissionWindowOpen && secondsUntilOpen != null
                  ? `Opens in ${formatCountdown(secondsUntilOpen)}`
                  : !submissionWindowOpen
                    ? "Waiting for window"
                    : "Submit score now"}
        </Button>
      </div>

      <div className="rounded-xl border border-gold/20 bg-dark/80 p-3 text-sm text-gold/75">
        Reward claiming only requires score submission. MMR is only saved if there's a minimum of 6 players.
      </div>
    </div>
  );
};

const ClaimRewardsStep = ({
  data,
  hasSigner,
  isClaiming,
  onClaim,
  onRequireSignIn,
}: {
  data: GameReviewData;
  hasSigner: boolean;
  isClaiming: boolean;
  onClaim: () => void;
  onRequireSignIn: () => void;
}) => {
  const rewards = data.rewards;
  const scoreSubmitted = rewards?.scoreSubmitted ?? data.finalization.rankingFinalized;
  const alreadyClaimed = rewards?.alreadyClaimed ?? false;
  const canClaimNow = rewards?.canClaimNow ?? false;
  const claimBlockedReason = rewards?.claimBlockedReason;
  const lordsWon = rewards?.lordsWonFormatted ?? "0";
  const chestsClaimedEstimate = rewards?.chestsClaimedEstimate ?? 0;
  const chestsClaimedReason = rewards?.chestsClaimedReason ?? "No chest estimate available.";
  const eliteTicketEarned = rewards?.eliteTicketEarned ? 1 : 0;
  const eliteTicketReason =
    rewards?.eliteTicketReason ??
    "Elite ticket eligibility is available once score is submitted and final ranking is available.";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-gold">
        <Gift className="h-4 w-4" />
        <h3 className="font-serif text-xl">Claim Rewards</h3>
      </div>
      <p className="text-xs uppercase tracking-wider text-gold/60">Game: {data.worldName}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-gold/20 bg-dark/80 p-3">
          <p className="text-[11px] uppercase tracking-wider text-gold/60">$LORDS won</p>
          <p className="mt-1 text-sm text-white">{lordsWon}</p>
        </div>
        <div className="rounded-xl border border-gold/20 bg-dark/80 p-3">
          <p className="text-[11px] uppercase tracking-wider text-gold/60">Chests claimed</p>
          <p className="mt-1 text-sm text-white">{formatValue(chestsClaimedEstimate)}</p>
          <p className="mt-1 text-xs text-gold/70">{chestsClaimedReason}</p>
        </div>
        <div className="rounded-xl border border-gold/20 bg-dark/80 p-3">
          <p className="text-[11px] uppercase tracking-wider text-gold/60">Elite ticket earned</p>
          <p className="mt-1 text-sm text-white">{eliteTicketEarned}</p>
          <p className="mt-1 text-xs text-gold/70">{eliteTicketReason}</p>
        </div>
      </div>

      {!scoreSubmitted && (
        <div className="rounded-xl border border-orange/30 bg-orange/10 p-3 text-sm text-orange">
          Submit score first to unlock reward claiming.
        </div>
      )}

      {claimBlockedReason && scoreSubmitted && !alreadyClaimed && (
        <div className="rounded-xl border border-gold/20 bg-dark/80 p-3 text-sm text-gold/75">{claimBlockedReason}</div>
      )}

      {alreadyClaimed && (
        <div className="rounded-xl border border-brilliance/40 bg-brilliance/10 p-3 text-sm text-brilliance">
          Rewards already claimed.
        </div>
      )}

      {!hasSigner && (
        <div className="rounded-xl border border-orange/30 bg-orange/10 p-3 text-sm text-orange">
          Connect a wallet to claim rewards.
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          onClick={hasSigner ? onClaim : onRequireSignIn}
          variant="gold"
          className="w-full justify-center !px-4 !py-2.5"
          forceUppercase={false}
          isLoading={isClaiming}
          disabled={isClaiming || !canClaimNow || !hasSigner}
        >
          {isClaiming ? "Claiming..." : alreadyClaimed ? "Rewards claimed" : "Claim rewards"}
        </Button>
      </div>
    </div>
  );
};

const UpcomingGamesStep = ({
  worldName,
  onRegistrationComplete,
}: {
  worldName: string;
  onRegistrationComplete: () => void;
}) => {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="font-serif text-xl text-gold">Next Deployed Games Calendar</h3>
        <p className="text-xs uppercase tracking-wider text-gold/60">Finished Game: {worldName}</p>
      </div>

      <div className="max-h-[440px] overflow-y-auto rounded-xl border border-gold/20 bg-dark/80 p-3">
        <UnifiedGameGrid
          onSelectGame={() => undefined}
          onSpectate={() => undefined}
          onRegistrationComplete={onRegistrationComplete}
          devModeFilter={false}
          statusFilter="upcoming"
          hideHeader
          hideLegend
          layout="vertical"
          sortRegisteredFirst
        />
      </div>
    </div>
  );
};

export const GameReviewModal = ({
  isOpen,
  world,
  nextGame,
  showUpcomingGamesStep = true,
  onClose,
  onRegistrationComplete,
  onRequireSignIn,
}: GameReviewModalProps) => {
  const worldName = world?.name;
  const worldChain = world?.chain;

  const account = useAccountStore((state) => state.account);
  const accountName = useAccountStore((state) => state.accountName);

  const { data, isLoading, error, refetch } = useGameReviewData({
    worldName,
    chain: worldChain,
    enabled: isOpen,
  });

  const queryClient = useQueryClient();
  const [stepIndex, setStepIndex] = useState(0);
  const [frozenSnapshot, setFrozenSnapshot] = useState<Pick<
    GameReviewData,
    "stats" | "topPlayers" | "mapSnapshot"
  > | null>(null);
  const captureRef = useRef<HTMLDivElement | null>(null);
  const [isCopying, setIsCopying] = useState(false);
  const [nowTs, setNowTs] = useState(() => Math.floor(Date.now() / 1000));
  const [mapFingerprintZoom, setMapFingerprintZoom] = useState<number>(MAP_FINGERPRINT_DEFAULT_ZOOM);
  const [mapFingerprintGoldLevel, setMapFingerprintGoldLevel] = useState<number>(MAP_FINGERPRINT_DEFAULT_GOLD_LEVEL);
  const currentMapZoomIndex = useMemo(() => {
    const exactIndex = MAP_FINGERPRINT_ZOOM_LEVELS.findIndex(
      (zoomLevel) => Math.abs(mapFingerprintZoom - zoomLevel) < 0.001,
    );
    if (exactIndex >= 0) return exactIndex;

    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    MAP_FINGERPRINT_ZOOM_LEVELS.forEach((zoomLevel, index) => {
      const distance = Math.abs(mapFingerprintZoom - zoomLevel);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    return bestIndex;
  }, [mapFingerprintZoom]);
  const canZoomIn = currentMapZoomIndex < MAP_FINGERPRINT_ZOOM_LEVELS.length - 1;
  const canZoomOut = currentMapZoomIndex > 0;
  const currentGoldLevelIndex = useMemo(() => {
    const exactIndex = MAP_FINGERPRINT_GOLD_LEVELS.findIndex(
      (goldLevel) => Math.abs(mapFingerprintGoldLevel - goldLevel) < 0.001,
    );
    if (exactIndex >= 0) return exactIndex;

    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    MAP_FINGERPRINT_GOLD_LEVELS.forEach((goldLevel, index) => {
      const distance = Math.abs(mapFingerprintGoldLevel - goldLevel);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    return bestIndex;
  }, [mapFingerprintGoldLevel]);

  const cardPlayer = useMemo(() => {
    const name = accountName?.trim() || data?.personalScore?.displayName?.trim() || null;
    const address = data?.personalScore?.address ?? account?.address ?? null;
    if (!name && !address) return null;
    return {
      name: name || displayAddress(address ?? ""),
      address: displayAddress(address ?? ""),
    };
  }, [accountName, data?.personalScore, account?.address]);

  const steps = useMemo<ReviewStepId[]>(() => {
    const ordered: ReviewStepId[] = [
      "finished",
      "personal",
      "stats",
      "awards",
      "map-fingerprint",
      "leaderboard",
      "submit-score",
      "claim-rewards",
    ];
    if (showUpcomingGamesStep) {
      ordered.push("next-game");
    }
    return ordered;
  }, [showUpcomingGamesStep]);

  const currentStep = steps[Math.min(stepIndex, steps.length - 1)] ?? "finished";
  const currentStepLabel = STEP_LABELS[currentStep];
  const isStepShareable = useMemo(() => {
    if (currentStep === "stats" || isAwardsStep(currentStep) || currentStep === "leaderboard") {
      return true;
    }

    if (currentStep === "map-fingerprint") {
      return Boolean(data?.mapSnapshot.available);
    }

    if (currentStep === "personal") {
      return Boolean(data?.personalScore);
    }

    return false;
  }, [currentStep, data?.mapSnapshot.available, data?.personalScore]);

  const reviewData = useMemo<GameReviewData | null>(() => {
    if (!data) return null;
    if (!frozenSnapshot) return data;
    return {
      ...data,
      stats: frozenSnapshot.stats,
      topPlayers: frozenSnapshot.topPlayers,
      mapSnapshot: frozenSnapshot.mapSnapshot,
    };
  }, [data, frozenSnapshot]);

  const canProceedToNextStep = useMemo(() => {
    if (!reviewData) return true;
    if (currentStep === "submit-score") {
      return reviewData.finalization.rankingFinalized;
    }
    if (currentStep === "claim-rewards") {
      if (!reviewData.rewards) return true;
      return Boolean(reviewData.rewards.alreadyClaimed) || Boolean(reviewData.rewards.canProceedWithoutClaim);
    }
    return true;
  }, [currentStep, reviewData]);

  const nextStepBlockedReason = useMemo(() => {
    if (!reviewData) return null;
    if (currentStep === "submit-score" && !reviewData.finalization.rankingFinalized) {
      return "Submit score before continuing.";
    }
    if (
      currentStep === "claim-rewards" &&
      reviewData.rewards &&
      !reviewData.rewards?.alreadyClaimed &&
      !reviewData.rewards?.canProceedWithoutClaim
    ) {
      return "Claim rewards before continuing.";
    }
    return null;
  }, [currentStep, reviewData]);

  useEffect(() => {
    if (!isOpen) return;
    setStepIndex(0);
    setFrozenSnapshot(null);
    setMapFingerprintZoom(MAP_FINGERPRINT_DEFAULT_ZOOM);
    setMapFingerprintGoldLevel(MAP_FINGERPRINT_DEFAULT_GOLD_LEVEL);
  }, [isOpen, worldName, worldChain]);

  useEffect(() => {
    if (!isOpen || !data) return;
    setFrozenSnapshot(
      (previous) => previous ?? { stats: data.stats, topPlayers: data.topPlayers, mapSnapshot: data.mapSnapshot },
    );
  }, [data, isOpen]);

  useEffect(() => {
    if (stepIndex < steps.length) return;
    setStepIndex(Math.max(0, steps.length - 1));
  }, [stepIndex, steps.length]);

  useEffect(() => {
    if (!isOpen) return;
    setNowTs(Math.floor(Date.now() / 1000));
    const interval = setInterval(() => setNowTs(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  const finalizeMutation = useMutation({
    mutationFn: async () => {
      if (!worldName || !worldChain || !account) {
        throw new Error("Missing world selection or signer.");
      }

      return finalizeGameRankingAndMMR({
        worldName,
        chain: worldChain,
        signer: account,
      });
    },
    onSuccess: async (result) => {
      if (result.mmrError) {
        toast("Score submission completed with MMR pending.", {
          description: `${result.totalPlayers} players processed. Retry MMR independently from this step.`,
        });
      } else {
        toast.success("Score submission completed.", {
          description: result.mmrSubmitted
            ? `${result.totalPlayers} players processed. MMR committed.`
            : `${result.totalPlayers} players processed. MMR was optional or unavailable.`,
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["gameReview", worldChain ?? "", worldName ?? ""] });
      if (!result.mmrError) {
        setStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
      }
    },
    onError: (caughtError) => {
      console.error("Failed to submit score/MMR", caughtError);
      const errorMessage = caughtError instanceof Error ? caughtError.message : String(caughtError);
      const isGracePeriodError = errorMessage.toLowerCase().includes("registration grace period is not over");

      if (isGracePeriodError && reviewData) {
        const secondsUntilOpen = getSecondsUntilScoreSubmissionOpen(reviewData.finalization, nowTs);
        toast.error("Score submission is not open yet.", {
          description:
            secondsUntilOpen != null && secondsUntilOpen > 0
              ? `Point registration closes in ${formatCountdown(secondsUntilOpen)}.`
              : "Submission opens once the game and registration grace period end.",
        });
        return;
      }

      toast.error("Failed to submit score or MMR.", { description: errorMessage });
    },
  });

  const claimRewardsMutation = useMutation({
    mutationFn: async () => {
      if (!worldName || !worldChain || !account?.address || !account) {
        throw new Error("Missing world selection or signer.");
      }

      return claimGameReviewRewards({
        worldName,
        chain: worldChain,
        signer: account,
        playerAddress: account.address,
      });
    },
    onSuccess: async () => {
      toast.success("Rewards claimed.");
      await queryClient.invalidateQueries({ queryKey: ["gameReview", worldChain ?? "", worldName ?? ""] });
    },
    onError: (caughtError) => {
      console.error("Failed to claim rewards", caughtError);
      toast.error("Failed to claim rewards.");
    },
  });

  const handleSubmitScore = useCallback(() => {
    if (!account) {
      onRequireSignIn();
      return;
    }

    if (reviewData) {
      const retryAvailable = canRetryMmrUpdate(reviewData);
      if (reviewData.finalization.rankingFinalized) {
        if (!retryAvailable) {
          toast.error("MMR retry is unavailable.", {
            description: getMmrStatus(reviewData),
          });
          return;
        }
      } else {
        const secondsUntilOpen = getSecondsUntilScoreSubmissionOpen(reviewData.finalization, nowTs);
        if (secondsUntilOpen == null || secondsUntilOpen > 0) {
          toast.error("Score submission is not open yet.", {
            description:
              secondsUntilOpen != null
                ? `Point registration closes in ${formatCountdown(secondsUntilOpen)}.`
                : "Submission opens once the game and registration grace period end.",
          });
          return;
        }
      }
    }

    finalizeMutation.mutate();
  }, [account, finalizeMutation, nowTs, onRequireSignIn, reviewData]);

  const handleClaimRewards = useCallback(() => {
    if (!account) {
      onRequireSignIn();
      return;
    }
    claimRewardsMutation.mutate();
  }, [account, claimRewardsMutation, onRequireSignIn]);

  const handleCopyStep = useCallback(async () => {
    if (!isStepShareable || !captureRef.current) return;

    if (typeof window === "undefined") {
      toast.error("Copying images is not supported in this environment.");
      return;
    }

    if (!("ClipboardItem" in window) || !navigator.clipboard?.write) {
      toast.error("Copying images is not supported in this browser.");
      return;
    }

    setIsCopying(true);

    try {
      const fontReady =
        typeof document !== "undefined" && "fonts" in document ? document.fonts.ready.catch(() => undefined) : null;
      const waiters = fontReady ? [fontReady] : [];
      await Promise.all(waiters);

      const captureNode =
        (captureRef.current.querySelector(".blitz-card-root") as HTMLElement | null) ?? captureRef.current;
      const captureRect = captureNode.getBoundingClientRect();
      const captureWidth = Math.max(1, Math.round(captureRect.width));
      const captureHeight = Math.max(1, Math.round(captureRect.height));
      const exportWidth = captureWidth + EXPORT_STAGE_PADDING_X * 2;
      const exportHeight = captureHeight + EXPORT_STAGE_PADDING_Y * 2;

      const pixelRatio = 2;
      const captureDataUrl = await toPng(captureNode, {
        cacheBust: true,
        pixelRatio,
        backgroundColor: "#010101",
        canvasWidth: captureWidth,
        canvasHeight: captureHeight,
        style: {
          width: `${captureWidth}px`,
          height: `${captureHeight}px`,
          margin: "0",
        },
      });

      const capturedImage = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Failed to decode captured step image."));
        image.src = captureDataUrl;
      });

      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = exportWidth * pixelRatio;
      exportCanvas.height = exportHeight * pixelRatio;

      const context = exportCanvas.getContext("2d");
      if (!context) {
        throw new Error("Unable to create export canvas.");
      }

      context.fillStyle = "#010101";
      context.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

      const offsetX = ((exportWidth - captureWidth) / 2) * pixelRatio;
      const offsetY = ((exportHeight - captureHeight) / 2) * pixelRatio;
      context.drawImage(capturedImage, offsetX, offsetY, captureWidth * pixelRatio, captureHeight * pixelRatio);

      const blob = await new Promise<Blob>((resolve, reject) => {
        exportCanvas.toBlob((canvasBlob) => {
          if (!canvasBlob) {
            reject(new Error("Unable to encode PNG export."));
            return;
          }

          resolve(canvasBlob);
        }, "image/png");
      });
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast.success("Step image copied to clipboard.");
    } catch (caughtError) {
      console.error("Failed to copy review step image", caughtError);
      toast.error("Could not copy the image.");
    } finally {
      setIsCopying(false);
    }
  }, [isStepShareable]);

  const shareMessage = useMemo(() => {
    if (!reviewData || !isStepShareable) return "";
    return buildStepShareMessage({
      step: currentStep,
      data: reviewData,
      nextGame,
    });
  }, [currentStep, reviewData, isStepShareable, nextGame]);

  const handleShareOnX = useCallback(() => {
    if (!shareMessage) return;

    const url = new URL("https://twitter.com/intent/tweet");
    url.searchParams.set("text", shareMessage);
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  }, [shareMessage]);

  const handleNextStep = useCallback(() => {
    if (!canProceedToNextStep) {
      if (nextStepBlockedReason) {
        toast.error(nextStepBlockedReason);
      }
      return;
    }

    if (stepIndex >= steps.length - 1) {
      onClose();
      return;
    }

    setStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
  }, [canProceedToNextStep, nextStepBlockedReason, onClose, stepIndex, steps.length]);

  const handlePrevStep = useCallback(() => {
    setStepIndex((prev) => Math.max(0, prev - 1));
  }, []);

  if (!isOpen || !worldName || !worldChain) return null;
  const currentStepNumber = Math.min(stepIndex + 1, steps.length);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={onClose} />
      <div className="pointer-events-none absolute inset-0 endgame-backdrop-cinematic" />

      <div className="endgame-modal-enter endgame-surface endgame-shell-cinematic relative z-10 flex max-h-[84vh] w-full max-w-[1100px] flex-col overflow-hidden rounded-2xl border border-gold/35 shadow-2xl shadow-dark/70">
        <div className="border-b border-gold/20 px-4 py-3.5 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="gold-gradient-text truncate font-serif text-lg sm:text-xl">Game In Review</h2>
              <p className="mt-0.5 truncate text-sm text-gold/75">{worldName}</p>
            </div>

            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {steps.map((step, index) => {
              const isActive = index === stepIndex;
              const isCompleted = index < stepIndex;
              const widthClass = isActive || isCompleted ? "w-6" : "w-2";
              const toneClass = isActive ? "bg-gold endgame-progress-pulse" : isCompleted ? "bg-gold/75" : "bg-gold/25";

              return (
                <span
                  key={`${step}-${index}`}
                  className={`h-2 rounded-full transition-all ${widthClass} ${toneClass}`}
                />
              );
            })}
            <span className="ml-1 text-[11px] text-gold/70">
              {currentStepNumber}/{steps.length}
            </span>
            <span className="text-[11px] uppercase tracking-wider text-gold/50">{currentStepLabel}</span>
          </div>
          <div className="endgame-header-ornament" />
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {isLoading ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-gold" />
              <p className="mt-3 text-sm text-gold/70">Loading game review...</p>
            </div>
          ) : error || !reviewData ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-center">
              <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-2 text-sm text-lightest">
                Failed to load game review data.
              </div>
              <Button onClick={() => void refetch()} variant="outline" forceUppercase={false}>
                Retry
              </Button>
            </div>
          ) : (
            <div
              key={currentStep}
              className="endgame-step-enter rounded-xl border border-gold/20 bg-black/20 p-3 sm:p-4"
            >
              {currentStep === "finished" && <GameFinishedStep data={reviewData} />}

              {currentStep === "personal" &&
                (reviewData.personalScore ? (
                  <div ref={captureRef} className="mx-auto w-full" style={CARD_PREVIEW_STYLE}>
                    <ScoreCardContent
                      worldName={reviewData.worldName}
                      playerEntry={reviewData.personalScore}
                      showActions={false}
                    />
                  </div>
                ) : (
                  <div className="rounded-xl border border-gold/20 bg-dark/80 p-4 text-sm text-gold/70">
                    No personal score card is available for this account.
                  </div>
                ))}

              {currentStep === "stats" && (
                <div className="space-y-3">
                  <div ref={captureRef} className="mx-auto w-full" style={CARD_PREVIEW_STYLE}>
                    <BlitzGameStatsCardWithSelector
                      worldName={reviewData.worldName}
                      stats={reviewData.stats}
                      player={cardPlayer}
                    />
                  </div>
                </div>
              )}

              {currentStep === "awards" && (
                <div className="space-y-3">
                  <div ref={captureRef} className="mx-auto w-full" style={CARD_PREVIEW_STYLE}>
                    <BlitzAwardsOptionSixCardWithSelector
                      worldName={reviewData.worldName}
                      stats={reviewData.stats}
                      leaderboard={reviewData.leaderboard}
                      player={cardPlayer}
                    />
                  </div>
                </div>
              )}

              {currentStep === "map-fingerprint" && (
                <div className="space-y-3">
                  {reviewData.mapSnapshot.available ? (
                    <>
                      <div className="mx-auto flex w-full max-w-[1060px] items-center justify-center gap-2 sm:gap-3">
                        <div ref={captureRef} className="min-w-0 flex-1" style={CARD_PREVIEW_STYLE}>
                          <BlitzMapFingerprintCardWithSelector
                            worldName={reviewData.worldName}
                            snapshot={reviewData.mapSnapshot}
                            mode="biome"
                            zoom={mapFingerprintZoom}
                            goldLevel={mapFingerprintGoldLevel}
                            player={cardPlayer}
                          />
                        </div>
                        <div className="inline-flex shrink-0 flex-col overflow-hidden rounded-lg border border-gold/30 bg-black/40">
                          <button
                            type="button"
                            onClick={() => {
                              if (!canZoomIn) return;
                              const nextIndex = currentMapZoomIndex + 1;
                              setMapFingerprintZoom(MAP_FINGERPRINT_ZOOM_LEVELS[nextIndex]);
                            }}
                            disabled={!canZoomIn}
                            className="px-2.5 py-2 text-sm font-semibold uppercase tracking-wider text-gold transition-colors enabled:hover:bg-gold/10 disabled:cursor-not-allowed disabled:text-gold/40 sm:px-3"
                            aria-label="Zoom in"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!canZoomOut) return;
                              const nextIndex = currentMapZoomIndex - 1;
                              setMapFingerprintZoom(MAP_FINGERPRINT_ZOOM_LEVELS[nextIndex]);
                            }}
                            disabled={!canZoomOut}
                            className="px-2.5 py-2 text-sm font-semibold uppercase tracking-wider text-gold transition-colors enabled:hover:bg-gold/10 disabled:cursor-not-allowed disabled:text-gold/40 sm:px-3"
                            aria-label="Zoom out"
                          >
                            -
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const nextIndex = (currentGoldLevelIndex + 1) % MAP_FINGERPRINT_GOLD_LEVELS.length;
                              setMapFingerprintGoldLevel(MAP_FINGERPRINT_GOLD_LEVELS[nextIndex]);
                            }}
                            className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-gold transition-colors enabled:hover:bg-gold/10 sm:px-3"
                            aria-label={`Gold level ${Math.round(mapFingerprintGoldLevel * 100)} percent`}
                            title={`Gold ${Math.round(mapFingerprintGoldLevel * 100)}% (click to cycle)`}
                          >
                            G
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-xl border border-gold/20 bg-dark/80 p-4 text-sm text-gold/70">
                      {reviewData.mapSnapshot.reason || "Map snapshot unavailable."}
                    </div>
                  )}
                </div>
              )}

              {currentStep === "leaderboard" && (
                <div className="space-y-3">
                  <div ref={captureRef} className="mx-auto w-full" style={CARD_PREVIEW_STYLE}>
                    <BlitzLeaderboardCardWithSelector
                      worldName={reviewData.worldName}
                      topPlayers={reviewData.topPlayers}
                      player={cardPlayer}
                    />
                  </div>
                </div>
              )}

              {currentStep === "submit-score" && (
                <SubmitScoreStep
                  data={reviewData}
                  nowTs={nowTs}
                  hasSigner={Boolean(account)}
                  isSubmitting={finalizeMutation.isPending}
                  onSubmit={handleSubmitScore}
                  onRequireSignIn={onRequireSignIn}
                />
              )}

              {currentStep === "claim-rewards" && (
                <ClaimRewardsStep
                  data={reviewData}
                  hasSigner={Boolean(account)}
                  isClaiming={claimRewardsMutation.isPending}
                  onClaim={handleClaimRewards}
                  onRequireSignIn={onRequireSignIn}
                />
              )}

              {currentStep === "next-game" && showUpcomingGamesStep && (
                <UpcomingGamesStep worldName={reviewData.worldName} onRegistrationComplete={onRegistrationComplete} />
              )}
            </div>
          )}
        </div>

        <div className="border-t border-gold/20 p-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-2">
              <Button
                onClick={handlePrevStep}
                variant="outline"
                className="gap-2 !px-3 !py-2"
                forceUppercase={false}
                disabled={stepIndex === 0 || isLoading || Boolean(error)}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={handleNextStep}
                variant="gold"
                className="gap-2 !px-3 !py-2 shadow-lg shadow-gold/20"
                forceUppercase={false}
                disabled={isLoading || Boolean(error) || !canProceedToNextStep}
              >
                {stepIndex >= steps.length - 1 ? "Close" : "Next"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            {isStepShareable ? (
              <div className="flex gap-2">
                <Button
                  onClick={handleCopyStep}
                  variant="secondary"
                  className="gap-2 !px-3 !py-2"
                  forceUppercase={false}
                  isLoading={isCopying}
                  disabled={isLoading || Boolean(error) || isCopying}
                >
                  <Copy className="h-4 w-4" />
                  {isCopying ? "Copying..." : "Copy PNG"}
                </Button>
                <Button
                  onClick={handleShareOnX}
                  variant="outline"
                  className="gap-2 !px-3 !py-2"
                  forceUppercase={false}
                  disabled={isLoading || Boolean(error) || !shareMessage}
                >
                  <Share2 className="h-4 w-4" />
                  Share on X
                </Button>
              </div>
            ) : (
              <div />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
