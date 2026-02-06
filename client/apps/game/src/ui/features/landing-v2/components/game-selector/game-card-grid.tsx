import { useAccountStore } from "@/hooks/store/use-account-store";
import { useFactoryWorlds } from "@/hooks/use-factory-worlds";
import {
  useWorldsAvailability,
  getAvailabilityStatus,
  getWorldKey,
  type WorldConfigMeta,
} from "@/hooks/use-world-availability";
import { useWorldRegistration, type RegistrationStage } from "@/hooks/use-world-registration";
import type { WorldSelectionInput } from "@/runtime/world";
import { WorldCountdownDetailed, useGameTimeStatus } from "@/ui/components/world-countdown";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Eye, Play, UserPlus, Users, RefreshCw, Loader2, CheckCircle2, Trophy, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Chain } from "@contracts";
import { useQueryClient } from "@tanstack/react-query";

const toPaddedFeltAddress = (address: string): string => `0x${BigInt(address).toString(16).padStart(64, "0")}`;

/**
 * Format fee amount from wei to human-readable LORDS
 */
const formatFeeAmount = (amount: bigint): string => {
  const divisor = 10n ** 18n;
  const whole = amount / divisor;
  const remainder = amount % divisor;
  if (remainder === 0n) return whole.toString();
  const decimal = (remainder * 100n) / divisor;
  if (decimal === 0n) return whole.toString();
  return `${whole}.${decimal.toString().padStart(2, "0")}`;
};

/**
 * Get stage label for registration progress
 */
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
  const isMainnet = chain === "mainnet";
  return (
    <span
      className={cn(
        "text-[8px] font-medium px-1 py-0.5 rounded",
        isMainnet
          ? "text-brilliance/70 bg-brilliance/10 border border-brilliance/20"
          : "text-gold/70 bg-gold/10 border border-gold/20",
      )}
    >
      {isMainnet ? "Mainnet" : "Slot"}
    </span>
  );
};

export type WorldSelection = WorldSelectionInput;

export type GameStatus = "ongoing" | "upcoming" | "ended" | "unknown";

interface GameData {
  name: string;
  chain: Chain;
  worldKey: string;
  status: "checking" | "ok" | "fail";
  gameStatus: GameStatus;
  startMainAt: number | null;
  endAt: number | null;
  registrationCount: number | null;
  isRegistered: boolean | null;
  config: WorldConfigMeta | null;
}

interface GameCardProps {
  game: GameData;
  onPlay: () => void;
  onSpectate: () => void;
  onSeeScore?: () => void;
  onForgeHyperstructures?: () => void;
  onRegistrationComplete?: (worldKey: string) => void;
  playerAddress: string | null;
  showChainBadge?: boolean;
}

/**
 * Single game card component with inline registration
 */
