import { useAccountStore } from "@/hooks/store/use-account-store";
import { resolveEffectiveRegistrationCountMax } from "@/hooks/registration-capacity";
import { summaryToWorldConfigMeta } from "@/hooks/summary-to-world-config-meta";
import { usePlayerWorldRegistrations, getWorldSummaryKey } from "@/hooks/use-player-world-registrations";
import { type WorldConfigMeta } from "@/hooks/use-world-availability";
import { useWorldsSummary } from "@/hooks/use-worlds-summary";
import { useWorldRegistration, type EntryStage } from "@/hooks/use-world-registration";
import { PLAYER_WORLD_REGISTRATION_QUERY_KEY, WORLD_AVAILABILITY_QUERY_KEY } from "@/hooks/world-list-queries";
import type { WorldSummary } from "@bibliothecadao/types";
import type { WorldSelectionInput } from "@/runtime/world";
import { fetchGameReviewClaimSummary, type GameReviewClaimSummary } from "@/services/review/game-review-service";
import { WorldCountdownDetailed, useGameTimeStatus } from "@/ui/components/world-countdown";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { useLandingNetworkState } from "../../hooks/use-landing-network-state";
import type { LandingNetworkChain } from "../../lib/landing-network-state";
import { getChainLabel } from "@/ui/utils/network-switch";
import type { GameChain as Chain } from "@realms-world/chain";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Eye, Loader2, LogIn, Play, RefreshCw, Sparkles, Trophy, UserPlus, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const toPaddedFeltAddress = (address: string): string => `0x${BigInt(address).toString(16).padStart(64, "0")}`;

