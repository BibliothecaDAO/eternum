import type { GameIcon } from "@/ui/design-system/atoms/game-icon";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useIdentitySession, useIdentitySessionStore } from "@/hooks/context/identity-session";
import { resolveEffectiveRegistrationCountMax } from "@/hooks/registration-capacity";
import { summaryToWorldConfigMeta } from "@/hooks/summary-to-world-config-meta";
import { usePlayerWorldRegistrations, getWorldSummaryKey } from "@/hooks/use-player-world-registrations";
import { type WorldConfigMeta } from "@/hooks/use-world-availability";
import { useWorldsSummary } from "@/hooks/use-worlds-summary";
import type { WorldSummary } from "@bibliothecadao/types";
import { getShard, type GameRef } from "@bibliothecadao/eternum/game-client";
import { WorldCountdownDetailed, useGameTimeStatus } from "@/ui/components/world-countdown";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import {
  CheckCircle2,
  Eye,
  Loader2,
  LogIn,
  Play,
  RefreshCw,
  Sparkles,
  Trophy,
  Users,
} from "@/ui/design-system/atoms/game-icons";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";

const toPaddedFeltAddress = (address: string): string => `0x${BigInt(address).toString(16).padStart(64, "0")}`;

/** Shard badge - shows which shard hosts the game, since game ids repeat across shards. */
const ShardBadge = ({ chainId }: { chainId: string }) => {
  const shard = getShard(chainId);
  return (
    <span className="text-[8px] font-medium px-1 py-0.5 rounded text-white/70 bg-white/10 border border-white/20">
      {shard ? new URL(shard.url).host : chainId}
    </span>
  );
};

/** A landing choice: the game's (chain id, game id) and the name the card showed. */
export type WorldSelection = GameRef & { name: string };

const selectionOf = (game: GameData): WorldSelection => ({
  chainId: game.chainId,
  gameId: game.gameId,
  name: game.name,
});

type GameStatus = "ongoing" | "upcoming" | "ended" | "unknown";

const isUpcomingOnlyStatusFilter = (statusFilter: GameStatus | GameStatus[] | undefined): boolean => {
  if (Array.isArray(statusFilter)) return statusFilter.length === 1 && statusFilter[0] === "upcoming";
  return statusFilter === "upcoming";
};