const GameCard = ({
  game,
  onPlay,
  onSpectate,
  onSeeScore,
  onForgeHyperstructures,
  onRegistrationComplete,
  playerAddress,
  showChainBadge = false,
}: GameCardProps) => {
  const isOngoing = game.gameStatus === "ongoing";
  const isUpcoming = game.gameStatus === "upcoming";
  const isEnded = game.gameStatus === "ended";
  const devModeOn = game.config?.devModeOn ?? false;
  const canPlay = isOngoing && game.isRegistered;
  // Can spectate ongoing or ended games
  const canSpectate = isOngoing || isEnded;
  // Can register during upcoming, or during ongoing if dev mode is on
  const canRegisterPeriod = isUpcoming || (isOngoing && devModeOn);
  // Forge hyperstructures button shown for upcoming games
  const numHyperstructuresLeft = game.config?.numHyperstructuresLeft ?? 0;
  // Show forge button for upcoming games when we have the config (even if 0 left, show disabled)
  const showForgeButton = isUpcoming && game.config?.numHyperstructuresLeft !== null && playerAddress;

  // Inline registration hook
  const { register, registrationStage, isRegistering, error, feeAmount, canRegister } = useWorldRegistration({
    worldName: game.name,
    chain: game.chain,
    config: game.config,
    isRegistered: game.isRegistered === true,
    enabled: game.status === "ok" && canRegisterPeriod,
  });

  // Handle registration with toast notification
  const handleRegister = useCallback(async () => {
    try {
      await register();
    } catch (err) {
      console.error("Registration failed:", err);
    }
  }, [register]);

  // Show success toast when registration completes
  useEffect(() => {
    if (registrationStage === "done") {
      toast.success("Registration successful!", {
        description: `You are now registered for ${game.name}`,
      });
      onRegistrationComplete?.(game.worldKey);
    }
  }, [registrationStage, game.name, game.worldKey, onRegistrationComplete]);

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

  const showRegistered = game.isRegistered || registrationStage === "done";

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

        {/* Stats row with registration indicator */}
        <div className="flex items-center justify-between text-xs text-white/60">
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            <span>{game.registrationCount ?? 0} players</span>
          </div>
          {showRegistered && (
            <div className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-3 h-3" />
              <span className="font-medium">Registered</span>
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

        {/* Action buttons - compact: [Play/Register] [Spectate] layout */}
        <div className="flex gap-1.5">
          {/* Left slot: Play OR Register (share same space) - hidden for ended games without registration */}
          {isEnded && !showRegistered ? null : canPlay ? (
            <button
              onClick={onPlay}
              className={cn(
                "flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-semibold",
                "bg-emerald-500 text-white hover:bg-emerald-400 transition-colors",
              )}
            >
              <Play className="w-3 h-3" />
              Play
            </button>
          ) : game.isRegistered === null && playerAddress ? (
            // Loading state while checking registration status
            <div className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-medium bg-white/5 text-white/40 border border-white/10">
              <Loader2 className="w-3 h-3 animate-spin" />
            </div>
          ) : game.isRegistered === false && !registrationStage && canRegisterPeriod && playerAddress ? (
            <>
              {isRegistering ? (
                <div className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-medium bg-gold/10 text-gold border border-gold/30">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {getStageLabel(registrationStage)}
                </div>
              ) : registrationStage === "error" ? (
                <button
                  onClick={handleRegister}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors"
                >
                  Retry
                </button>
              ) : canRegister ? (
                <button
                  onClick={handleRegister}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-semibold",
                    "bg-brilliance/20 text-brilliance border border-brilliance/30 hover:bg-brilliance/30 transition-colors",
                  )}
                >
                  <UserPlus className="w-3 h-3" />
                  Register
                </button>
              ) : null}
            </>
          ) : !playerAddress && !showRegistered && canRegisterPeriod ? (
            <div className="flex-1 text-center text-[10px] text-white/40 py-1">Connect wallet</div>
          ) : null}

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
              See Score
            </button>
          )}

          {/* Forge Hyperstructures button for upcoming games */}
          {showForgeButton && onForgeHyperstructures && (
            <button
              onClick={onForgeHyperstructures}
              disabled={numHyperstructuresLeft <= 0}
              className={cn(
                "flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-semibold transition-colors",
                numHyperstructuresLeft > 0
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30"
                  : "bg-gray-500/10 text-gray-500 border border-gray-500/20 cursor-not-allowed",
              )}
            >
              <Sparkles className="w-3 h-3" />
              Forge {numHyperstructuresLeft} Hypers
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

        {/* Fee info (shown when can register) */}
        {canRegister && feeAmount > 0n && !isRegistering && (
          <div className="text-[10px] text-gold/50 text-center">Fee: {formatFeeAmount(feeAmount)} LORDS</div>
        )}

        {/* Error message - only show if not already registered */}
        {registrationStage === "error" && error && !showRegistered && (
          <div className="text-[10px] text-red-400 text-center truncate" title={error}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

interface UnifiedGameGridProps {
  onSelectGame: (selection: WorldSelection) => void;
  onSpectate: (selection: WorldSelection) => void;
  onSeeScore?: (selection: WorldSelection) => void;
  /** Callback for forging hyperstructures - receives world selection and numHyperstructuresLeft */
  onForgeHyperstructures?: (selection: WorldSelection, numHyperstructuresLeft: number) => void;
  onRegistrationComplete?: () => void;
  className?: string;
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
}

/**
 * Unified game grid - combines games from mainnet and slot into a single view
 */
export const UnifiedGameGrid = ({
  onSelectGame,
  onSpectate,
  onSeeScore,
  onForgeHyperstructures,
  onRegistrationComplete,
  className,
  devModeFilter,
  title = "Games",
  statusFilter,
  hideHeader = false,
  hideLegend = false,
  layout = "horizontal",
  sortRegisteredFirst = false,
}: UnifiedGameGridProps) => {
  // Track locally completed registrations (to show immediately before refetch)
  const [localRegistrations, setLocalRegistrations] = useState<Record<string, boolean>>({});

  const queryClient = useQueryClient();
  const account = useAccountStore((state) => state.account);
  const playerAddress = account?.address && account.address !== "0x0" ? account.address : null;
  const playerFeltLiteral = playerAddress ? toPaddedFeltAddress(playerAddress) : null;

  // Check if there's a stored controller session that's still reconnecting
  // starknet-react stores the last connected connector as "lastUsedConnector" in localStorage
  const [hasStoredSession] = useState(() => {
    if (typeof window === "undefined") return false;
    const storedConnector = window.localStorage.getItem("lastUsedConnector");
    return storedConnector !== null;
  });

  // Safety timeout: don't wait forever if auto-connect fails silently
  const [reconnectTimedOut, setReconnectTimedOut] = useState(false);
  useEffect(() => {
    if (!hasStoredSession || playerAddress) return;
    const timeout = setTimeout(() => setReconnectTimedOut(true), 5000);
    return () => clearTimeout(timeout);
  }, [hasStoredSession, playerAddress]);

  const isWaitingForReconnect = hasStoredSession && !playerAddress && !reconnectTimedOut;

  const { isOngoing, isEnded, isUpcoming } = useGameTimeStatus();

  // Fetch from both chains
  const {
    worlds: factoryWorlds,
    isLoading: factoryWorldsLoading,
    error: factoryError,
    refetchAll: refetchFactoryWorlds,
  } = useFactoryWorlds(["mainnet", "slot"]);

  // Fetch world availability AND player registration status together
  // When playerFeltLiteral changes (user connects), React Query will refetch
  const {
    results: factoryAvailability,
    isAnyLoading: factoryCheckingAvailability,
    refetchAll: refetchFactory,
  } = useWorldsAvailability(factoryWorlds, factoryWorlds.length > 0, playerFeltLiteral);

  // Build game data - only include online games from both chains
  const games = useMemo<GameData[]>(() => {
    const nodes = factoryWorlds
      .map((world) => {
        const worldKey = getWorldKey(world);
        const availability = factoryAvailability.get(worldKey);
        const status = getAvailabilityStatus(availability);
        const startMainAt = availability?.meta?.startMainAt ?? null;
        const endAt = availability?.meta?.endAt ?? null;

        let gameStatus: GameStatus = "unknown";
        if (status === "ok") {
          if (isEnded(startMainAt, endAt)) gameStatus = "ended";
          else if (isOngoing(startMainAt, endAt)) gameStatus = "ongoing";
          else if (isUpcoming(startMainAt)) gameStatus = "upcoming";
        }

        // Use local registration state first, then fall back to server state
        const isRegistered = localRegistrations[worldKey] ?? availability?.meta?.isPlayerRegistered ?? null;

        return {
          name: world.name,
          chain: world.chain,
          worldKey,
          status,
          gameStatus,
          startMainAt,
          endAt,
          registrationCount: availability?.meta?.registrationCount ?? null,
          isRegistered,
          config: availability?.meta ?? null,
        };
      })
      // Only show online games
      .filter((game) => game.status === "ok")
      // Filter by dev mode if specified
      .filter((game) => {
        if (devModeFilter === undefined) return true;
        const gameDevMode = game.config?.devModeOn ?? false;
        return devModeFilter === gameDevMode;
      })
      // Filter by game status if specified
      .filter((game) => {
        if (!statusFilter) return true;
        const statuses = Array.isArray(statusFilter) ? statusFilter : [statusFilter];
        return statuses.includes(game.gameStatus);
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
    factoryWorlds,
    factoryAvailability,
    localRegistrations,
    isOngoing,
    isEnded,
    isUpcoming,
    devModeFilter,
    statusFilter,
    sortRegisteredFirst,
  ]);

  const handleRefresh = useCallback(async () => {
    setLocalRegistrations({});
    await Promise.all([refetchFactoryWorlds(), refetchFactory()]);
  }, [refetchFactoryWorlds, refetchFactory]);

  // Callback for when a registration completes - update local state immediately and invalidate cache
  const handleRegistrationComplete = useCallback(
    (worldKey: string) => {
      // Update local state for immediate UI feedback
      setLocalRegistrations((prev) => ({ ...prev, [worldKey]: true }));

      // Invalidate the query cache so fresh data is fetched when navigating back
      // This ensures the registration status persists across tab switches
      queryClient.invalidateQueries({ queryKey: ["worldAvailability", worldKey] });

      onRegistrationComplete?.();
    },
    [onRegistrationComplete, queryClient],
  );

  // Wait for controller to reconnect if there's a stored session before showing games
  // This prevents the flash of "logged out" state on page refresh
  const isLoading = factoryWorldsLoading || factoryCheckingAvailability || isWaitingForReconnect;

  // Count by status
  const counts = useMemo(() => {
    return {
      ongoing: games.filter((g) => g.gameStatus === "ongoing").length,
      upcoming: games.filter((g) => g.gameStatus === "upcoming").length,
      ended: games.filter((g) => g.gameStatus === "ended").length,
    };
  }, [games]);

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
        {isWaitingForReconnect ? (
          // Always show loading when waiting for controller to reconnect, even if games are cached
          <div className="flex items-center justify-center h-[120px]">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 text-white/30 animate-spin" />
              <span className="text-xs text-white/40">Loading account...</span>
            </div>
          </div>
        ) : isLoading && games.length === 0 ? (
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
          <div className="flex flex-col items-center justify-center h-[60px] text-center">
            <p className="text-[10px] text-white/40">No games available</p>
          </div>
        ) : layout === "vertical" ? (
          <div className="flex flex-col gap-3">
            {games.map((game) => (
              <GameCard
                key={game.worldKey}
                game={game}
                onPlay={() => onSelectGame({ name: game.name, chain: game.chain })}
                onSpectate={() => onSpectate({ name: game.name, chain: game.chain })}
                onSeeScore={onSeeScore ? () => onSeeScore({ name: game.name, chain: game.chain }) : undefined}
                onForgeHyperstructures={
                  onForgeHyperstructures
                    ? () =>
                        onForgeHyperstructures(
                          { name: game.name, chain: game.chain },
                          game.config?.numHyperstructuresLeft ?? 0,
                        )
                    : undefined
                }
                onRegistrationComplete={handleRegistrationComplete}
                playerAddress={playerAddress}
                showChainBadge={true}
              />
            ))}
          </div>
        ) : (
          <div className="flex gap-3 p-1">
            {games.map((game) => (
              <div key={game.worldKey} className="flex-shrink-0 w-[320px]">
                <GameCard
                  game={game}
                  onPlay={() => onSelectGame({ name: game.name, chain: game.chain })}
                  onSpectate={() => onSpectate({ name: game.name, chain: game.chain })}
                  onSeeScore={onSeeScore ? () => onSeeScore({ name: game.name, chain: game.chain }) : undefined}
                  onForgeHyperstructures={
                    onForgeHyperstructures
                      ? () =>
                          onForgeHyperstructures(
                            { name: game.name, chain: game.chain },
                            game.config?.numHyperstructuresLeft ?? 0,
                          )
                      : undefined
                  }
                  onRegistrationComplete={handleRegistrationComplete}
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
