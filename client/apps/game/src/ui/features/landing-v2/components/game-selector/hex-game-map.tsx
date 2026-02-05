import { useAccountStore } from "@/hooks/store/use-account-store";
import { useFactoryWorlds } from "@/hooks/use-factory-worlds";
import { useWorldsAvailability, getAvailabilityStatus, getWorldKey } from "@/hooks/use-world-availability";
import { resolveChain } from "@/runtime/world";
import type { WorldSelectionInput } from "@/runtime/world";
import { WorldCountdownDetailed, useGameTimeStatus } from "@/ui/components/world-countdown";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Eye, Play, UserPlus, Users, RefreshCw, Loader2, ArrowLeft, CheckCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Chain } from "@contracts";
import { env } from "../../../../../../env";

const normalizeFactoryChain = (chain: Chain): Chain => {
  if (chain === "slottest" || chain === "local") return "slot";
  return chain;
};

const toPaddedFeltAddress = (address: string): string => `0x${BigInt(address).toString(16).padStart(64, "0")}`;

const buildToriiBaseUrl = (worldName: string) => `https://api.cartridge.gg/x/${worldName}/torii`;

const parseMaybeBool = (v: unknown): boolean | null => {
  if (v == null) return null;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const trimmed = v.trim().toLowerCase();
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
  }
  return null;
};