export interface GameData extends GameRef {
  name: string;
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
    config?.registrationCountMax ?? "",
    config?.twoPlayerMode ? "1" : "0",
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

/**
 * The card action shown before a gameplay account exists. The account derives from the identity
 * session (GameplayAccountSync provisions it chain-wide), so this gate mirrors that pipeline:
 * anonymous → sign in, signed in → provisioning, failed → the loud error. Never dead-end text.
 */
const GameplayAccountGate = () => {
  const { status } = useIdentitySession();
  const requestSignIn = useIdentitySessionStore((state) => state.requestSignIn);
  const provisioningError = useAccountStore((state) => state.provisioningError);

  if (status === "anonymous") {
    return (
      <button
        onClick={() => requestSignIn()}
        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-semibold bg-gold/20 text-gold border border-gold/30 hover:bg-gold/30 transition-colors"
      >
        <LogIn className="w-3 h-3" />
        Sign in to play
      </button>
    );
  }
  if (provisioningError) {
    return (
      <div className="flex-1 text-center text-[10px] text-red-400 py-1" title={provisioningError}>
        Account setup failed
      </div>
    );
  }
  return (
    <div className="flex-1 flex items-center justify-center gap-1 py-1 text-[10px] text-white/40">
      <Loader2 className="w-3 h-3 animate-spin" />
      Preparing account…
    </div>
  );
};

interface GameCardProps {
  game: GameData;
  onPlay: () => void;
  onSettle?: () => void;
  onSpectate: () => void;
  onSeeScore?: () => void;
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
  const showRegistered = game.isRegistered;
  const canEnterRegisteredBlitz = isBlitzMode && game.config?.ready && showRegistered && (isUpcoming || isOngoing);
  const canPlay = !isUnknownMode && (canEnterRegisteredBlitz || canOpenEternumEntry);

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
            {showChainBadge && <ShardBadge chainId={game.chainId} />}
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
            <div className="flex-1 rounded border border-white/10 px-2 py-1.5 text-xs text-white/60">
              Assigned players settle automatically
            </div>
          ) : isBlitzMode && !playerAddress && !showRegistered && canRegisterPeriod ? (
            <GameplayAccountGate />
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
  className,
  modeFilter,
  devModeFilter,
  title = "Games",
  statusFilter,
  hideHeader = false,
  hideLegend = false,
  layout = "horizontal",
  sortRegisteredFirst = false,
  sortEndedNewestFirst = false,
  registeredFilter,
  onGamesResolved,
}: UnifiedGameGridProps) => {
  const account = useAccountStore((state) => state.account);
  const playerAddress = account?.address && account.address !== "0x0" ? account.address : null;
  const playerFeltLiteral = playerAddress ? toPaddedFeltAddress(playerAddress) : null;

  const { isOngoing, isEnded, isUpcoming } = useGameTimeStatus();

  // Single bulk summary fetch for all worlds (replaces per-world fan-out).
  // The server serves timing, mode, counters, and prize addresses in one call.
  const {
    data: worldsSummaryData,
    isPending: summaryIsLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useWorldsSummary();

  // Dead (alive=false) worlds are excluded from the card grid — they surface separately via the modal.
  const liveSummaries = useMemo<WorldSummary[]>(
    () => (worldsSummaryData ?? []).filter((summary) => summary.alive),
    [worldsSummaryData],
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
        if (!summary.ready) gameStatus = "upcoming";
        else if (isEnded(startMainAt, endAt)) gameStatus = "ended";
        else if (isOngoing(startMainAt, endAt)) gameStatus = "ongoing";
        else if (isUpcoming(startMainAt)) gameStatus = "upcoming";

        const registration = registrationsByWorldKey.get(worldKey) ?? null;
        const config: WorldConfigMeta = summaryToWorldConfigMeta(summary, registration);

        const isRegistered = config.isPlayerRegistered ?? config.hasPlayerSettledRealm ?? null;

        return {
          name: summary.name,
          chainId: summary.chainId,
          gameId: summary.gameId,
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

  const resolvedGames = useMemo(() => {
    if (!sortEndedNewestFirst) return games;

    return games.toSorted((a, b) => {
      const aIsEnded = a.gameStatus === "ended";
      const bIsEnded = b.gameStatus === "ended";
      if (!aIsEnded || !bIsEnded) return 0;

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
  }, [games, sortEndedNewestFirst, sortRegisteredFirst]);

  const handleRefresh = useCallback(async () => {
    await refetchSummary();
  }, [refetchSummary]);

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
            {resolvedGames.map((game) => (
              <GameCard
                key={game.worldKey}
                game={game}
                onPlay={() => (onPlayGame ?? onSelectGame)(selectionOf(game))}
                onSettle={() => onSelectGame(selectionOf(game))}
                onSpectate={() => onSpectate(selectionOf(game))}
                onSeeScore={onSeeScore ? () => onSeeScore(selectionOf(game)) : undefined}
                playerAddress={playerAddress}
                showChainBadge={true}
              />
            ))}
          </div>
        ) : (
          <div className="flex gap-3 p-1">
            {resolvedGames.map((game) => (
              <div key={game.worldKey} className="flex-shrink-0 w-[380px]">
                <GameCard
                  game={game}
                  onPlay={() => (onPlayGame ?? onSelectGame)(selectionOf(game))}
                  onSettle={() => onSelectGame(selectionOf(game))}
                  onSpectate={() => onSpectate(selectionOf(game))}
                  onSeeScore={onSeeScore ? () => onSeeScore(selectionOf(game)) : undefined}
                  playerAddress={playerAddress}
                  showChainBadge={true}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
