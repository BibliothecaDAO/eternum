import { useUIStore } from "@/hooks/store/use-ui-store";
import { LEADERBOARD_UPDATE_INTERVAL } from "@/ui/constants";
import Button from "@/ui/design-system/atoms/button";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { extractTransactionHash, resolveTransactionFromGameStream } from "@/ui/utils/transactions";
import {
  clearUncertainClaimSharePointsSubmission,
  isNoHashSubmissionTimeout,
  rememberUncertainClaimSharePointsSubmission,
} from "@/ui/utils/uncertain-transaction-registry";
import { LeaderboardManager } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ContractAddress } from "@bibliothecadao/types";
import { useEntityQuery } from "@dojoengine/react";
import { getComponentValue, Has } from "@dojoengine/recs";
import Zap from "lucide-react/dist/esm/icons/zap";
import { useEffect, useMemo, useState } from "react";
import { useSocialStore } from "./use-social-store";

interface RegisterPointsButtonProps {
  className?: string;
  /**
   * "bar" → the full-width registered|unregistered summary button.
   * "inline" → a compact button for the player's own leaderboard row; renders
   * only when there are unregistered points to claim.
   */
  variant?: "bar" | "inline";
}

const POINTS_SUMMARY_DEBUG = false;

export const RegisterPointsButton = ({ className, variant = "bar" }: RegisterPointsButtonProps) => {
  const {
    account: { account },
    network,
    setup: {
      components,
      systemCalls: { claim_share_points },
    },
  } = useDojo();

  const [isSharePointsLoading, setIsSharePointsLoading] = useState(false);
  const [, setRefreshTick] = useState(0);
  const setTooltip = useUIStore((state) => state.setTooltip);
  const setPlayersByRank = useSocialStore((state) => state.setPlayersByRank);

  const hyperstructure_entities = useEntityQuery([Has(components.Hyperstructure)]);
  const playerAddress = ContractAddress(account.address);
  const leaderboardManager = LeaderboardManager.instance(components);

  const registeredPoints = leaderboardManager.getPlayerRegisteredPoints(playerAddress);
  const unregisteredShareholderPoints =
    leaderboardManager.getPlayerHyperstructureUnregisteredShareholderPoints(playerAddress);

  const hyperstructuresEntityIds = useMemo(() => {
    return hyperstructure_entities
      .map((entity) => getComponentValue(components.Hyperstructure, entity))
      .filter((hyperstructure) => hyperstructure?.completed)
      .map((hyperstructure) => hyperstructure?.hyperstructure_id)
      .filter((id) => id !== undefined);
  }, [components.Hyperstructure, hyperstructure_entities]);

  const hasUnregisteredPoints = unregisteredShareholderPoints > 0;
  const totalPoints = registeredPoints + unregisteredShareholderPoints;

  const logPointsSummary = (...args: unknown[]) => {
    if (!POINTS_SUMMARY_DEBUG) return;
    console.log("[PointsSummary]", ...args);
  };

  useEffect(() => {
    logPointsSummary("mounted", { playerAddress });
    return () => {
      logPointsSummary("unmounted", { playerAddress });
    };
  }, [playerAddress]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setRefreshTick((previous) => previous + 1);
      logPointsSummary("refresh tick", {
        registeredPoints,
        unregisteredShareholderPoints,
        totalPoints,
      });
    }, LEADERBOARD_UPDATE_INTERVAL);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [registeredPoints, totalPoints, unregisteredShareholderPoints]);

  useEffect(() => {
    logPointsSummary("computed values", {
      registeredPoints,
      unregisteredShareholderPoints,
      totalPoints,
      hasUnregisteredPoints,
      isSharePointsLoading,
    });
  }, [registeredPoints, unregisteredShareholderPoints, totalPoints, hasUnregisteredPoints, isSharePointsLoading]);

  const claimSharePoints = async () => {
    if (!hasUnregisteredPoints) return;

    setIsSharePointsLoading(true);
    let txHash: string | null = null;
    try {
      const claimedPointsAtSubmit = leaderboardManager.getPlayerHyperstructureUnregisteredShareholderPoints(
        playerAddress,
        { ignorePendingClaimOverride: true },
      );
      const transactionResult = await claim_share_points({
        signer: account,
        hyperstructure_ids: hyperstructuresEntityIds,
      });
      txHash = extractTransactionHash(transactionResult);
      logPointsSummary("claim submitted", {
        txHash,
        claimedPointsAtSubmit,
      });

      if (claimedPointsAtSubmit > 0) {
        leaderboardManager.setPendingSharePointsClaim(playerAddress, claimedPointsAtSubmit, txHash ?? undefined);
      }
      leaderboardManager.updatePoints();
      setPlayersByRank(leaderboardManager.playersByRank);
      logPointsSummary("pending override applied");

      if (txHash) {
        await resolveTransactionFromGameStream({
          txHash,
          label: "register points",
        });
      }

      leaderboardManager.confirmPendingSharePointsClaim(playerAddress, txHash ?? undefined);
      clearUncertainClaimSharePointsSubmission(playerAddress);
      leaderboardManager.forceRefresh();
      leaderboardManager.updatePoints();

      setPlayersByRank(leaderboardManager.playersByRank);
      logPointsSummary("claim confirmed and refreshed", { txHash });
    } catch (error) {
      if (isNoHashSubmissionTimeout(error)) {
        rememberUncertainClaimSharePointsSubmission({
          walletAddress: playerAddress,
          failureKind: "submission_timeout_no_hash",
        });
      }
      leaderboardManager.clearPendingSharePointsClaim(playerAddress, txHash ?? undefined);
      leaderboardManager.updatePoints();
      setPlayersByRank(leaderboardManager.playersByRank);
      logPointsSummary("claim failed or confirmation failed", { txHash, error });
      console.error(error);
    } finally {
      setIsSharePointsLoading(false);
    }
  };

  if (variant === "inline") {
    // Compact square icon button on the player's own row — disabled (but still
    // legible) when there's nothing to claim, pulsing gold when there is.
    return (
      <button
        type="button"
        disabled={!hasUnregisteredPoints || isSharePointsLoading}
        onClick={claimSharePoints}
        aria-label="Register points"
        className={cn(
          "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition",
          hasUnregisteredPoints
            ? "animate-pulse border-gold/60 bg-gold/20 text-gold hover:bg-gold/30"
            : "cursor-not-allowed border-gold/20 bg-black/30 text-gold/40",
          className,
        )}
        onMouseOver={() => {
          setTooltip({
            position: "top",
            content: (
              <div className="flex flex-col whitespace-nowrap pointer-events-none text-center">
                <span className="font-bold text-gold mb-1">Register Points</span>
                <span className="flex justify-between gap-4">
                  <span>Unregistered:</span>
                  <span className={unregisteredShareholderPoints > 0 ? "text-yellow-400" : ""}>
                    {unregisteredShareholderPoints.toLocaleString()}
                  </span>
                </span>
                <span className="text-xs mt-1">
                  {hasUnregisteredPoints ? "Click to register" : "No points to register"}
                </span>
              </div>
            ),
          });
        }}
        onMouseOut={() => setTooltip(null)}
      >
        {isSharePointsLoading ? (
          <span className="h-3 w-3 animate-spin rounded-full border-b border-t border-gold" />
        ) : (
          <Zap className="h-3.5 w-3.5" />
        )}
      </button>
    );
  }

  return (
    <Button
      variant={hasUnregisteredPoints ? "primary" : "outline"}
      isLoading={isSharePointsLoading}
      disabled={!hasUnregisteredPoints}
      className={`${className} ${!hasUnregisteredPoints ? "opacity-75" : ""}`}
      onMouseOver={() => {
        setTooltip({
          position: "bottom",
          content: (
            <div className="flex flex-col whitespace-nowrap pointer-events-none text-center">
              <span className="font-bold text-gold mb-1">Points Summary</span>
              <span className="flex justify-between gap-4">
                <span>Registered:</span>
                <span className="text-green-400">{registeredPoints.toLocaleString()}</span>
              </span>
              <span className="flex justify-between gap-4">
                <span>Unregistered:</span>
                <span className={unregisteredShareholderPoints > 0 ? "text-yellow-400" : ""}>
                  {unregisteredShareholderPoints.toLocaleString()}
                </span>
              </span>
              <div className="border-t border-gray-600 mt-1 pt-1">
                <span className="flex justify-between gap-4 font-semibold">
                  <span>Total:</span>
                  <span className="text-gold">{totalPoints.toLocaleString()}</span>
                </span>
              </div>
              {!hasUnregisteredPoints && <span className=" text-xs mt-1">No points to register</span>}
              {hasUnregisteredPoints && (
                <span className="text-yellow-400 text-xs mt-1">Click to register unregistered points</span>
              )}
            </div>
          ),
        });
      }}
      onMouseOut={() => {
        setTooltip(null);
      }}
      onClick={claimSharePoints}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm">
          <span className="text-green-400">{registeredPoints.toLocaleString()}</span>
          <span className=" mx-1">|</span>
          <span className={unregisteredShareholderPoints > 0 ? "text-yellow-400" : ""}>
            {unregisteredShareholderPoints.toLocaleString()}
          </span>
        </span>
        {hasUnregisteredPoints && <span className="text-yellow-400 text-sm animate-pulse">Register</span>}
        {!hasUnregisteredPoints && <span className=" text-sm">Points</span>}
      </div>
    </Button>
  );
};