const fetchPlayerRegistrationStatus = async (
  toriiBaseUrl: string,
  playerLiteral: string | null,
): Promise<boolean | null> => {
  if (!playerLiteral) return null;
  try {
    const query = `SELECT registered FROM "s1_eternum-BlitzRealmPlayerRegister" WHERE player = "${playerLiteral}" LIMIT 1;`;
    const url = `${toriiBaseUrl}/sql?query=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const [row] = (await response.json()) as Record<string, unknown>[];
    if (row && row.registered != null) {
      return parseMaybeBool(row.registered);
    }
  } catch {
    // ignore
  }
  return null;
};

export type WorldSelection = WorldSelectionInput;

type GameStatus = "ongoing" | "upcoming" | "ended" | "unknown";

interface GameNode {
  name: string;
  chain: Chain;
  worldKey: string;
  status: "checking" | "ok" | "fail";
  gameStatus: GameStatus;
  startMainAt: number | null;
  endAt: number | null;
  registrationCount: number | null;
  isRegistered: boolean | null;
}

interface HexGameMapProps {
  chain: Chain;
  onSelectGame: (selection: WorldSelection) => void;
  onSpectate: (selection: WorldSelection) => void;
  onRegister: (selection: WorldSelection) => void;
  className?: string;
}

/**
 * SVG Hexagon component with glow and sparkle effects
 * Colors: Live = Green, Soon = Yellow, Ended = Gray
 */
const Hexagon = ({
  children,
  isOngoing,
  isUpcoming,
  isEnded,
  isRegistered,
  onClick,
  className,
}: {
  children: React.ReactNode;
  isOngoing: boolean;
  isUpcoming: boolean;
  isEnded: boolean;
  isRegistered: boolean;
  onClick: () => void;
  className?: string;
}) => {
  // Hex dimensions
  const width = 140;
  const height = 160;

  // Generate hex points (pointy-top orientation)
  const cx = width / 2;
  const cy = height / 2;
  const size = 65;
  const points = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    const x = cx + size * Math.cos(angle);
    const y = cy + size * Math.sin(angle);
    return `${x},${y}`;
  }).join(" ");

  // Unique IDs for SVG elements
  const gradientId = `hex-gradient-${Math.random().toString(36).slice(2)}`;
  const glowId = `hex-glow-${Math.random().toString(36).slice(2)}`;

  // Colors: Live = Green, Soon = Yellow, Ended = Gray
  const colors = isEnded
    ? { start: "#374151", end: "#1f2937", stroke: "#4b5563", glow: "#6b7280" }
    : isOngoing
      ? { start: "#34d399", end: "#059669", stroke: "#10b981", glow: "#34d399" } // GREEN for live
      : isUpcoming
        ? { start: "#fbbf24", end: "#b45309", stroke: "#f59e0b", glow: "#fbbf24" } // YELLOW for soon
        : { start: "#4b5563", end: "#1f2937", stroke: "#374151", glow: "#6b7280" };

  return (
    <div
      className={cn("relative cursor-pointer transition-all duration-300 hover:scale-105", className)}
      onClick={onClick}
      style={{ width, height }}
    >
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="absolute inset-0">
        <defs>
          {/* Gradient fill */}
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={colors.start} stopOpacity="0.9" />
            <stop offset="100%" stopColor={colors.end} stopOpacity="0.95" />
          </linearGradient>

          {/* Glow filter */}
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Inner shadow for depth */}
          <filter id={`${glowId}-inner`}>
            <feOffset dx="0" dy="2" />
            <feGaussianBlur stdDeviation="3" result="offset-blur" />
            <feComposite operator="out" in="SourceGraphic" in2="offset-blur" result="inverse" />
            <feFlood floodColor="black" floodOpacity="0.3" result="color" />
            <feComposite operator="in" in="color" in2="inverse" result="shadow" />
            <feComposite operator="over" in="shadow" in2="SourceGraphic" />
          </filter>
        </defs>

        {/* Outer glow for live games */}
        {isOngoing && (
          <polygon
            points={points}
            fill="none"
            stroke={colors.glow}
            strokeWidth="3"
            opacity="0.5"
            filter={`url(#${glowId})`}
            className="animate-pulse"
          />
        )}

        {/* Main hexagon */}
        <polygon
          points={points}
          fill={`url(#${gradientId})`}
          stroke={colors.stroke}
          strokeWidth="2"
          filter={`url(#${glowId}-inner)`}
        />

        {/* Highlight edge at top */}
        <polygon
          points={points}
          fill="none"
          stroke="white"
          strokeWidth="1"
          opacity="0.2"
          strokeDasharray="50 200"
          strokeDashoffset="25"
        />

        {/* Registered indicator ring */}
        {isRegistered && <polygon points={points} fill="none" stroke="white" strokeWidth="2" opacity="0.8" />}
      </svg>

      {/* Content overlay */}
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>

      {/* Sparkle effects for ongoing games */}
      {isOngoing && (
        <>
          <div
            className="absolute w-1 h-1 bg-white rounded-full animate-ping"
            style={{ top: "20%", left: "30%", animationDelay: "0s", animationDuration: "2s" }}
          />
          <div
            className="absolute w-1 h-1 bg-white rounded-full animate-ping"
            style={{ top: "35%", right: "25%", animationDelay: "0.7s", animationDuration: "2.5s" }}
          />
          <div
            className="absolute w-0.5 h-0.5 bg-emerald-300 rounded-full animate-ping"
            style={{ bottom: "30%", left: "25%", animationDelay: "1.2s", animationDuration: "1.8s" }}
          />
        </>
      )}

      {/* Registered badge */}
      {isRegistered && (
        <div className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-lg">
          <CheckCircle className="w-4 h-4 text-emerald-500" />
        </div>
      )}
    </div>
  );
};

/**
 * A single hexagon node representing a game world
 */
const HexNode = ({ game, onClick }: { game: GameNode; onClick: () => void }) => {
  const isOngoing = game.gameStatus === "ongoing";
  const isUpcoming = game.gameStatus === "upcoming";
  const isEnded = game.gameStatus === "ended";

  return (
    <Hexagon
      isOngoing={isOngoing}
      isUpcoming={isUpcoming}
      isEnded={isEnded}
      isRegistered={game.isRegistered === true}
      onClick={onClick}
    >
      <div className="flex flex-col items-center justify-center text-center px-4 py-2">
        {/* Game name */}
        <div
          className={cn("text-xs font-bold truncate w-full max-w-[100px]", isEnded ? "text-gray-300" : "text-white")}
          title={game.name}
        >
          {game.name.length > 14 ? `${game.name.slice(0, 12)}...` : game.name}
        </div>

        {/* Status badge */}
        <div
          className={cn(
            "mt-1.5 text-[9px] uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-full",
            isOngoing && "bg-emerald-500/30 text-emerald-200 border border-emerald-400/50",
            isUpcoming && "bg-yellow-500/30 text-yellow-200 border border-yellow-400/50",
            isEnded && "bg-gray-500/30 text-gray-300 border border-gray-400/30",
            game.gameStatus === "unknown" && "bg-gray-500/20 text-gray-400",
          )}
        >
          {isOngoing ? "Live" : isUpcoming ? "Soon" : isEnded ? "Ended" : "..."}
        </div>

        {/* Player count */}
        {game.registrationCount != null && (
          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-white/70">
            <Users className="w-3 h-3" />
            <span>{game.registrationCount}</span>
          </div>
        )}
      </div>
    </Hexagon>
  );
};

