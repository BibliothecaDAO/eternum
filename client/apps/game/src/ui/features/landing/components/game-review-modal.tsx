import { useAccountStore } from "@/hooks/store/use-account-store";
import { useWorldRegistration, type RegistrationStage } from "@/hooks/use-world-registration";
import {
  finalizeGameRankingAndMMR,
  type GameReviewData,
  type GameReviewStats,
} from "@/services/review/game-review-service";
import { BLITZ_CARD_DIMENSIONS } from "@/ui/shared/lib/blitz-highlight";
import { Button } from "@/ui/design-system/atoms";
import { displayAddress } from "@/ui/utils/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toPng } from "html-to-image";
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  Loader2,
  Medal,
  Share2,
  Shield,
  Swords,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useGameReviewData } from "../hooks/use-game-review-data";
import { type GameData, type WorldSelection } from "./game-selector/game-card-grid";
import { ScoreCardContent } from "./score-card-modal";

type ReviewStepId = "stats" | "leaderboard" | "personal" | "finalize" | "next-game";

interface GameReviewModalProps {
  isOpen: boolean;
  world: WorldSelection | null;
  nextGame: GameData | null;
  onClose: () => void;
  onReturnHome: () => void;
  onRegistrationComplete: () => void;
  onRequireSignIn: () => void;
}

const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const SHARE_CARD_DIMENSIONS = BLITZ_CARD_DIMENSIONS;
const SHARE_PREVIEW_MAX_WIDTH = SHARE_CARD_DIMENSIONS.width;
const EXPORT_STAGE_PADDING_X = 36;
const EXPORT_STAGE_PADDING_Y = 24;
const SHARE_FRAME_STYLE: CSSProperties = {
  maxWidth: `${SHARE_PREVIEW_MAX_WIDTH}px`,
};
const PERSONAL_CARD_PREVIEW_STYLE: CSSProperties = {
  maxWidth: `${SHARE_PREVIEW_MAX_WIDTH}px`,
};

const formatValue = (value: number): string => numberFormatter.format(Math.max(0, Math.round(value)));

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
      `Game review for ${worldLabel}:`,
      `${formatValue(data.stats.numberOfPlayers)} players, ${formatValue(data.stats.totalTilesExplored)} tiles explored, ${formatValue(data.stats.totalDeadTroops)} dead troops.`,
      "#Realms #Eternum",
    ].join("\n");
  }

  if (step === "leaderboard") {
    const podium = data.topPlayers
      .map((entry) => `#${entry.rank} ${(entry.displayName?.trim() || displayAddress(entry.address)).trim()}`)
      .join(" · ");
    return [`Final leaderboard for ${worldLabel}:`, podium || "Top players are in!", "#Realms #Eternum"].join("\n");
  }

  if (step === "personal" && data.personalScore) {
    return [
      `${worldLabel} personal result:`,
      `Rank #${data.personalScore.rank} with ${formatValue(data.personalScore.points)} points.`,
      "#Realms #Eternum",
    ].join("\n");
  }

  if (step === "next-game" && nextGame) {
    return [`Next game: ${nextGame.name}`, "Registration is open on Realms Blitz.", "#Realms #Eternum"].join("\n");
  }

  return [`${worldLabel} review is complete.`, "#Realms #Eternum"].join("\n");
};

const StatTile = ({ label, value }: { label: string; value: number }) => {
  return (
    <div className="rounded-xl border border-gold/20 bg-black/30 p-3">
      <p className="text-[11px] uppercase tracking-wider text-gold/60">{label}</p>
      <p className="mt-1 text-xl font-semibold text-white">{formatValue(value)}</p>
    </div>
  );
};