const formatLordsDisplayMaxTwoDecimals = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "0";

  const normalized = trimmed.replace(/,/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    return trimmed;
  }

  const sign = normalized.startsWith("-") ? "-" : "";
  const unsigned = sign ? normalized.slice(1) : normalized;

  const [wholePart, decimalPart = ""] = unsigned.split(".");
  const wholeFormatted = `${sign}${wholePart.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
  if (decimalPart.length === 0) return wholeFormatted;

  const limitedDecimals = decimalPart.slice(0, 2).replace(/0+$/, "");
  return limitedDecimals.length > 0 ? `${wholeFormatted}.${limitedDecimals}` : wholeFormatted;
};

const formatClaimableRewardsText = (claimSummary: GameReviewClaimSummary): string => {
  const lordsAmount = formatLordsDisplayMaxTwoDecimals(claimSummary.lordsWonFormatted);
  if (claimSummary.chestsClaimedEstimate <= 0) {
    return `Claimable: ${lordsAmount} LORDS`;
  }

  return `Claimable: ${lordsAmount} LORDS + ${claimSummary.chestsClaimedEstimate.toLocaleString()} chests`;
};

const getErrorMessage = (error: unknown): string | null => {
  if (error instanceof Error && error.message) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return null;
};

/**
 * Get stage label for world entry progress.
 */
const getStageLabel = (stage: EntryStage): string => {
  switch (stage) {
    case "preparing":
      return "Preparing...";
    case "settling":
      return "Settling...";
    case "done":
      return "Settled!";
    case "error":
      return "Failed";
    default:
      return "Settle";
  }
};

/**
 * Game type badge - Ranked (MMR enabled) or Sandbox
 */
const GameTypeBadge = ({ mmrEnabled }: { mmrEnabled: boolean }) => {
  if (mmrEnabled) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[8px] font-bold text-orange border border-orange/40 bg-orange/15 px-1 py-0.5 rounded">
        <Trophy className="w-2.5 h-2.5" />
        Ranked
      </span>
    );
  }
  return <span className="text-[8px] text-gold/50 border border-gold/20 bg-gold/5 px-1 py-0.5 rounded">Sandbox</span>;
};

/**
 * Chain badge - shows which network the game is on
 */
const ChainBadge = ({ chain }: { chain: Chain }) => {
  const chainStyles: Record<Chain, string> = {
    madara: "text-white/70 bg-white/10 border border-white/20",
    appchain: "text-orange/70 bg-orange/10 border border-orange/20",
  };

  return (
    <span className={cn("text-[8px] font-medium px-1 py-0.5 rounded", chainStyles[chain])}>{getChainLabel(chain)}</span>
  );
};

export type WorldSelection = WorldSelectionInput;

type GameStatus = "ongoing" | "upcoming" | "ended" | "unknown";

const isUpcomingOnlyStatusFilter = (statusFilter: GameStatus | GameStatus[] | undefined): boolean => {
  if (Array.isArray(statusFilter)) return statusFilter.length === 1 && statusFilter[0] === "upcoming";
  return statusFilter === "upcoming";
};

const isLiveSummaryForLandingChain = (summary: WorldSummary, selectedChain: LandingNetworkChain): boolean =>
  summary.alive && summary.chain === selectedChain;

export interface GameData {
  name: string;
  chain: Chain;
  worldAddress: string | null;
  worldKey: string;
  status: "checking" | "ok" | "fail";
  gameStatus: GameStatus;
  startMainAt: number | null;
  endAt: number | null;
  registrationCount: number | null;
  isRegistered: boolean | null;
  config: WorldConfigMeta | null;
}

const buildGameResolutionSignature = (game: GameData): string => {
  const registrationValue = game.isRegistered === null ? "null" : game.isRegistered ? "1" : "0";
  const config = game.config;

  return [
    game.worldKey,
    game.worldAddress ?? "",
    game.status,
    game.gameStatus,
    game.startMainAt ?? "",
    game.endAt ?? "",
    game.registrationCount ?? "",
    registrationValue,
    config?.devModeOn ? "1" : "0",
    config?.mmrEnabled ? "1" : "0",
    config?.registrationCountMax ?? "",
    config?.twoPlayerMode ? "1" : "0",
    config?.winnerJackpotAmount?.toString() ?? "",
  ].join(":");
};

const EmptyGameGridState = ({ showCreateGameCta }: { showCreateGameCta: boolean }) => {
  if (!showCreateGameCta) {
    return (
      <div className="flex flex-col items-center justify-center h-[60px] text-center">
        <p className="text-[10px] text-white/40">No games available</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 h-3 w-3 rotate-45 border border-amber-300/30 bg-amber-300/5" />
      <p className="mb-3 text-[10px] uppercase tracking-[0.3em] text-white/45">No upcoming candidates.</p>
      <p className="max-w-[240px] text-[11px] uppercase leading-6 tracking-[0.28em] text-white/70">
        Forge a new game or wait for the next seeded batch.
      </p>
      <Link
        to="/factory"
        className={cn(
          "mt-6 inline-flex h-10 items-center justify-center gap-2 border border-amber-300/25 px-4",
          "bg-black/20 text-[11px] uppercase tracking-[0.2em] text-amber-100/80 transition-all",
          "hover:border-amber-300/45 hover:bg-amber-300/10 hover:text-amber-100",
        )}
      >
        <Sparkles className="h-3.5 w-3.5" />
        Forge New Game
      </Link>
    </div>
  );
};

interface GameCardProps {
  game: GameData;
  onPlay: () => void;
  onSettle?: () => void;
  onSpectate: () => void;
  onSeeScore?: () => void;
  onClaimRewards?: () => void;
  claimSummary?: GameReviewClaimSummary | null;
  onRegistrationComplete?: (game: GameData) => void;
  playerAddress: string | null;
  showChainBadge?: boolean;
}

/**
 * Single game card component with inline registration
 */
const GameCard = ({
  game,
  onPlay,
  onSettle,
  onSpectate,
  onSeeScore,
  onClaimRewards,
  claimSummary,
  onRegistrationComplete,
  playerAddress,
  showChainBadge = false,
}: GameCardProps) => {
  const isOngoing = game.gameStatus === "ongoing";
  const isUpcoming = game.gameStatus === "upcoming";
  const isEnded = game.gameStatus === "ended";
  const isEternumMode = game.config?.mode === "eternum";
  const isBlitzMode = game.config?.mode === "blitz";
  const isUnknownMode = game.config?.mode === "unknown" || !game.config?.mode;
  const hasSettledEternumRealm = isEternumMode && game.config?.hasPlayerSettledRealm === true;
  const devModeOn = game.config?.devModeOn ?? false;
  const canOpenEternumEntry = isEternumMode && !isEnded;
  const canPlayEternumDirect = canOpenEternumEntry && hasSettledEternumRealm;
  const showEternumSettleShortcut = canOpenEternumEntry && hasSettledEternumRealm;
  const eternumPrimaryActionLabel = canPlayEternumDirect ? "Play" : "Settle";
  // Can register during upcoming, or during ongoing if dev mode is on
  const canRegisterPeriod = isBlitzMode && (isUpcoming || (isOngoing && devModeOn));
  const canSpectatePreMainBlitz = isBlitzMode && canRegisterPeriod;
  // Spectate is always available for live and ended games, and also for
  // Blitz worlds during the pre-main registration window.
  const canSpectate = isOngoing || isEnded || canSpectatePreMainBlitz;
  const handledSettlementStageRef = useRef(false);

  // Inline world-entry hook.
  const { settle, entryStage, isSettling, error, canSettle, isRegistrationFull } = useWorldRegistration({
    worldName: game.name,
    chain: game.chain,
    config: game.config,
    isRegistered: game.isRegistered === true,
    enabled: isBlitzMode && game.status === "ok" && canRegisterPeriod,
  });
  const showRegistered = game.isRegistered || entryStage === "done";
  const canEnterRegisteredBlitz = isBlitzMode && showRegistered && (isUpcoming || isOngoing);
  const canPlay = !isUnknownMode && (canEnterRegisteredBlitz || canOpenEternumEntry);

  // Handle settle entry with toast notification.
  const handleSettle = useCallback(() => {
    void settle().catch((err) => {
      console.error("Settlement failed:", err);
    });
  }, [settle]);

  // Show success toast when settlement completes.
  useEffect(() => {
    if (entryStage !== "done") {
      handledSettlementStageRef.current = false;
      return;
    }

    if (handledSettlementStageRef.current) return;
    handledSettlementStageRef.current = true;

    toast.success("Settlement successful!", {
      description: `You are now settled in ${game.name}.`,
    });
    onRegistrationComplete?.(game);
  }, [entryStage, game, onRegistrationComplete]);

  // Status colors - enhanced yellow for upcoming
  const statusColors = {
    ongoing: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/50",
    upcoming: "from-amber-500/30 to-yellow-600/15 border-amber-400/60",
    ended: "from-gray-500/20 to-gray-600/10 border-gray-500/30",
    unknown: "from-gray-500/20 to-gray-600/10 border-gray-500/30",
  };

  const statusBadgeColors = {
    ongoing: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50",
    upcoming: "bg-amber-500/30 text-amber-200 border-amber-400/60",
    ended: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    unknown: "bg-gray-500/20 text-gray-500 border-gray-500/30",
  };

  const canClaimRewards = isEnded && showRegistered && Boolean(claimSummary?.canClaimNow) && Boolean(onClaimRewards);
  const registrationCount = game.registrationCount ?? 0;
  const registrationCountMax = resolveEffectiveRegistrationCountMax(game.config);
  const registrationLabel =
    registrationCountMax !== null
      ? `${registrationCount}/${registrationCountMax} players`
      : `${registrationCount} players`;
  const settledPlayersCount = game.config?.settledPlayersCount ?? 0;
  const settledRealmsCount = game.config?.settledRealmsCount ?? 0;
  const settledVillagesCount = game.config?.settledVillagesCount ?? 0;
  const eternumPlayersLabel = `${settledPlayersCount} settled players`;
  const eternumSettlementLabel = `${settledRealmsCount} realms · ${settledVillagesCount} villages`;
  const playersLabel = isUnknownMode
    ? "Detecting game mode..."
    : isEternumMode
      ? eternumPlayersLabel
      : registrationLabel;

  return (
    <div
      className={cn(
        "relative group rounded-lg border bg-gradient-to-b backdrop-blur-sm",
        "transition-all duration-200 hover:brightness-110 hover:shadow-lg",
        statusColors[game.gameStatus],
        isOngoing && "shadow-emerald-500/10",
        isUpcoming && "shadow-amber-500/15",
      )}
    >
      {/* Registered indicator - subtle green top banner */}
      {showRegistered && (
        <div className="absolute -top-px left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent rounded-b-full" />
      )}

      <div className="p-3 space-y-2">
        {/* Header: Name + Badges */}
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-white text-sm truncate flex-1" title={game.name}>
            {game.name}
          </h3>
          <div className="flex items-center gap-1">
            {showChainBadge && <ChainBadge chain={game.chain} />}
            {game.config && <GameTypeBadge mmrEnabled={game.config.mmrEnabled} />}
            <span
              className={cn(
                "flex-shrink-0 text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-full border",
                statusBadgeColors[game.gameStatus],
              )}
            >
              {isOngoing ? "Live" : isUpcoming ? "Soon" : isEnded ? "Ended" : "..."}
            </span>
          </div>
        </div>

        {/* Stats row with entry indicator */}
        <div className="flex items-center justify-between text-xs text-white/60">
          <div className="flex items-center gap-1 min-w-0">
            <Users className="w-3 h-3" />
            <span className="truncate" title={playersLabel}>
              {playersLabel}
            </span>
            {isEternumMode && (
              <span className="truncate text-white/45" title={eternumSettlementLabel}>
                · {eternumSettlementLabel}
              </span>
            )}
          </div>
          {showRegistered && (
            <div className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-3 h-3" />
              <span className="font-medium">Settled</span>
            </div>
          )}
        </div>

        {/* Countdown - compact */}
        <div className="py-1.5 px-2 bg-black/20 rounded text-xs">
          <WorldCountdownDetailed
            startMainAt={game.startMainAt}
            endAt={game.endAt}
            status={game.status}
            className="text-xs text-white/70"
          />
        </div>

        {canClaimRewards && claimSummary && (
          <div className="rounded border border-gold/25 bg-gold/10 px-2 py-1.5 text-[10px] text-gold">
            {formatClaimableRewardsText(claimSummary)}
          </div>
        )}

        {/* Action buttons - compact: [Play/Settle] [Spectate] layout */}
        <div className="flex gap-1.5">
          {/* Left slot: Play OR Settle (share same space) - hidden for ended games without entry */}
          {isEnded && !showRegistered ? null : canPlay ? (
            <button
              onClick={() => {
                if (canOpenEternumEntry) {
                  if (canPlayEternumDirect) {
                    onPlay();
                  } else if (onSettle) {
                    onSettle();
                  } else {
                    onPlay();
                  }
                } else {
                  onPlay();
                }
              }}
              className={cn(
                "flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-semibold",
                canOpenEternumEntry
                  ? canPlayEternumDirect
                    ? "bg-emerald-500 text-white hover:bg-emerald-400 transition-colors"
                    : "bg-amber-500 text-white hover:bg-amber-400 transition-colors"
                  : "bg-emerald-500 text-white hover:bg-emerald-400 transition-colors",
              )}
            >
              {canEnterRegisteredBlitz ? <LogIn className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              {canEnterRegisteredBlitz ? "Enter" : canOpenEternumEntry ? eternumPrimaryActionLabel : "Play"}
            </button>
          ) : isUnknownMode ? (
            <div className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-medium bg-white/5 text-white/40 border border-white/10">
              Detecting mode...
            </div>
          ) : isBlitzMode && game.isRegistered === null && playerAddress ? (
            // Loading state while checking registration status
            <div className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-medium bg-white/5 text-white/40 border border-white/10">
              <Loader2 className="w-3 h-3 animate-spin" />
            </div>
          ) : isBlitzMode && game.isRegistered === false && canRegisterPeriod && playerAddress ? (
            <>
              {isSettling ? (
                <div className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-medium bg-gold/10 text-gold border border-gold/30">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {getStageLabel(entryStage)}
                </div>
              ) : entryStage === "error" ? (
                <button
                  onClick={handleSettle}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors"
                >
                  Retry
                </button>
              ) : canSettle ? (
                <button
                  onClick={handleSettle}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-semibold",
                    "bg-brilliance/20 text-brilliance border border-brilliance/30 hover:bg-brilliance/30 transition-colors",
                  )}
                >
                  <UserPlus className="w-3 h-3" />
                  Settle
                </button>
              ) : isRegistrationFull ? (
                <div className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-medium bg-white/5 text-white/40 border border-white/10">
                  Registration full
                </div>
              ) : null}
            </>
          ) : isBlitzMode && !playerAddress && !showRegistered && canRegisterPeriod ? (
            <div className="flex-1 text-center text-[10px] text-white/40 py-1">Connect wallet</div>
          ) : null}

          {showEternumSettleShortcut && (
            <button
              onClick={onSettle ?? onPlay}
              className={cn(
                "flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-semibold",
                "bg-amber-500/20 text-amber-200 border border-amber-500/40 hover:bg-amber-500/30 transition-colors",
              )}
            >
              <Play className="w-3 h-3" />
              Settle
            </button>
          )}

          {/* See Score button for ended games where player participated */}
          {isEnded && showRegistered && onSeeScore && (
            <button
              onClick={onSeeScore}
              className={cn(
                "flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-semibold",
                "bg-gold/20 text-gold border border-gold/30 hover:bg-gold/30 transition-colors",
              )}
            >
              <Trophy className="w-3 h-3" />
              Review
            </button>
          )}

          {canClaimRewards && onClaimRewards && (
            <button
              onClick={onClaimRewards}
              className={cn(
                "flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-semibold",
                "bg-brilliance/20 text-brilliance border border-brilliance/30 hover:bg-brilliance/30 transition-colors",
              )}
            >
              <Trophy className="w-3 h-3" />
              Claim Rewards
            </button>
          )}

          {/* Right slot: Spectate (always in same position) */}
          {canSpectate && (
            <button
              onClick={onSpectate}
              className={cn(
                "flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-medium",
                "bg-white/10 text-white hover:bg-white/20 transition-colors border border-white/10",
              )}
            >
              <Eye className="w-3 h-3" />
              Spectate
            </button>
          )}
        </div>

        {/* Error message - only show if not already registered */}
        {entryStage === "error" && error && !showRegistered && (
          <div className="text-[10px] text-red-400 text-center truncate" title={error}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

interface UnifiedGameGridProps {
  onPlayGame?: (selection: WorldSelection) => void;
  onSelectGame: (selection: WorldSelection) => void;
  onAutoSettleGame?: (selection: WorldSelection) => void;
  onSpectate: (selection: WorldSelection) => void;
  onSeeScore?: (selection: WorldSelection) => void;
  onClaimRewards?: (selection: WorldSelection) => void;
  onRegistrationComplete?: () => void;
  className?: string;
  /** Filter games by mode */
  modeFilter?: "blitz" | "eternum";
  /** Filter games by dev mode: true = only dev mode, false = only production, undefined = all */
  devModeFilter?: boolean;
  /** Custom title for the grid */
  title?: string;
  /** Filter games by status */
  statusFilter?: GameStatus | GameStatus[];
  /** Hide the header (title, count, legend, refresh) */
  hideHeader?: boolean;
  /** Hide the legend */
  hideLegend?: boolean;
  /** Layout direction: horizontal (scroll right) or vertical (scroll down) */
  layout?: "horizontal" | "vertical";
  /** Sort games where user is registered first */
  sortRegisteredFirst?: boolean;
  /** Sort ended games with claimable rewards first */
  sortClaimableRewardsFirst?: boolean;
  /** Sort ended games by most recently ended first */
  sortEndedNewestFirst?: boolean;
  /** Filter by user registration status. "registered" keeps only games where
   *  isRegistered === true; "unregistered" keeps everything else (including
   *  null while lookups are pending, so discovery surfaces aren't suppressed). */
  registeredFilter?: "registered" | "unregistered";
  /** Optional callback to expose the resolved list (for reuse without extra queries) */
  onGamesResolved?: (games: GameData[]) => void;
}

/**
 * Unified game grid - combines games from every supported chain into a single view
 */
export const UnifiedGameGrid = ({
  onPlayGame,
  onSelectGame,
  onSpectate,
  onSeeScore,
  onClaimRewards,
  onRegistrationComplete,
  className,
  modeFilter,
  devModeFilter,
  title = "Games",
  statusFilter,
  hideHeader = false,
  hideLegend = false,
  layout = "horizontal",
  sortRegisteredFirst = false,
  sortClaimableRewardsFirst = false,
  sortEndedNewestFirst = false,
  registeredFilter,
  onGamesResolved,
}: UnifiedGameGridProps) => {
  const queryClient = useQueryClient();
  const account = useAccountStore((state) => state.account);
  const playerAddress = account?.address && account.address !== "0x0" ? account.address : null;
  const playerFeltLiteral = playerAddress ? toPaddedFeltAddress(playerAddress) : null;
  const landingNetworkState = useLandingNetworkState();
  const selectedLandingChain = landingNetworkState.preferredChain;

  const { isOngoing, isEnded, isUpcoming } = useGameTimeStatus();

  // Single bulk summary fetch for all worlds (replaces per-world fan-out).
  // The server serves timing, mode, counters, and prize addresses in one call.
  const {
    data: worldsSummaryData,
    isPending: summaryIsLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useWorldsSummary();

  // Only show live worlds for the chain selected in the landing network switch.
  // Dead (alive=false) worlds are excluded from the card grid — they surface separately via the modal.
  const liveSummaries = useMemo<WorldSummary[]>(
    () => (worldsSummaryData ?? []).filter((summary) => isLiveSummaryForLandingChain(summary, selectedLandingChain)),
    [selectedLandingChain, worldsSummaryData],
  );

  // Player-scoped fields (registration, settled realm) layered on top of the
  // bulk summary. Only fires when a wallet is connected — anonymous boot = 0 calls.
  const { registrationsByWorldKey, isAnyLoading: playerRegistrationsLoading } = usePlayerWorldRegistrations({
    worlds: liveSummaries,
    playerAddress: playerFeltLiteral,
  });

  // Build game data from the bulk summary + player registration overlay.
  const games = useMemo<GameData[]>(() => {
    const nodes = liveSummaries
      .map((summary): GameData => {
        const worldKey = getWorldSummaryKey(summary);
        const startMainAt = summary.startMainAt ?? null;
        const endAt = summary.endAt ?? null;

        // alive worlds are "ok" by definition — the summary is the bulk availability.
        const status: "checking" | "ok" | "fail" = "ok";

        let gameStatus: GameStatus = "unknown";
        if (isEnded(startMainAt, endAt)) gameStatus = "ended";
        else if (isOngoing(startMainAt, endAt)) gameStatus = "ongoing";
        else if (isUpcoming(startMainAt)) gameStatus = "upcoming";

        const registration = registrationsByWorldKey.get(worldKey) ?? null;
        const config: WorldConfigMeta = summaryToWorldConfigMeta(summary, registration);

        const isRegistered = config.isPlayerRegistered ?? config.hasPlayerSettledRealm ?? null;

        return {
          name: summary.name,
          chain: summary.chain,
          worldAddress: summary.worldAddress ?? null,
          worldKey,
          status,
          gameStatus,
          startMainAt,
          endAt,
          registrationCount: summary.registrationCount ?? null,
          isRegistered,
          config,
        };
      })
      // Filter by dev mode if specified — but never hide a game the player is
      // in: with devModeFilter=false the Played column would otherwise drop
      // every ended dev game along with its Review/Claim entry points.
      .filter((game) => {
        if (devModeFilter === undefined) return true;
        if (devModeFilter === false && game.isRegistered === true) return true;
        const gameDevMode = game.config?.devModeOn ?? false;
        return devModeFilter === gameDevMode;
      })
      // Filter by game status if specified
      .filter((game) => {
        if (!statusFilter) return true;
        const statuses = Array.isArray(statusFilter) ? statusFilter : [statusFilter];
        return statuses.includes(game.gameStatus);
      })
      // Filter by mode if specified
      .filter((game) => {
        if (!modeFilter) return true;
        return game.config?.mode === modeFilter;
      })
      // Filter by user registration status if specified
      .filter((game) => {
        if (!registeredFilter) return true;
        if (registeredFilter === "registered") return game.isRegistered === true;
        return game.isRegistered !== true;
      });

    // Sort: optionally registered first, then by status, then by start time
    return nodes.toSorted((a, b) => {
      // If sortRegisteredFirst is enabled, registered games come first
      if (sortRegisteredFirst) {
        const aRegistered = a.isRegistered ? 1 : 0;
        const bRegistered = b.isRegistered ? 1 : 0;
        if (aRegistered !== bRegistered) return bRegistered - aRegistered; // registered first
      }

      // Then sort by status: live first, then upcoming, then ended
      const order: Record<GameStatus, number> = { ongoing: 0, upcoming: 1, ended: 2, unknown: 3 };
      const statusDiff = order[a.gameStatus] - order[b.gameStatus];
      if (statusDiff !== 0) return statusDiff;

      // Within same status, sort by start time ascending
      const aStart = a.startMainAt ?? Infinity;
      const bStart = b.startMainAt ?? Infinity;
      return aStart - bStart;
    });
  }, [
    liveSummaries,
    registrationsByWorldKey,
    isOngoing,
    isEnded,
    isUpcoming,
    modeFilter,
    devModeFilter,
    statusFilter,
    sortRegisteredFirst,
    registeredFilter,
  ]);

  const endedRegisteredGames = useMemo(
    () => games.filter((game) => game.gameStatus === "ended" && game.isRegistered === true),
    [games],
  );

  const claimSummaryQueries = useQueries({
    queries:
      !playerAddress || endedRegisteredGames.length === 0
        ? []
        : endedRegisteredGames.map((game) => ({
            queryKey: ["gameReviewClaimSummary", game.chain, game.name, playerAddress],
            queryFn: () =>
              fetchGameReviewClaimSummary({
                worldName: game.name,
                chain: game.chain,
                playerAddress,
              }),
            staleTime: 60_000,
            gcTime: 10 * 60_000,
            retry: 1,
          })),
  });

  const claimSummaryByWorldKey = useMemo(() => {
    const summaryByWorldKey = new Map<
      string,
      {
        data: GameReviewClaimSummary | null;
        isLoading: boolean;
        error: string | null;
      }
    >();

    endedRegisteredGames.forEach((game, index) => {
      const queryState = claimSummaryQueries[index];
      if (!queryState) return;

      summaryByWorldKey.set(game.worldKey, {
        data: queryState.data ?? null,
        isLoading: queryState.isLoading,
        error: getErrorMessage(queryState.error),
      });
    });

    return summaryByWorldKey;
  }, [claimSummaryQueries, endedRegisteredGames]);

  const resolvedGames = useMemo(() => {
    if (!sortClaimableRewardsFirst && !sortEndedNewestFirst) return games;

    return games.toSorted((a, b) => {
      const aIsEnded = a.gameStatus === "ended";
      const bIsEnded = b.gameStatus === "ended";
      if (!aIsEnded || !bIsEnded) return 0;

      if (sortClaimableRewardsFirst) {
        const aCanClaimNow = claimSummaryByWorldKey.get(a.worldKey)?.data?.canClaimNow === true;
        const bCanClaimNow = claimSummaryByWorldKey.get(b.worldKey)?.data?.canClaimNow === true;
        if (aCanClaimNow !== bCanClaimNow) return aCanClaimNow ? -1 : 1;
      }

      if (sortRegisteredFirst) {
        const aRegistered = a.isRegistered ? 1 : 0;
        const bRegistered = b.isRegistered ? 1 : 0;
        if (aRegistered !== bRegistered) return bRegistered - aRegistered;
      }

      if (sortEndedNewestFirst) {
        const aEndAt = a.endAt ?? 0;
        const bEndAt = b.endAt ?? 0;
        if (aEndAt !== bEndAt) return bEndAt - aEndAt;

        const aStartAt = a.startMainAt ?? 0;
        const bStartAt = b.startMainAt ?? 0;
        if (aStartAt !== bStartAt) return bStartAt - aStartAt;
      }

      return 0;
    });
  }, [claimSummaryByWorldKey, games, sortClaimableRewardsFirst, sortEndedNewestFirst, sortRegisteredFirst]);

  const handleRefresh = useCallback(async () => {
    await refetchSummary();
  }, [refetchSummary]);

  // When a registration completes, write the optimistic result into the SHARED
  // registration cache so every grid instance (Open Games, the Active bar)
  // moves the card atomically — per-grid state made the card vanish from one
  // list before the other could pick it up. The 30s refetch interval confirms
  // against torii once the settlement row is indexed; the availability cache is
  // invalidated for the modal path. Deliberately NOT invalidating the
  // registration query here: an instant refetch could race torii indexing and
  // clobber the optimistic value with a stale "unregistered".
  const handleRegistrationComplete = useCallback(
    (game: GameData) => {
      queryClient.setQueriesData(
        { queryKey: [...PLAYER_WORLD_REGISTRATION_QUERY_KEY, game.worldKey] },
        (previous: { isPlayerRegistered: boolean | null; hasPlayerSettledRealm: boolean | null } | undefined) => ({
          isPlayerRegistered: true,
          hasPlayerSettledRealm: previous?.hasPlayerSettledRealm ?? null,
        }),
      );
      // The availability cache (entry-modal path) keys by chain:name, not by
      // the (worldId, gameId) summary key.
      queryClient.invalidateQueries({ queryKey: [...WORLD_AVAILABILITY_QUERY_KEY, `${game.chain}:${game.name}`] });

      onRegistrationComplete?.();
    },
    [onRegistrationComplete, queryClient],
  );

  const factoryError = summaryError as Error | null;
  const isLoading = summaryIsLoading || playerRegistrationsLoading;
  const shouldShowCreateGameCta = isUpcomingOnlyStatusFilter(statusFilter);

  // Count by status
  const counts = useMemo(() => {
    return {
      ongoing: games.filter((g) => g.gameStatus === "ongoing").length,
      upcoming: games.filter((g) => g.gameStatus === "upcoming").length,
      ended: games.filter((g) => g.gameStatus === "ended").length,
    };
  }, [games]);

  const resolvedGamesSignature = useMemo(
    () => resolvedGames.map((game) => buildGameResolutionSignature(game)).join("|"),
    [resolvedGames],
  );
  const lastResolvedGamesSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (!onGamesResolved) return;
    if (lastResolvedGamesSignatureRef.current === resolvedGamesSignature) return;

    lastResolvedGamesSignatureRef.current = resolvedGamesSignature;
    onGamesResolved(resolvedGames);
  }, [onGamesResolved, resolvedGames, resolvedGamesSignature]);
  return (
    <div className={cn("relative", className)}>
      {/* Header */}
      {!hideHeader && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold uppercase tracking-wider text-gold">{title}</h3>
            <span className="text-xs text-white/40">
              {games.length} game{games.length !== 1 ? "s" : ""}
            </span>
          </div>
          <button
            onClick={() => void handleRefresh()}
            disabled={isLoading}
            className="p-1.5 rounded-md bg-white/5 text-white/70 border border-white/10 hover:bg-white/10 transition-all disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          </button>
        </div>
      )}

      {/* Legend - compact */}
      {!hideLegend && (
        <div className="flex items-center gap-3 mb-3 text-[10px]">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-white/50">Live ({counts.ongoing})</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-white/50">Soon ({counts.upcoming})</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-gray-500" />
            <span className="text-white/50">Ended ({counts.ended})</span>
          </div>
        </div>
      )}

      {/* Game cards */}
      <div
        className={cn(
          layout === "horizontal" &&
            "overflow-x-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent",
        )}
      >
        {isLoading && games.length === 0 ? (
          <div className="flex items-center justify-center h-[120px]">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 text-white/30 animate-spin" />
              <span className="text-xs text-white/40">Checking games...</span>
            </div>
          </div>
        ) : factoryError ? (
          <div className="flex flex-col items-center justify-center h-[120px] text-center">
            <p className="text-xs text-red-400">Failed to load games</p>
            <button
              onClick={() => void handleRefresh()}
              className="mt-2 px-2 py-1 text-[10px] rounded bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20"
            >
              Retry
            </button>
          </div>
        ) : games.length === 0 ? (
          <EmptyGameGridState showCreateGameCta={shouldShowCreateGameCta} />
        ) : layout === "vertical" ? (
          <div className="flex flex-col gap-3">
            {resolvedGames.map((game) => {
              const claimSummaryState = claimSummaryByWorldKey.get(game.worldKey);
              const canClaimFromCard = Boolean(claimSummaryState?.data?.canClaimNow && onClaimRewards);

              return (
                <GameCard
                  key={game.worldKey}
                  game={game}
                  onPlay={() =>
                    (onPlayGame ?? onSelectGame)({
                      name: game.name,
                      chain: game.chain,
                      worldAddress: game.worldAddress ?? undefined,
                    })
                  }
                  onSettle={() =>
                    onSelectGame({ name: game.name, chain: game.chain, worldAddress: game.worldAddress ?? undefined })
                  }
                  onSpectate={() =>
                    onSpectate({ name: game.name, chain: game.chain, worldAddress: game.worldAddress ?? undefined })
                  }
                  onSeeScore={
                    onSeeScore
                      ? () =>
                          onSeeScore({
                            name: game.name,
                            chain: game.chain,
                            worldAddress: game.worldAddress ?? undefined,
                          })
                      : undefined
                  }
                  onClaimRewards={
                    canClaimFromCard
                      ? () =>
                          onClaimRewards?.({
                            name: game.name,
                            chain: game.chain,
                            worldAddress: game.worldAddress ?? undefined,
                          })
                      : undefined
                  }
                  claimSummary={claimSummaryState?.data ?? null}
                  onRegistrationComplete={handleRegistrationComplete}
                  playerAddress={playerAddress}
                  showChainBadge={true}
                />
              );
            })}
          </div>
        ) : (
          <div className="flex gap-3 p-1">
            {resolvedGames.map((game) => {
              const claimSummaryState = claimSummaryByWorldKey.get(game.worldKey);
              const canClaimFromCard = Boolean(claimSummaryState?.data?.canClaimNow && onClaimRewards);

              return (
                <div key={game.worldKey} className="flex-shrink-0 w-[380px]">
                  <GameCard
                    game={game}
                    onPlay={() =>
                      (onPlayGame ?? onSelectGame)({
                        name: game.name,
                        chain: game.chain,
                        worldAddress: game.worldAddress ?? undefined,
                      })
                    }
                    onSettle={() =>
                      onSelectGame({ name: game.name, chain: game.chain, worldAddress: game.worldAddress ?? undefined })
                    }
                    onSpectate={() =>
                      onSpectate({ name: game.name, chain: game.chain, worldAddress: game.worldAddress ?? undefined })
                    }
                    onSeeScore={
                      onSeeScore
                        ? () =>
                            onSeeScore({
                              name: game.name,
                              chain: game.chain,
                              worldAddress: game.worldAddress ?? undefined,
                            })
                        : undefined
                    }
                    onClaimRewards={
                      canClaimFromCard
                        ? () =>
                            onClaimRewards?.({
                              name: game.name,
                              chain: game.chain,
                              worldAddress: game.worldAddress ?? undefined,
                            })
                        : undefined
                    }
                    claimSummary={claimSummaryState?.data ?? null}
                    onRegistrationComplete={handleRegistrationComplete}
                    playerAddress={playerAddress}
                    showChainBadge={true}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