/**
 * Game detail panel - shown when a hex is clicked
 */
const GameDetailPanel = ({
  game,
  onBack,
  onPlay,
  onSpectate,
  onRegister,
  playerAddress,
}: {
  game: GameNode;
  onBack: () => void;
  onPlay: () => void;
  onSpectate: () => void;
  onRegister: () => void;
  playerAddress: string | null;
}) => {
  const isOngoing = game.gameStatus === "ongoing";
  const isUpcoming = game.gameStatus === "upcoming";
  const isEnded = game.gameStatus === "ended";
  const canPlay = isOngoing && game.isRegistered;
  const canRegister = (isUpcoming || isOngoing) && !game.isRegistered;
  const canSpectate = isOngoing;

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-white/60 hover:text-white mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">Back to games</span>
      </button>

      {/* Game card */}
      <div className="bg-black/40 backdrop-blur-sm rounded-xl border border-white/10 p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-white">{game.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={cn(
                  "text-xs uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-full",
                  isOngoing && "bg-emerald-500/30 text-emerald-300 border border-emerald-400/50",
                  isUpcoming && "bg-yellow-500/30 text-yellow-300 border border-yellow-400/50",
                  isEnded && "bg-gray-500/30 text-gray-300 border border-gray-400/30",
                )}
              >
                {isOngoing ? "Live" : isUpcoming ? "Upcoming" : isEnded ? "Ended" : "Unknown"}
              </span>
              {game.isRegistered && (
                <span className="text-xs text-emerald-400 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Registered
                </span>
              )}
            </div>
          </div>
          <span
            className={cn(
              "text-xs px-2 py-1 rounded border",
              game.chain === "mainnet"
                ? "border-brilliance/30 bg-brilliance/10 text-brilliance"
                : "border-gold/30 bg-gold/10 text-gold",
            )}
          >
            {game.chain}
          </span>
        </div>

        {/* Countdown */}
        <div className="bg-white/5 rounded-lg p-4 mb-4">
          <WorldCountdownDetailed
            startMainAt={game.startMainAt}
            endAt={game.endAt}
            status={game.status}
            className="text-lg font-semibold text-white"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white/5 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-white">{game.registrationCount ?? "-"}</div>
            <div className="text-xs text-white/50">Players Registered</div>
          </div>
          <div className="bg-white/5 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-white">
              {game.isRegistered ? <CheckCircle className="w-6 h-6 text-emerald-400 mx-auto" /> : "-"}
            </div>
            <div className="text-xs text-white/50">Your Status</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          {canPlay && (
            <button
              onClick={onPlay}
              className={cn(
                "flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-bold",
                "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white",
                "hover:from-emerald-400 hover:to-emerald-500 transition-all",
                "shadow-lg shadow-emerald-500/25",
              )}
            >
              <Play className="w-4 h-4" />
              Enter Game
            </button>
          )}

          {canSpectate && (
            <button
              onClick={onSpectate}
              className={cn(
                "flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold",
                "bg-white/10 border border-white/20 text-white",
                "hover:bg-white/20 transition-all",
              )}
            >
              <Eye className="w-4 h-4" />
              Spectate
            </button>
          )}

          {canRegister && playerAddress && (
            <button
              onClick={onRegister}
              className={cn(
                "flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-bold",
                "bg-gradient-to-r from-yellow-500 to-amber-600 text-black",
                "hover:from-yellow-400 hover:to-amber-500 transition-all",
                "shadow-lg shadow-yellow-500/25",
              )}
            >
              <UserPlus className="w-4 h-4" />
              Register Now
            </button>
          )}

          {!playerAddress && (canRegister || canPlay) && (
            <div className="text-center text-sm text-white/50 py-2">
              Connect your wallet to {canPlay ? "play" : "register"}
            </div>
          )}

          {isEnded && <div className="text-center text-sm text-white/40 py-2">This game has ended</div>}
        </div>
      </div>
    </div>
  );
};