const GameStatsStep = ({ worldName, stats }: { worldName: string; stats: GameReviewStats }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-gold">
        <Trophy className="h-4 w-4" />
        <h3 className="font-serif text-xl">Game Stats</h3>
      </div>
      <p className="text-xs uppercase tracking-wider text-gold/60">Game: {worldName}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile label="Number of Players" value={stats.numberOfPlayers} />
        <StatTile label="Total Tiles Explored" value={stats.totalTilesExplored} />
        <StatTile label="Total Camps Taken" value={stats.totalCampsTaken} />
        <StatTile label="Total Essence Rifts Taken" value={stats.totalEssenceRiftsTaken} />
        <StatTile label="Total Hyperstructures Taken" value={stats.totalHyperstructuresTaken} />
        <StatTile label="Total Dead Troops" value={stats.totalDeadTroops} />
        <StatTile label="Total T1 Troops Created" value={stats.totalT1TroopsCreated} />
        <StatTile label="Total T2 Troops Created" value={stats.totalT2TroopsCreated} />
        <StatTile label="Total T3 Troops Created" value={stats.totalT3TroopsCreated} />
      </div>
    </div>
  );
};

const LeaderboardStep = ({ data }: { data: GameReviewData }) => {
  return (
    <div className="flex h-full flex-col space-y-3">
      <div className="flex items-center gap-2 text-gold">
        <Medal className="h-4 w-4" />
        <h3 className="font-serif text-xl">Final Leaderboard - Top 3</h3>
      </div>
      <p className="text-xs uppercase tracking-wider text-gold/60">Game: {data.worldName}</p>

      <div className="space-y-2">
        {data.topPlayers.length === 0 ? (
          <div className="rounded-xl border border-gold/20 bg-black/30 p-4 text-sm text-gold/70">
            Leaderboard data is not available yet.
          </div>
        ) : (
          data.topPlayers.map((entry, index) => (
            <div key={`${entry.address}-${entry.rank}-${index}`} className="rounded-xl border border-gold/25 bg-black/30 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wider text-gold/60">Rank #{entry.rank}</p>
                  <p className="text-lg font-semibold text-white">{entry.displayName?.trim() || displayAddress(entry.address)}</p>
                  <p className="text-[11px] text-white/40">{displayAddress(entry.address)}</p>
                </div>
                <div className="rounded-lg border border-gold/30 bg-gold/10 px-3 py-1.5 text-right">
                  <p className="text-[10px] uppercase tracking-wider text-gold/70">Points</p>
                  <p className="text-lg font-semibold text-gold">{formatValue(entry.points)}</p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
                <div className="rounded border border-white/10 bg-black/30 px-2 py-1.5 text-white/75">
                  Tiles: <span className="text-white">{formatValue(entry.exploredTiles ?? 0)}</span>
                </div>
                <div className="rounded border border-white/10 bg-black/30 px-2 py-1.5 text-white/75">
                  Camps: <span className="text-white">{formatValue(entry.campsTaken ?? 0)}</span>
                </div>
                <div className="rounded border border-white/10 bg-black/30 px-2 py-1.5 text-white/75">
                  Rifts: <span className="text-white">{formatValue(entry.riftsTaken ?? 0)}</span>
                </div>
                <div className="rounded border border-white/10 bg-black/30 px-2 py-1.5 text-white/75">
                  Hypers: <span className="text-white">{formatValue(entry.hyperstructuresConquered ?? 0)}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const FinalizeStep = ({
  data,
  isFinalizing,
  onFinalize,
  onReturnHome,
  hasSigner,
}: {
  data: GameReviewData;
  isFinalizing: boolean;
  onFinalize: () => void;
  onReturnHome: () => void;
  hasSigner: boolean;
}) => {
  const mmrNeedsSubmission =
    data.finalization.mmrEnabled &&
    Boolean(data.finalization.mmrTokenAddress) &&
    !data.finalization.mmrCommitted &&
    data.finalization.registeredPlayers.length >= data.finalization.mmrMinPlayers;

  const rankingNeedsSubmission = !data.finalization.rankingFinalized;
  const canSubmitAnything = rankingNeedsSubmission || mmrNeedsSubmission;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-gold">
        <Shield className="h-4 w-4" />
        <h3 className="font-serif text-xl">Finalize Ranking & Save MMR</h3>
      </div>
      <p className="text-xs uppercase tracking-wider text-gold/60">Game: {data.worldName}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-gold/20 bg-black/30 p-3">
          <p className="text-[11px] uppercase tracking-wider text-gold/60">Ranking Status</p>
          <p className="mt-1 text-sm text-white">
            {data.finalization.rankingFinalized ? "Final ranking is already published." : "Ranking submission is pending."}
          </p>
        </div>
        <div className="rounded-xl border border-gold/20 bg-black/30 p-3">
          <p className="text-[11px] uppercase tracking-wider text-gold/60">MMR Status</p>
          <p className="mt-1 text-sm text-white">
            {!data.finalization.mmrEnabled
              ? "MMR is disabled for this world."
              : data.finalization.mmrCommitted
                ? "MMR has already been committed."
                : data.finalization.registeredPlayers.length < data.finalization.mmrMinPlayers
                  ? `Needs at least ${data.finalization.mmrMinPlayers} players.`
                  : !data.finalization.mmrTokenAddress
                    ? "MMR token is not configured."
                    : "MMR submission is pending."}
          </p>
        </div>
      </div>

      {!hasSigner && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">
          Connect a wallet to finalize ranking and MMR.
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          onClick={canSubmitAnything ? onFinalize : onReturnHome}
          variant="gold"
          className="w-full justify-center !px-4 !py-2.5"
          forceUppercase={false}
          isLoading={isFinalizing}
          disabled={isFinalizing || !hasSigner}
        >
          {isFinalizing
            ? "Submitting..."
            : canSubmitAnything
              ? "Finalize ranking & save MMR then go home"
              : "Go back to home"}
        </Button>
        {!canSubmitAnything && (
          <Button
            onClick={onReturnHome}
            variant="outline"
            className="w-full justify-center !px-4 !py-2.5"
            forceUppercase={false}
          >
            Return Home
          </Button>
        )}
      </div>
    </div>
  );
};

const getStageLabel = (stage: RegistrationStage): string => {
  switch (stage) {
    case "obtaining-token":
      return "Obtaining token...";
    case "waiting-for-token":
      return "Confirming...";
    case "registering":
      return "Registering...";
    case "done":
      return "Registered!";
    case "error":
      return "Failed";
    default:
      return "Register";
  }
};

const NextGameStep = ({
  worldName,
  nextGame,
  playerAddress,
  onRegistrationComplete,
  onRequireSignIn,
}: {
  worldName: string;
  nextGame: GameData;
  playerAddress: string | null;
  onRegistrationComplete: () => void;
  onRequireSignIn: () => void;
}) => {
  const isUpcoming = nextGame.gameStatus === "upcoming";
  const isOngoing = nextGame.gameStatus === "ongoing";
  const canRegisterPeriod = isUpcoming || (isOngoing && (nextGame.config?.devModeOn ?? false));

  const { register, registrationStage, isRegistering, error, feeAmount, canRegister } = useWorldRegistration({
    worldName: nextGame.name,
    chain: nextGame.chain,
    config: nextGame.config,
    isRegistered: nextGame.isRegistered === true,
    enabled: nextGame.status === "ok" && canRegisterPeriod,
  });

  useEffect(() => {
    if (registrationStage === "done") {
      toast.success("Registration successful!", {
        description: `You are now registered for ${nextGame.name}`,
      });
      onRegistrationComplete();
    }
  }, [nextGame.name, onRegistrationComplete, registrationStage]);

  const handleRegister = useCallback(async () => {
    if (!playerAddress) {
      onRequireSignIn();
      return;
    }

    if (registrationStage === "done" || nextGame.isRegistered) return;

    try {
      await register();
    } catch (caughtError) {
      console.error("Next game registration failed", caughtError);
    }
  }, [nextGame.isRegistered, onRequireSignIn, playerAddress, register, registrationStage]);

  const showRegistered = nextGame.isRegistered || registrationStage === "done";

  const registerButtonLabel = !playerAddress
    ? "Register"
    : isRegistering
      ? getStageLabel(registrationStage)
      : showRegistered
        ? "Registered"
        : registrationStage === "error"
          ? "Retry Register"
          : canRegister
            ? "Register"
            : "Registration Closed";

  const registerButtonDisabled =
    isRegistering || (Boolean(playerAddress) && (showRegistered || !canRegister || !canRegisterPeriod));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-gold">
        <Users className="h-4 w-4" />
        <h3 className="font-serif text-xl">Next Upcoming Game</h3>
      </div>
      <p className="text-xs uppercase tracking-wider text-gold/60">Finished Game: {worldName}</p>

      <div className="rounded-xl border border-gold/20 bg-black/20 p-4">
        <p className="text-sm uppercase tracking-wider text-gold/60">Next Game</p>
        <p className="mt-1 text-lg font-semibold text-white">{nextGame.name}</p>
        <p className="text-xs text-white/60">
          {nextGame.registrationCount ?? 0} players • {nextGame.chain === "mainnet" ? "Mainnet" : "Slot"}
        </p>

        <Button
          onClick={handleRegister}
          variant="gold"
          className="mt-4 w-full justify-center !px-4 !py-2.5"
          forceUppercase={false}
          disabled={registerButtonDisabled}
        >
          {isRegistering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {registerButtonLabel}
        </Button>

        {feeAmount > 0n && canRegister && !showRegistered && !isRegistering && (
          <p className="mt-2 text-center text-[11px] text-gold/60">Fee required for registration</p>
        )}

        {registrationStage === "error" && error && <p className="mt-2 text-center text-[11px] text-red-400">{error}</p>}
      </div>
    </div>
  );
};

export const GameReviewModal = ({
  isOpen,
  world,
  nextGame,
  onClose,
  onReturnHome,
  onRegistrationComplete,
  onRequireSignIn,
}: GameReviewModalProps) => {
  const worldName = world?.name;
  const worldChain = world?.chain;

  const account = useAccountStore((state) => state.account);
  const playerAddress = account?.address && account.address !== "0x0" ? account.address : null;

  const { data, isLoading, error, refetch } = useGameReviewData({
    worldName,
    chain: worldChain,
    enabled: isOpen,
  });

  const queryClient = useQueryClient();
  const [stepIndex, setStepIndex] = useState(0);
  const captureRef = useRef<HTMLDivElement | null>(null);
  const [isCopying, setIsCopying] = useState(false);

  const steps = useMemo<ReviewStepId[]>(() => {
    if (!data) return ["stats", "leaderboard", "finalize"];

    const ordered: ReviewStepId[] = ["stats", "leaderboard"];
    if (data.isParticipant) {
      ordered.push("personal");
    }
    ordered.push("finalize");
    if (nextGame) {
      ordered.push("next-game");
    }

    return ordered;
  }, [data, nextGame]);

  const currentStep = steps[Math.min(stepIndex, steps.length - 1)] ?? "stats";
  const isStepShareable = useMemo(() => {
    if (currentStep === "stats" || currentStep === "leaderboard") {
      return true;
    }

    if (currentStep === "personal") {
      return Boolean(data?.personalScore);
    }

    return false;
  }, [currentStep, data?.personalScore]);

  useEffect(() => {
    if (!isOpen) return;
    setStepIndex(0);
  }, [isOpen, worldName, worldChain]);

  useEffect(() => {
    if (stepIndex < steps.length) return;
    setStepIndex(Math.max(0, steps.length - 1));
  }, [stepIndex, steps.length]);

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
      toast.success("Ranking/MMR submission completed.", {
        description: `${result.totalPlayers} players processed. Returning to home.`,
      });
      await queryClient.invalidateQueries({ queryKey: ["gameReview", worldChain ?? "", worldName ?? ""] });
      onReturnHome();
    },
    onError: (caughtError) => {
      console.error("Failed to finalize ranking/MMR", caughtError);
      toast.error("Failed to finalize ranking or MMR.");
    },
  });

  const handleFinalize = useCallback(() => {
    if (!account) {
      onRequireSignIn();
      return;
    }

    finalizeMutation.mutate();
  }, [account, finalizeMutation, onRequireSignIn]);

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
        currentStep === "personal"
          ? ((captureRef.current.querySelector(".blitz-card-root") as HTMLElement | null) ?? captureRef.current)
          : captureRef.current;
      const captureRect = captureNode.getBoundingClientRect();
      const captureWidth = Math.max(1, Math.round(captureRect.width));
      const captureHeight = Math.max(1, Math.round(captureRect.height));
      const exportWidth = captureWidth + EXPORT_STAGE_PADDING_X * 2;
      const exportHeight = captureHeight + EXPORT_STAGE_PADDING_Y * 2;

      const pixelRatio = 2;
      const captureDataUrl = await toPng(captureNode, {
        cacheBust: true,
        pixelRatio,
        backgroundColor: "#050505",
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

      context.fillStyle = "#050505";
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
  }, [currentStep, isStepShareable]);

  const shareMessage = useMemo(() => {
    if (!data || !isStepShareable) return "";
    return buildStepShareMessage({
      step: currentStep,
      data,
      nextGame,
    });
  }, [currentStep, data, isStepShareable, nextGame]);

  const handleShareOnX = useCallback(() => {
    if (!shareMessage) return;

    const url = new URL("https://twitter.com/intent/tweet");
    url.searchParams.set("text", shareMessage);
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  }, [shareMessage]);

  const handleNextStep = useCallback(() => {
    if (stepIndex >= steps.length - 1) {
      onClose();
      return;
    }

    setStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
  }, [onClose, stepIndex, steps.length]);

  const handlePrevStep = useCallback(() => {
    setStepIndex((prev) => Math.max(0, prev - 1));
  }, []);

  if (!isOpen || !worldName || !worldChain) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 flex max-h-[80vh] w-full max-w-[1100px] flex-col overflow-hidden rounded-2xl border border-gold/30 bg-gradient-to-b from-[#0a0a0a] to-[#050505] shadow-2xl">
        <div className="flex items-center justify-between border-b border-gold/20 p-4">
          <div>
            <h2 className="font-serif text-lg text-gold">Game In Review - {worldName}</h2>
            <p className="text-xs text-gold/60">
              Step {Math.min(stepIndex + 1, steps.length)} of {steps.length}
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {isLoading ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-gold" />
              <p className="mt-3 text-sm text-gold/70">Loading game review...</p>
            </div>
          ) : error || !data ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm text-red-400">Failed to load game review data.</p>
              <Button onClick={() => void refetch()} variant="outline" forceUppercase={false}>
                Retry
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-gold/20 bg-black/20 p-3 sm:p-4">
              {currentStep === "stats" && (
                <div
                  ref={captureRef}
                  className="mx-auto flex w-full flex-col rounded-xl border border-gold/25 bg-[#0a0a0a] p-4"
                  style={SHARE_FRAME_STYLE}
                >
                  <GameStatsStep worldName={data.worldName} stats={data.stats} />
                </div>
              )}

              {currentStep === "leaderboard" && (
                <div
                  ref={captureRef}
                  className="mx-auto flex w-full flex-col rounded-xl border border-gold/25 bg-[#0a0a0a] p-4"
                  style={SHARE_FRAME_STYLE}
                >
                  <LeaderboardStep data={data} />
                </div>
              )}

              {currentStep === "personal" && (
                <div ref={captureRef} className="space-y-2">
                  <div className="flex items-center gap-2 text-gold">
                    <Swords className="h-4 w-4" />
                    <h3 className="font-serif text-lg">Personal Score PnL</h3>
                  </div>
                  <p className="text-xs uppercase tracking-wider text-gold/60">Game: {data.worldName}</p>

                  {data.personalScore ? (
                    <div className="mx-auto w-full" style={PERSONAL_CARD_PREVIEW_STYLE}>
                      <ScoreCardContent worldName={data.worldName} playerEntry={data.personalScore} showActions={false} />
                    </div>
                  ) : (
                    <div className="rounded-xl border border-gold/20 bg-black/30 p-4 text-sm text-gold/70">
                      No personal score card is available for this account.
                    </div>
                  )}
                </div>
              )}

              {currentStep === "finalize" && (
                <div className="space-y-4">
                  <FinalizeStep
                    data={data}
                    hasSigner={Boolean(account)}
                    isFinalizing={finalizeMutation.isPending}
                    onFinalize={handleFinalize}
                    onReturnHome={onReturnHome}
                  />
                </div>
              )}

              {currentStep === "next-game" && nextGame && (
                <NextGameStep
                  worldName={data.worldName}
                  nextGame={nextGame}
                  playerAddress={playerAddress}
                  onRegistrationComplete={onRegistrationComplete}
                  onRequireSignIn={onRequireSignIn}
                />
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
                className="gap-2 !px-3 !py-2"
                forceUppercase={false}
                disabled={isLoading || Boolean(error)}
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
