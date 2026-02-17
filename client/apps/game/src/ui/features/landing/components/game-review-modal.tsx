import { useAccountStore } from "@/hooks/store/use-account-store";
import { finalizeGameRankingAndMMR, type GameReviewData } from "@/services/review/game-review-service";
import { BLITZ_CARD_DIMENSIONS } from "@/ui/shared/lib/blitz-highlight";
import { BlitzGameStatsCardWithSelector } from "@/ui/shared/components/blitz-game-stats-card";
import { BlitzLeaderboardCardWithSelector } from "@/ui/shared/components/blitz-leaderboard-card";
import { Button } from "@/ui/design-system/atoms";
import { displayAddress } from "@/ui/utils/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toPng } from "html-to-image";
import { ArrowLeft, ArrowRight, Copy, Loader2, Share2, Shield, X } from "lucide-react";
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useGameReviewData } from "../hooks/use-game-review-data";
import { UnifiedGameGrid, type GameData, type WorldSelection } from "./game-selector/game-card-grid";
import { ScoreCardContent } from "./score-card-modal";

type ReviewStepId = "stats" | "leaderboard" | "personal" | "finalize" | "next-game";

interface GameReviewModalProps {
  isOpen: boolean;
  world: WorldSelection | null;
  nextGame: GameData | null;
  showUpcomingGamesStep?: boolean;
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
const CARD_PREVIEW_STYLE: CSSProperties = {
  maxWidth: `${SHARE_PREVIEW_MAX_WIDTH}px`,
};

const formatValue = (value: number): string => numberFormatter.format(Math.max(0, Math.round(value)));

const STEP_LABELS: Record<ReviewStepId, string> = {
  stats: "Game Stats",
  leaderboard: "Final Leaderboard",
  personal: "Personal Score",
  finalize: "Finalize Results",
  "next-game": "Upcoming Games",
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
        <div className="rounded-xl border border-gold/20 bg-dark/80 p-3">
          <p className="text-[11px] uppercase tracking-wider text-gold/60">Ranking Status</p>
          <p className="mt-1 text-sm text-white">
            {data.finalization.rankingFinalized
              ? "Final ranking is already published."
              : "Ranking submission is pending."}
          </p>
        </div>
        <div className="rounded-xl border border-gold/20 bg-dark/80 p-3">
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
        <div className="rounded-xl border border-orange/30 bg-orange/10 p-3 text-sm text-orange">
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
          disabled={isFinalizing || (canSubmitAnything && !hasSigner)}
        >
          {isFinalizing
            ? "Submitting..."
            : canSubmitAnything
              ? "Finalize ranking & save MMR then go home"
              : "Return Home"}
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
        <h3 className="font-serif text-xl text-gold">Upcoming Games</h3>
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
  showUpcomingGamesStep = false,
  onClose,
  onReturnHome,
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
  const captureRef = useRef<HTMLDivElement | null>(null);
  const [isCopying, setIsCopying] = useState(false);

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
    if (!data) return ["stats", "leaderboard", "finalize"];

    const ordered: ReviewStepId[] = ["stats", "leaderboard"];
    if (data.isParticipant) {
      ordered.push("personal");
    }
    ordered.push("finalize");
    if (showUpcomingGamesStep) {
      ordered.push("next-game");
    }

    return ordered;
  }, [data, showUpcomingGamesStep]);

  const currentStep = steps[Math.min(stepIndex, steps.length - 1)] ?? "stats";
  const currentStepLabel = STEP_LABELS[currentStep];
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
          ) : error || !data ? (
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
              {currentStep === "stats" && (
                <div ref={captureRef} className="mx-auto w-full" style={CARD_PREVIEW_STYLE}>
                  <BlitzGameStatsCardWithSelector worldName={data.worldName} stats={data.stats} player={cardPlayer} />
                </div>
              )}

              {currentStep === "leaderboard" && (
                <div ref={captureRef} className="mx-auto w-full" style={CARD_PREVIEW_STYLE}>
                  <BlitzLeaderboardCardWithSelector
                    worldName={data.worldName}
                    topPlayers={data.topPlayers}
                    player={cardPlayer}
                  />
                </div>
              )}

              {currentStep === "personal" &&
                (data.personalScore ? (
                  <div ref={captureRef} className="mx-auto w-full" style={CARD_PREVIEW_STYLE}>
                    <ScoreCardContent worldName={data.worldName} playerEntry={data.personalScore} showActions={false} />
                  </div>
                ) : (
                  <div className="rounded-xl border border-gold/20 bg-dark/80 p-4 text-sm text-gold/70">
                    No personal score card is available for this account.
                  </div>
                ))}

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

              {currentStep === "next-game" && showUpcomingGamesStep && (
                <UpcomingGamesStep worldName={data.worldName} onRegistrationComplete={onRegistrationComplete} />
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