/**
 * Hex grid map for a single chain (Mainnet or Slot)
 * Only displays games where the indexer is reachable (status === "ok")
 * Clicking a hex replaces the view with a detail panel
 */
export const HexGameMap = ({ chain, onSelectGame, onSpectate, onRegister, className }: HexGameMapProps) => {
  const [selectedGame, setSelectedGame] = useState<GameNode | null>(null);
  const [playerRegistration, setPlayerRegistration] = useState<Record<string, boolean | null>>({});

  const account = useAccountStore((state) => state.account);
  const playerAddress = account?.address && account.address !== "0x0" ? account.address : null;
  const playerFeltLiteral = playerAddress ? toPaddedFeltAddress(playerAddress) : null;

  const { isOngoing, isEnded, isUpcoming } = useGameTimeStatus();

  const resolvedChain = resolveChain(env.VITE_PUBLIC_CHAIN as Chain);
  const activeFactoryChain = normalizeFactoryChain(resolvedChain);
  const targetChain = normalizeFactoryChain(chain);

  const {
    worlds: factoryWorlds,
    isLoading: factoryWorldsLoading,
    error: factoryError,
    refetchAll: refetchFactoryWorlds,
  } = useFactoryWorlds([chain]);

  const {
    results: factoryAvailability,
    isAnyLoading: factoryCheckingAvailability,
    refetchAll: refetchFactory,
  } = useWorldsAvailability(factoryWorlds, factoryWorlds.length > 0);

  // Fetch player registration status
  useEffect(() => {
    if (!playerFeltLiteral) return;
    let cancelled = false;

    const onlineWorlds = factoryWorlds.filter((world) => {
      const availability = factoryAvailability.get(getWorldKey(world));
      return availability?.isAvailable && !availability.isLoading;
    });

    const uniqueWorlds = onlineWorlds.filter((world) => {
      const key = getWorldKey(world);
      return playerRegistration[key] === undefined;
    });

    if (uniqueWorlds.length === 0) return;

    const run = async () => {
      for (const world of uniqueWorlds) {
        if (cancelled) break;
        const key = getWorldKey(world);
        const torii = buildToriiBaseUrl(world.name);
        const status = await fetchPlayerRegistrationStatus(torii, playerFeltLiteral);
        if (!cancelled) {
          setPlayerRegistration((prev) => ({ ...prev, [key]: status }));
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [playerFeltLiteral, factoryWorlds, factoryAvailability, playerRegistration]);

  // Build game nodes - ONLY include games where indexer is online (status === "ok")
  const gameNodes = useMemo<GameNode[]>(() => {
    const nodes = factoryWorlds
      .filter((world) => normalizeFactoryChain(world.chain) === targetChain)
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

        return {
          name: world.name,
          chain: world.chain,
          worldKey,
          status,
          gameStatus,
          startMainAt,
          endAt,
          registrationCount: availability?.meta?.registrationCount ?? null,
          isRegistered: playerRegistration[worldKey] ?? null,
        };
      })
      // FILTER: Only show games where indexer is reachable
      .filter((game) => game.status === "ok");

    // Sort: registered games first, then by status (live > soon > ended)
    return nodes.toSorted((a, b) => {
      // First priority: registered games come first
      if (a.isRegistered && !b.isRegistered) return -1;
      if (!a.isRegistered && b.isRegistered) return 1;

      // Second priority: game status (live > soon > ended > unknown)
      const order: Record<GameStatus, number> = { ongoing: 0, upcoming: 1, ended: 2, unknown: 3 };
      return order[a.gameStatus] - order[b.gameStatus];
    });
  }, [factoryWorlds, factoryAvailability, playerRegistration, targetChain, isOngoing, isEnded, isUpcoming]);

  const handleRefresh = useCallback(async () => {
    setPlayerRegistration({});
    setSelectedGame(null);
    await Promise.all([refetchFactoryWorlds(), refetchFactory()]);
  }, [refetchFactoryWorlds, refetchFactory]);

  const handleSelectHex = useCallback((game: GameNode) => {
    setSelectedGame(game);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedGame(null);
  }, []);

  const handlePlay = useCallback(() => {
    if (selectedGame) {
      onSelectGame({ name: selectedGame.name, chain: selectedGame.chain });
    }
  }, [selectedGame, onSelectGame]);

  const handleSpectate = useCallback(() => {
    if (selectedGame) {
      onSpectate({ name: selectedGame.name, chain: selectedGame.chain });
    }
  }, [selectedGame, onSpectate]);

  const handleRegister = useCallback(() => {
    if (selectedGame) {
      onRegister({ name: selectedGame.name, chain: selectedGame.chain });
    }
  }, [selectedGame, onRegister]);

  const isLoading = factoryWorldsLoading || factoryCheckingAvailability;
  const isChainMatch = targetChain === activeFactoryChain;

  // Count by status for legend
  const counts = useMemo(() => {
    return {
      ongoing: gameNodes.filter((g) => g.gameStatus === "ongoing").length,
      upcoming: gameNodes.filter((g) => g.gameStatus === "upcoming").length,
      ended: gameNodes.filter((g) => g.gameStatus === "ended").length,
    };
  }, [gameNodes]);

  // Show detail panel if a game is selected
  if (selectedGame) {
    return (
      <div className={cn("relative", className)}>
        <GameDetailPanel
          game={selectedGame}
          onBack={handleBack}
          onPlay={handlePlay}
          onSpectate={handleSpectate}
          onRegister={handleRegister}
          playerAddress={playerAddress}
        />
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3
            className={cn(
              "text-lg font-bold uppercase tracking-wider",
              chain === "mainnet" ? "text-brilliance" : "text-gold",
            )}
          >
            {chain === "mainnet" ? "Mainnet" : "Slot"}
          </h3>
          {!isChainMatch && (
            <span className="text-[10px] text-gold/50 px-2 py-0.5 rounded border border-gold/20">Different chain</span>
          )}
          <span className="text-xs text-white/40">
            {gameNodes.length} game{gameNodes.length !== 1 ? "s" : ""} online
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

      {/* Legend */}
      <div className="flex items-center gap-4 mb-5 text-[10px]">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-gradient-to-b from-emerald-400 to-emerald-600 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
          <span className="text-white/60">Live ({counts.ongoing})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-gradient-to-b from-yellow-400 to-yellow-600 shadow-[0_0_6px_rgba(251,191,36,0.5)]" />
          <span className="text-white/60">Soon ({counts.upcoming})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-gradient-to-b from-gray-400 to-gray-600" />
          <span className="text-white/60">Ended ({counts.ended})</span>
        </div>
      </div>

      {/* Hex grid */}
      <div className="relative min-h-[250px]">
        {isLoading && gameNodes.length === 0 ? (
          <div className="flex items-center justify-center h-[200px]">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 text-white/30 animate-spin" />
              <span className="text-xs text-white/40">Checking indexers...</span>
            </div>
          </div>
        ) : factoryError ? (
          <div className="flex flex-col items-center justify-center h-[200px] text-center">
            <p className="text-sm text-danger">Failed to load games</p>
            <button
              onClick={() => void handleRefresh()}
              className="mt-2 px-3 py-1 text-xs rounded-md bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20"
            >
              Retry
            </button>
          </div>
        ) : gameNodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[200px] text-center">
            <p className="text-sm text-white/40">No games available on {chain}</p>
            <p className="text-xs text-white/30 mt-1">Games will appear when indexers are online</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3 justify-center items-start">
            {gameNodes.map((game) => (
              <HexNode key={game.worldKey} game={game} onClick={() => handleSelectHex(game)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
