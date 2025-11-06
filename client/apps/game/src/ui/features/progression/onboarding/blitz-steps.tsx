import { ReactComponent as Sword } from "@/assets/icons/sword.svg";
import { ReactComponent as TreasureChest } from "@/assets/icons/treasure-chest.svg";
import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useGoToStructure, useSpectatorModeClick } from "@/hooks/helpers/use-navigate";
import { useSetAddressName } from "@/hooks/helpers/use-set-address-name";
import { Position } from "@bibliothecadao/eternum";
import { WORLD_CONFIG_ID } from "@bibliothecadao/types";

import { useGameSelector } from "@/hooks/helpers/use-game-selector";
import { buildWorldProfile, getFactorySqlBaseUrl, setActiveWorldName } from "@/runtime/world";
import { isToriiAvailable } from "@/runtime/world/factory-resolver";
import Button from "@/ui/design-system/atoms/button";
import {
  configManager,
  ENTRY_TOKEN_LOCK_ID,
  formatTime,
  getEntityIdFromKeys,
  LordsAbi,
  toHexString,
} from "@bibliothecadao/eternum";
import { useDojo, useEntryTokenBalance, usePlayerOwnedRealmEntities } from "@bibliothecadao/react";
import { ControllerConnector } from "@cartridge/connector";
import type { Chain } from "@contracts";
import { useComponentValue, useEntityQuery } from "@dojoengine/react";
import { getComponentValue, HasValue } from "@dojoengine/recs";
import { cairoShortStringToFelt } from "@dojoengine/torii-wasm";
import { useAccount, useCall } from "@starknet-react/core";
import { motion } from "framer-motion";
import { AlertCircle, Globe, Home, RefreshCw, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Abi, CallData, uint256 } from "starknet";
import { env } from "../../../../../env";
import { SpectateButton } from "./spectate-button";

const REGISTRATION_TOKEN_DECIMALS = 18n;
const REGISTRATION_TOKEN_FACTOR = 10n ** REGISTRATION_TOKEN_DECIMALS;

const formatTokenAmount = (value: bigint) => (value / REGISTRATION_TOKEN_FACTOR).toString();

const formatLocalDateTime = (timestamp: number): string => {
  const date = new Date(timestamp * 1000);
  // Add weekday to the date/time string
  return date.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const normalizeUint256 = (value: unknown): bigint => {
  if (!value) return 0n;

  if (typeof value === "bigint") return value;

  if (Array.isArray(value)) {
    if (value.length === 2) {
      const [low, high] = value;
      return BigInt(low ?? 0) + (BigInt(high ?? 0) << 128n);
    }
    if (value.length === 1) {
      return BigInt(value[0] ?? 0);
    }
  }

  if (typeof value === "object" && value !== null) {
    const maybeUint = value as { low?: bigint | number | string; high?: bigint | number | string };
    if (maybeUint.low !== undefined && maybeUint.high !== undefined) {
      return BigInt(maybeUint.low) + (BigInt(maybeUint.high) << 128n);
    }
  }

  try {
    return BigInt(value as string);
  } catch (error) {
    console.warn("Failed to normalise uint256", value, error);
    return 0n;
  }
};

// Game state enum
enum GameState {
  NO_GAME = "NO_GAME",
  REGISTRATION = "REGISTRATION",
  GAME_ACTIVE = "GAME_ACTIVE",
}

// Countdown timer component
interface CountdownTimerProps {
  targetTime: number;
  label: string;
}

const CountdownTimer = memo(({ targetTime, label }: CountdownTimerProps) => {
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now() / 1000;
      const timeLeft = targetTime - now;
      setTimeRemaining(formatTime(timeLeft));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [targetTime]);

  return (
    <div className="text-center space-y-2">
      <p className="text-sm text-gold/70">{label}</p>
      <p className="text-2xl font-bold text-gold">{timeRemaining}</p>
    </div>
  );
});
CountdownTimer.displayName = "CountdownTimer";

// Player count display
interface PlayerCountProps {
  count: number;
}

const PlayerCount = memo(({ count }: PlayerCountProps) => {
  return (
    <div className="flex items-center justify-center gap-2 text-gold">
      <Users className="w-5 h-5" />
      <span className="text-lg font-semibold">{count} players registered</span>
    </div>
  );
});
PlayerCount.displayName = "PlayerCount";

// Inline factory games list (lightweight version of the selector modal)
type FactoryGame = {
  name: string;
  status: "checking" | "ok" | "fail";
  toriiBaseUrl: string;
  startMainAt: number | null;
  endAt: number | null;
};

const decodePaddedFeltAscii = (hex: string): string => {
  try {
    if (!hex) return "";
    const h = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
    if (h === "0") return "";
    // manual hex → ascii (skip leading 00 bytes)
    let i = 0;
    while (i + 1 < h.length && h.slice(i, i + 2) === "00") i += 2;
    let out = "";
    for (; i + 1 < h.length; i += 2) {
      const byte = parseInt(h.slice(i, i + 2), 16);
      if (byte === 0) continue;
      out += String.fromCharCode(byte);
    }
    return out;
  } catch {
    return "";
  }
};

const parseMaybeHexToNumber = (v: any): number | null => {
  if (v == null) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    try {
      if (v.startsWith("0x") || v.startsWith("0X")) return Number(BigInt(v));
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  }
  return null;
};

const FactoryGamesList = () => {
  const [games, setGames] = useState<FactoryGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nowSec, setNowSec] = useState<number>(() => Math.floor(Date.now() / 1000));
  // Hooks must be called unconditionally in a stable order. These are used later in UI
  // but declared here to avoid conditional early returns changing hook count.
  const { setup } = useDojo();
  const onSpectatorModeClick = useSpectatorModeClick(setup);

  useEffect(() => {
    const id = window.setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(id);
  }, []);

  const formatCountdown = (secondsLeft: number): string => {
    const total = Math.max(0, Math.floor(secondsLeft));
    const d = Math.floor(total / 86400);
    const h = Math.floor((total % 86400) / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const hh = h.toString().padStart(2, "0");
    const mm = m.toString().padStart(2, "0");
    const ss = s.toString().padStart(2, "0");
    return d > 0 ? `${d}d ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const factorySqlBaseUrl = getFactorySqlBaseUrl(env.VITE_PUBLIC_CHAIN as any);
      if (!factorySqlBaseUrl) {
        setGames([]);
        return;
      }
      const query = `SELECT name FROM [wf-WorldDeployed] LIMIT 200;`;
      const url = `${factorySqlBaseUrl}?query=${encodeURIComponent(query)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Factory query failed: ${res.status} ${res.statusText}`);
      const rows = (await res.json()) as any[];

      const names: string[] = [];
      const seen = new Set<string>();
      for (const row of rows) {
        const feltHex: string | undefined =
          (row && (row.name as string)) || (row && (row["data.name"] as string)) || (row && row?.data?.name);
        if (!feltHex || typeof feltHex !== "string") continue;
        const decoded = decodePaddedFeltAscii(feltHex);
        if (!decoded || seen.has(decoded)) continue;
        seen.add(decoded);
        names.push(decoded);
      }

      const initial: FactoryGame[] = names.map((n) => ({
        name: n,
        status: "checking",
        toriiBaseUrl: `https://api.cartridge.gg/x/${n}/torii`,
        startMainAt: null,
        endAt: null,
      }));
      setGames(initial);

      const limit = 8;
      let index = 0;
      const workers: Promise<void>[] = [];
      const work = async () => {
        while (index < initial.length) {
          const i = index++;
          const item = initial[i];
          try {
            const online = await isToriiAvailable(item.toriiBaseUrl);
            let startMainAt: number | null = null;
            let endAt: number | null = null;
            if (online) {
              try {
                const q = `SELECT "season_config.start_main_at" AS start_main_at, "season_config.end_at" AS end_at FROM "s1_eternum-WorldConfig" LIMIT 1;`;
                const u = `${item.toriiBaseUrl}/sql?query=${encodeURIComponent(q)}`;
                const r = await fetch(u);
                if (r.ok) {
                  const arr = (await r.json()) as any[];
                  if (arr && arr[0]) {
                    if (arr[0].start_main_at != null) startMainAt = parseMaybeHexToNumber(arr[0].start_main_at);
                    if (arr[0].end_at != null) endAt = parseMaybeHexToNumber(arr[0].end_at);
                  }
                }
              } catch {
                // ignore per-world time errors
              }
            }
            setGames((prev) => {
              const copy = [...prev];
              const idx = copy.findIndex((w) => w.name === item.name);
              if (idx >= 0) copy[idx] = { ...copy[idx], status: online ? "ok" : "fail", startMainAt, endAt };
              return copy;
            });
          } catch {
            setGames((prev) => {
              const copy = [...prev];
              const idx = copy.findIndex((w) => w.name === item.name);
              if (idx >= 0) copy[idx] = { ...copy[idx], status: "fail" };
              return copy;
            });
          }
        }
      };
      for (let k = 0; k < limit; k++) workers.push(work());
      await Promise.all(workers);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const enterGame = async (worldName: string) => {
    try {
      const chain = env.VITE_PUBLIC_CHAIN as Chain;
      await buildWorldProfile(chain, worldName);
      setActiveWorldName(worldName);
      window.location.href = "/play";
    } catch (e) {
      console.error("Failed to enter game", e);
    }
  };

  const byCategory = () => {
    const ongoing: FactoryGame[] = [];
    const upcoming: FactoryGame[] = [];
    const ended: FactoryGame[] = [];
    const offline: FactoryGame[] = [];

    for (const g of games) {
      if (g.status !== "ok") {
        offline.push(g);
        continue;
      }
      const start = g.startMainAt;
      const end = g.endAt;
      const isEnded = start != null && end != null && end !== 0 && nowSec >= end;
      const isOngoing = start != null && nowSec >= start && (end == null || end === 0 || nowSec < end);
      const isUpcoming = start != null && nowSec < start;
      if (isOngoing) ongoing.push(g);
      else if (isUpcoming) upcoming.push(g);
      else if (isEnded) ended.push(g);
      else offline.push(g);
    }

    // Sort each section by time
    // Upcoming: earliest start first
    upcoming.sort((a, b) => {
      const as = a.startMainAt ?? Number.MAX_SAFE_INTEGER;
      const bs = b.startMainAt ?? Number.MAX_SAFE_INTEGER;
      if (as !== bs) return as - bs;
      return a.name.localeCompare(b.name);
    });

    // Ongoing: soonest to end first; fallback to earliest start
    ongoing.sort((a, b) => {
      const aEnd = a.endAt && a.endAt > nowSec ? a.endAt : Number.MAX_SAFE_INTEGER;
      const bEnd = b.endAt && b.endAt > nowSec ? b.endAt : Number.MAX_SAFE_INTEGER;
      if (aEnd !== bEnd) return aEnd - bEnd;
      const as = a.startMainAt ?? Number.MAX_SAFE_INTEGER;
      const bs = b.startMainAt ?? Number.MAX_SAFE_INTEGER;
      if (as !== bs) return as - bs;
      return a.name.localeCompare(b.name);
    });

    // Ended: most recent end first
    ended.sort((a, b) => {
      const ae = a.endAt ?? 0;
      const be = b.endAt ?? 0;
      if (be !== ae) return be - ae;
      return a.name.localeCompare(b.name);
    });

    return { ongoing, upcoming, ended, offline };
  };

  const renderItem = (fg: FactoryGame) => {
    const isOnline = fg.status === "ok";
    const start = fg.startMainAt;
    const end = fg.endAt;
    let subtitle = "";
    if (isOnline) {
      if (start != null) {
        if ((end == null || end === 0) && nowSec >= start) subtitle = "Ongoing — ∞";
        else if (end != null && nowSec >= start && nowSec < end) subtitle = `Ends in ${formatCountdown(end - nowSec)}`;
        else if (nowSec < start) subtitle = `Starts in ${formatCountdown(start - nowSec)}`;
        else if (end != null && nowSec >= end) subtitle = `Ended ${new Date(end * 1000).toLocaleString()}`;
      }
    } else {
      subtitle = "Offline";
    }
    return (
      <div
        key={fg.name}
        className={`flex items-center justify-between rounded-lg border p-3 ${
          isOnline ? "border-gold/20 bg-gold/5" : "border-danger/40 bg-danger/5"
        }`}
      >
        <div>
          <div className="text-gold font-semibold">{fg.name}</div>
          <div className="text-[11px] text-gold/60">{subtitle}</div>
        </div>
        <Button
          onClick={() => enterGame(fg.name)}
          disabled={!isOnline}
          size="xs"
          variant="outline"
          forceUppercase={false}
        >
          Enter
        </Button>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-gold/20 bg-gold/5 p-4 text-center text-gold/70 text-sm">
        Loading factory games…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-lg border border-danger/40 bg-danger/5 p-4 text-center text-danger/80 text-sm">
        {error}
      </div>
    );
  }

  const { ongoing, upcoming, ended } = byCategory();
  const nothing = ongoing.length === 0 && upcoming.length === 0 && ended.length === 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <Button onClick={load} size="xs" variant="outline" forceUppercase={false} disabled={loading}>
          <div className="flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{loading ? "Refreshing…" : "Refresh"}</span>
          </div>
        </Button>
      </div>
      {nothing && (
        <div className="rounded-lg border-2 border-dashed border-gold/20 p-6 text-center">
          <p className="text-sm text-gold/60">No factory games found</p>
        </div>
      )}
      {ongoing.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-gold/80">Ongoing</div>
          {ongoing.map(renderItem)}
        </div>
      )}
      {upcoming.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-gold/80">Upcoming</div>
          {upcoming.map(renderItem)}
        </div>
      )}
      {ended.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-gold/80">Ended</div>
          {ended.map(renderItem)}
        </div>
      )}
    </div>
  );
};

// No game state component
const NoGameState = () => {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 text-center">
      {/* Placeholder for no game state */}
    </motion.div>
  );
};
// Animation variants for cleaner code organization
const buttonVariants = {
  idle: {
    scale: 1,
    rotate: 0,
  },
  hover: {
    scale: 1.1,
    rotate: [0, -2, 2, -2, 2, 0],
    transition: {
      scale: { duration: 0.2 },
      rotate: { duration: 0.6, repeat: Infinity },
    },
  },
  tap: {
    scale: 0.9,
    rotate: 0,
    transition: { duration: 0.1 },
  },
};

const numberVariants = {
  enter: {
    scale: 2,
    opacity: 0,
    rotate: 180,
  },
  center: {
    scale: 1,
    opacity: 1,
    rotate: 0,
    transition: {
      type: "spring",
      damping: 12,
      stiffness: 100,
      duration: 0.8,
    },
  },
  breathing: {
    scale: [1, 1.05, 1],
    y: [0, -2, 0],
    transition: {
      duration: 1.8,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

const rippleVariants = {
  pulse: {
    scale: [1, 1.5, 1],
    opacity: [0.6, 0, 0.6],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeOut",
    },
  },
};

// Hyperstructure Forge Button Component
interface HyperstructureForgeButtonProps {
  count: number;
  isLoading: boolean;
  onClick: () => void;
}

const HyperstructureForgeButton = memo(({ count, isLoading, onClick }: HyperstructureForgeButtonProps) => {
  const handleMouseEnter = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.currentTarget.style.borderColor = "#ffffff";
  }, []);

  const handleMouseLeave = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.currentTarget.style.borderColor = "#fef3c7";
  }, []);

  return (
    <motion.button
      onClick={onClick}
      disabled={isLoading}
      variants={buttonVariants}
      initial="idle"
      whileHover="hover"
      whileTap="tap"
      className="relative w-24 h-24 rounded-full cursor-pointer transform-gpu disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-4 focus:ring-yellow-300/50"
      style={{
        background: "radial-gradient(circle at 30% 30%, #facc15, #ca8a04, #f59e0b)",
        boxShadow:
          "0 8px 32px rgba(251, 191, 36, 0.4), inset 0 2px 8px rgba(255, 255, 255, 0.4), inset 0 -2px 8px rgba(0, 0, 0, 0.1)",
        border: "4px solid #fef3c7",
        transition: "border-color 0.3s ease",
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Ripple Effect */}
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-yellow-400/40"
        variants={rippleVariants}
        animate="pulse"
      />

      {/* Content */}
      <motion.div
        className="flex items-center justify-center w-full h-full text-4xl font-black text-amber-900"
        animate={isLoading ? {} : numberVariants.breathing}
      >
        {isLoading ? (
          <motion.img
            src="/images/logos/eternum-loader.png"
            className="w-8 h-8"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
        ) : (
          <motion.span key={count} variants={numberVariants} initial="enter" animate="center">
            {count}
          </motion.span>
        )}
      </motion.div>

      {/* Sparkles */}
      {!isLoading && (
        <>
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-white rounded-full"
              style={{
                top: `${20 + i * 20}%`,
                left: `${10 + i * 30}%`,
              }}
              animate={{
                opacity: [0, 1, 0],
                scale: [0, 1, 0],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.5,
                ease: "easeInOut",
              }}
            />
          ))}
        </>
      )}
    </motion.button>
  );
});
HyperstructureForgeButton.displayName = "HyperstructureForgeButton";

// Make hyperstructures state component
interface MakeHyperstructuresStateProps {
  numHyperStructuresLeft: number;
  onMakeHyperstructures: () => Promise<void>;
  canMake: boolean;
}

const MakeHyperstructuresState = memo(
  ({ numHyperStructuresLeft, onMakeHyperstructures, canMake }: MakeHyperstructuresStateProps) => {
    const [isMakingHyperstructures, setIsMakingHyperstructures] = useState(false);
    const [currentNumHyperStructuresLeft, setCurrentNumHyperStructuresLeft] = useState(numHyperStructuresLeft);
    const currentNumHyperStructuresLeftRef = useRef(numHyperStructuresLeft);

    useEffect(() => {
      currentNumHyperStructuresLeftRef.current = numHyperStructuresLeft;
      setCurrentNumHyperStructuresLeft(numHyperStructuresLeft);
    }, [numHyperStructuresLeft]);

    useEffect(() => {
      const interval = setInterval(() => {
        const latestNumHyperStructuresLeft = configManager.getBlitzConfig()?.blitz_num_hyperstructures_left;
        const normalisedCount =
          typeof latestNumHyperStructuresLeft === "bigint"
            ? Number(latestNumHyperStructuresLeft)
            : latestNumHyperStructuresLeft;

        if (
          typeof normalisedCount === "number" &&
          Number.isSafeInteger(normalisedCount) &&
          normalisedCount !== currentNumHyperStructuresLeftRef.current
        ) {
          currentNumHyperStructuresLeftRef.current = normalisedCount;
          setCurrentNumHyperStructuresLeft(normalisedCount);
        }
      }, 3000);

      return () => clearInterval(interval);
    }, []);

    const handleMakeHyperstructures = useCallback(async () => {
      setIsMakingHyperstructures(true);
      try {
        await onMakeHyperstructures();
      } catch (error) {
        console.error("Make hyperstructures failed:", error);
      } finally {
        setIsMakingHyperstructures(false);
      }
    }, [onMakeHyperstructures]);

    return (
      <>
        {currentNumHyperStructuresLeft > 0 && canMake && (
          <div className="flex flex-col items-center space-y-4">
            {/* Title */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
              <h3 className="text-gold font-semibold text-sm">Forge Hyperstructures</h3>
            </motion.div>

            {/* Forge Button */}
            <HyperstructureForgeButton
              count={currentNumHyperStructuresLeft}
              isLoading={isMakingHyperstructures}
              onClick={handleMakeHyperstructures}
            />
          </div>
        )}
      </>
    );
  },
);
MakeHyperstructuresState.displayName = "MakeHyperstructuresState";

interface DevOptionsStateProps {
  onDevModeRegister: () => Promise<void>;
  onDevModeSettle: () => Promise<void>;
  onDevModeObtainEntryToken?: () => Promise<void>;
  devMode: boolean;
}

const DevOptionsState = memo(
  ({ onDevModeRegister, onDevModeSettle, onDevModeObtainEntryToken, devMode }: DevOptionsStateProps) => {
    const [isDevModeRegistering, setIsDevModeRegistering] = useState(false);
    const [isDevModeSettling, setIsDevModeSettling] = useState(false);
    const [isDevModeObtainingToken, setIsDevModeObtainingToken] = useState(false);

    const handleDevModeRegister = useCallback(async () => {
      setIsDevModeRegistering(true);
      try {
        await onDevModeRegister();
      } catch (error) {
        console.error("Registration failed:", error);
      } finally {
        setIsDevModeRegistering(false);
      }
    }, [onDevModeRegister]);

    const handleDevModeSettle = useCallback(async () => {
      setIsDevModeSettling(true);
      try {
        await onDevModeSettle();
      } catch (error) {
        console.error("Settlement failed:", error);
      } finally {
        setIsDevModeSettling(false);
      }
    }, [onDevModeSettle]);

    const handleDevModeObtainEntryToken = useCallback(async () => {
      if (!onDevModeObtainEntryToken) return;

      setIsDevModeObtainingToken(true);
      try {
        await onDevModeObtainEntryToken();
      } catch (error) {
        console.error("Obtain entry token failed:", error);
      } finally {
        setIsDevModeObtainingToken(false);
      }
    }, [onDevModeObtainEntryToken]);

    return (
      <>
        {devMode && (
          <>
            {onDevModeObtainEntryToken && (
              <>
                {isDevModeObtainingToken ? (
                  <div className="flex items-center justify-center">
                    <img src="/images/logos/eternum-loader.png" className="w-5 h-5 mr-2 animate-spin" />
                    <span>Obtaining Token...</span>
                  </div>
                ) : (
                  <Button
                    onClick={handleDevModeObtainEntryToken}
                    disabled={isDevModeObtainingToken || !devMode}
                    className="w-full h-10 px-3 !text-brown !bg-gold !normal-case rounded-md animate-pulse"
                  >
                    <div className="flex items-center justify-center text-sm">
                      <TreasureChest className="w-4 h-4 mr-2 fill-brown" />
                      <span>Dev Mode Obtain Entry Token</span>
                    </div>
                  </Button>
                )}
              </>
            )}
            {isDevModeRegistering ? (
              <div className="flex items-center justify-center">
                <img src="/images/logos/eternum-loader.png" className="w-5 h-5 mr-2 animate-spin" />
                <span>Registering...</span>
              </div>
            ) : (
              <Button
                onClick={handleDevModeRegister}
                disabled={isDevModeRegistering || !devMode}
                forceUppercase={false}
                className="w-full h-10 px-3 !text-brown !bg-gold rounded-md animate-pulse text-sm"
              >
                <span>Dev Mode Register for Blitz</span>
              </Button>
            )}
            {isDevModeSettling ? (
              <div className="flex items-center justify-center">
                <img src="/images/logos/eternum-loader.png" className="w-5 h-5 mr-2 animate-spin" />
                <span>Settling...</span>
              </div>
            ) : (
              <Button
                onClick={handleDevModeSettle}
                disabled={isDevModeSettling || !devMode}
                forceUppercase={false}
                className="w-full h-10 px-3 !text-brown !bg-gold rounded-md animate-pulse text-sm"
              >
                <span>Dev Mode Settle Realm</span>
              </Button>
            )}
          </>
        )}
      </>
    );
  },
);
DevOptionsState.displayName = "DevOptionsState";

// Registration state component
const RegistrationState = ({
  entryTokenBalance,
  registrationCount,
  registrationStartAt,
  registrationEndAt,
  creationStartAt,
  creationEndAt,
  isRegistered,
  onRegister,
  requiresEntryToken,
  onObtainEntryToken,
  isObtainingEntryToken,
  availableEntryTokenId,
  entryTokenStatus,
  hasSufficientFeeBalance,
  isFeeBalanceLoading,
}: {
  entryTokenBalance: bigint;
  registrationCount: number;
  registrationStartAt: number;
  registrationEndAt: number;
  creationStartAt: number;
  creationEndAt: number;
  isRegistered: boolean;
  onRegister: () => Promise<void>;
  requiresEntryToken: boolean;
  onObtainEntryToken?: () => Promise<void> | void;
  isObtainingEntryToken?: boolean;
  availableEntryTokenId?: bigint | null;
  entryTokenStatus: "idle" | "minting" | "timeout" | "error";
  hasSufficientFeeBalance: boolean;
  isFeeBalanceLoading: boolean;
}) => {
  const { setup } = useDojo();

const RegistrationState = memo(
  ({
    entryTokenBalance,
    registrationCount,
    registrationEndAt,
    isRegistered,
    onRegister,
    requiresEntryToken,
    onObtainEntryToken,
    isObtainingEntryToken,
    availableEntryTokenId,
    entryTokenStatus,
    isFeeBalanceLoading,
    spectateDisabled,
  }: RegistrationStateProps) => {
    const { setup } = useDojo();

    const [isRegistering, setIsRegistering] = useState(false);
    const onSpectatorModeClick = useSpectatorModeClick(setup);

    const tokenReady = !requiresEntryToken || Boolean(availableEntryTokenId);

    const handleRegister = useCallback(async () => {
      setIsRegistering(true);
      try {
        await onRegister();
      } catch (error) {
        console.error("Registration failed:", error);
      } finally {
        setIsRegistering(false);
      }
    }, [onRegister]);

    const handleObtainEntryToken = useCallback(() => onObtainEntryToken?.(), [onObtainEntryToken]);

    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="text-center space-y-4">
          <h3 className="text-xl font-bold text-gold">Registration Open</h3>
          <PlayerCount count={registrationCount} />
          <CountdownTimer targetTime={registrationEndAt} label="Registration closes and Game Starts in:" />
        </div>

        <div className="space-y-4">
          {isRegistered ? (
            <div className="bg-gold/10 border border-gold/30 rounded-lg p-4 text-center">
              <TreasureChest className="w-8 h-8 mx-auto mb-2 fill-gold" />
              <p className="text-gold font-medium">You are registered!</p>
              <p className="text-sm text-gold/70 mt-1">Wait for the game to begin</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requiresEntryToken && (
                <div className="space-y-2">
                  <Button
                    onClick={handleObtainEntryToken}
                    disabled={isObtainingEntryToken}
                    className="w-full h-12 !text-brown !bg-gold/80 hover:!bg-gold rounded-md"
                    forceUppercase={false}
                  >
                    {isObtainingEntryToken ? (
                      <div className="flex items-center justify-center">
                        <img src="/images/logos/eternum-loader.png" className="w-5 h-5 mr-2 animate-spin" />
                        <span>Minting entry token...</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center">
                        <TreasureChest className="w-5 h-5 mr-2 fill-brown" />
                        <span>Obtain Entry Token</span>
                      </div>
                    )}
                  </Button>
                  <p className="text-xs text-gold/60 text-center">
                    {availableEntryTokenId
                      ? `Token #${availableEntryTokenId.toString()} will be used for registration`
                      : entryTokenStatus === "minting"
                        ? "Minting your entry token..."
                        : entryTokenStatus === "timeout"
                          ? "Minted! Still waiting for the token to appear. If it doesn't show, try again shortly."
                          : entryTokenStatus === "error"
                            ? "Mint failed. Please try again."
                            : "Mint an entry token before registering. Tokens are locked automatically during registration."}
                  </p>
                  {requiresEntryToken && entryTokenBalance < 1 && (
                    <p className="text-xs text-red-300 text-center">
                      Insufficient fee balance — auto top-up occurs when obtaining an entry token (non‑mainnet).
                    </p>
                  )}
                </div>
              )}
            </Button>
            {requiresEntryToken && isFeeBalanceLoading && (
              <p className="text-xs text-gold/60 text-center">Checking fee balance…</p>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

// Game active state component
const GameActiveState = ({
  hasSettled,
  gameEndAt,
  isRegistered,
  onSettle,
}: {
  hasSettled: boolean;
  gameEndAt?: number;
  isRegistered: boolean;
  onSettle: () => Promise<void>;
}) => {
  const {
    setup,
    setup: { components },
  } = useDojo();

const GameActiveState = memo(
  ({ hasSettled, gameEndAt, isRegistered, onSettle, spectateDisabled }: GameActiveStateProps) => {
    const {
      setup,
      setup: { components },
    } = useDojo();

    const goToStructure = useGoToStructure(setup);
    const realmEntities = usePlayerOwnedRealmEntities();
    const firstRealmEntityId = useMemo(() => realmEntities[0], [realmEntities]);
    const onSpectatorModeClick = useSpectatorModeClick(setup);
    const [isSettling, setIsSettling] = useState(false);

    const handleSettle = useCallback(async () => {
      setIsSettling(true);
      try {
        await onSettle();
      } catch (error) {
        console.error("Settlement failed:", error);
      } finally {
        setIsSettling(false);
      }
    }, [onSettle]);

    const handlePlay = useCallback(() => {
      if (!firstRealmEntityId) return;

      const structure = getComponentValue(components.Structure, firstRealmEntityId);
      if (!structure) return;

      void goToStructure(
        structure.entity_id,
        new Position({ x: structure.base.coord_x, y: structure.base.coord_y }),
        false,
      );
    }, [components.Structure, firstRealmEntityId, goToStructure]);

    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="text-center space-y-4">
          <h3 className="text-xl font-bold text-gold">Game Active</h3>
          <p className="text-gold/70">The battle for supremacy has begun!</p>

          {gameEndAt && (
            <div className="space-y-2">
              <CountdownTimer targetTime={gameEndAt} label="Game ends in:" />
              <div className="bg-gold/10 border border-gold/30 rounded-lg p-3 text-sm">
                <p className="text-gold/60 text-xs">Ends at: {formatLocalDateTime(gameEndAt)}</p>
                <p className="text-gold font-semibold mt-2">🏆 Conquer everything</p>
              </div>
            </div>
          )}
        </div>

      <div className="space-y-4">
        {isRegistered ? (
          <>
            {hasSettled ? (
              <Button
                onClick={handlePlay}
                forceUppercase={false}
                className="w-full h-12 !text-brown !bg-gold rounded-md "
              >
                <div className="flex items-center justify-center">
                  <Sword className="w-5 h-5 mr-2 fill-brown" />
                  <span>Play Blitz</span>
                </div>
              </Button>
            ) : (
              <>
                <div className="bg-gold/10 border border-gold/30 rounded-lg p-4 text-center mb-4">
                  <p className="text-gold text-sm">
                    In Blitz mode, your settlement location will be automatically assigned for balanced gameplay
                  </p>
                </div>
                <Button
                  onClick={handleSettle}
                  disabled={isSettling}
                  className="w-full h-12 !text-brown !bg-gold rounded-md animate-pulse"
                  forceUppercase={false}
                >
                  {isSettling ? (
                    <div className="flex items-center justify-center">
                      <img src="/images/logos/eternum-loader.png" className="w-5 h-5 mr-2 animate-spin" />
                      <span>Settling...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      <TreasureChest className="w-5 h-5 mr-2 fill-brown" />
                      <span>Settle Realm</span>
                    </div>
                  )}
                </Button>
              </>
            )}
          </>
        ) : (
          <div className="bg-brown/10 border border-brown/30 rounded-lg p-4 text-center">
            <p className="text-gold/70">You are not registered for this game</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// Main Blitz onboarding component
export const BlitzOnboarding = () => {
  const navigate = useNavigate();
  const [gameState, setGameState] = useState<GameState>(GameState.NO_GAME);
  const [addressNameFelt, setAddressNameFelt] = useState<string>("");
  const { activeWorld, selectGame } = useGameSelector();
  const { setup, network, masterAccount } = useDojo();
  const {
    account: { account },
    components,
    systemCalls: {
      blitz_realm_register,
      blitz_realm_create,
      blitz_realm_make_hyperstructures,
      blitz_realm_obtain_entry_token,
    },
  } = setup;

  const accountAddress = account.address;
  const networkProvider = network?.provider;
  const { currentBlockTimestamp } = useBlockTimestamp();

  const worldConfigEntityId = useMemo(() => getEntityIdFromKeys([WORLD_CONFIG_ID]), []);
  const worldConfigValue = useComponentValue(components.WorldConfig, worldConfigEntityId);

  const blitzConfigData = configManager.getBlitzConfig();
  const blitzConfig = blitzConfigData?.blitz_registration_config;
  const blitzNumHyperStructuresLeft = blitzConfigData?.blitz_num_hyperstructures_left;
  const seasonConfig = configManager.getSeasonConfig();
  const seasonEndAt = seasonConfig?.endAt ?? null;
  const hasGameEnded = useMemo(() => {
    if (!seasonEndAt) {
      return false;
    }

    return currentBlockTimestamp > seasonEndAt;
  }, [currentBlockTimestamp, seasonEndAt]);
  const devMode = configManager.getDevModeConfig()?.dev_mode_on;
  const registrationCount = useMemo(() => {
    const liveCount = worldConfigValue?.blitz_registration_config?.registration_count;

    if (liveCount !== undefined && liveCount !== null) {
      return Number(liveCount);
    }

    const fallbackCount = blitzConfig?.registration_count ?? 0;
    return fallbackCount;
  }, [blitzConfig?.registration_count, worldConfigValue]);
  const {
    balance: entryTokenBalance,
    hasEntryTokenContract,
    refetch: refetchEntryTokenBalance,
    getEntryTokenIdByIndex,
  } = useEntryTokenBalance();
  const [availableEntryTokenId, setAvailableEntryTokenId] = useState<bigint | null>(null);
  const [isObtainingEntryToken, setIsObtainingEntryToken] = useState(false);
  const [entryTokenStatus, setEntryTokenStatus] = useState<"idle" | "minting" | "timeout" | "error">("idle");
  const [hasQueriedEntryToken, setHasQueriedEntryToken] = useState(false);
  const playerRegistered = useComponentValue(
    components.BlitzRealmPlayerRegister,
    getEntityIdFromKeys([BigInt(accountAddress)]),
  );

  const { connector } = useAccount();

  const playerRealmEntities = useEntityQuery([HasValue(components.Structure, { owner: BigInt(accountAddress) })]);
  const playerSettled = playerRealmEntities.length > 0;

  useSetAddressName(setup, playerSettled ? account : null, connector);
  const onSpectatorModeClickTop = useSpectatorModeClick(setup);

  const requiresEntryToken = useMemo(() => {
    if (!blitzConfig) return false;
    return hasEntryTokenContract && blitzConfig.fee_amount > 0n;
  }, [blitzConfig, hasEntryTokenContract]);

  const feeAmount = blitzConfig?.fee_amount ?? 0n;
  const feeTokenAddressHex = useMemo(
    () => (blitzConfig && blitzConfig.fee_amount > 0n ? toHexString(blitzConfig.fee_token) : undefined),
    [blitzConfig],
  );

  const feeTokenCall = useCall({
    abi: LordsAbi as Abi,
    functionName: "balance_of",
    address: (feeTokenAddressHex ?? "0x0") as `0x${string}`,
    args: [(accountAddress as `0x${string}`) ?? "0x0"],
    watch: true,
    refetchInterval: 5_000,
    enabled: Boolean(accountAddress && feeTokenAddressHex),
  });

  const feeTokenBalance = useMemo(() => normalizeUint256(feeTokenCall.data), [feeTokenCall.data]);
  const refetchFeeTokenBalance = feeTokenCall.refetch;
  const isFeeBalanceLoading = feeTokenCall.isLoading && Boolean(feeTokenAddressHex);
  const hasSufficientFeeBalance = !requiresEntryToken || feeAmount === 0n || feeTokenBalance >= feeAmount;
  const isNotMainnet = env.VITE_PUBLIC_CHAIN !== "mainnet";

  useEffect(() => {
    if (!requiresEntryToken) {
      setAvailableEntryTokenId(null);
      setEntryTokenStatus("idle");
      setHasQueriedEntryToken(false);
      return;
    }

    if (availableEntryTokenId || hasQueriedEntryToken || entryTokenBalance === 0n) {
      return;
    }

    const maxTokens =
      entryTokenBalance > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(entryTokenBalance);
    const randomIndex = maxTokens > 1 ? BigInt(Math.floor(Math.random() * maxTokens)) : 0n;

    setHasQueriedEntryToken(true);

    (async () => {
      const entryTokenAddressHex = toHexString(blitzConfig?.entry_token_address!);
      console.log("Entry token random lookup", {
        owner: accountAddress,
        entryTokenAddressHex,
        balance: entryTokenBalance.toString(),
        randomIndex: randomIndex.toString(),
      });

      const tokenId = await getEntryTokenIdByIndex(
        accountAddress,
        {
          entryTokenAddress: entryTokenAddressHex as `0x${string}`,
          validate: (candidate) => {
            const registerComponent = components.BlitzEntryTokenRegister;
            if (!registerComponent) return true;
            const registerRecord = getComponentValue(registerComponent, getEntityIdFromKeys([candidate]));
            const available = !registerRecord?.registered;
            if (!available) {
              console.log("Entry token already registered", { tokenId: candidate.toString() });
            }
            return available;
          },
          onDebug: (message, context) => console.debug(`[EntryTokenLookup] ${message}`, context),
        },
        randomIndex,
      );
      console.log("Entry token lookup result", { tokenId: tokenId?.toString() });
      if (tokenId) {
        setAvailableEntryTokenId(tokenId);
        setEntryTokenStatus("idle");
      } else {
        setEntryTokenStatus("timeout");
      }
    })();
  }, [
    accountAddress,
    availableEntryTokenId,
    blitzConfig,
    components.BlitzEntryTokenRegister,
    entryTokenBalance,
    getEntryTokenIdByIndex,
    hasQueriedEntryToken,
    requiresEntryToken,
  ]);

  // Determine current game state based on time
  useEffect(() => {
    if (!blitzConfig) {
      setGameState(GameState.NO_GAME);
      return;
    }

    const { registration_start_at, registration_end_at, creation_start_at, creation_end_at } = blitzConfig;
    const hasValidSchedule =
      registration_start_at > 0 &&
      registration_end_at > registration_start_at &&
      creation_start_at > registration_end_at &&
      creation_end_at >= creation_start_at;

    if (!hasValidSchedule) {
      setGameState(GameState.NO_GAME);
      return;
    }

    const updateGameState = () => {
      const now = Date.now() / 1000;

      if (now >= creation_end_at) {
        setGameState(GameState.NO_GAME);
        return;
      }

      if (now < registration_start_at) {
        setGameState(GameState.NO_GAME);
        return;
      }

      if (now < registration_end_at) {
        setGameState(GameState.REGISTRATION);
        return;
      }

      if (now >= creation_start_at) {
        setGameState(GameState.GAME_ACTIVE);
        return;
      }

      setGameState(GameState.NO_GAME);
    };

    updateGameState();
    const interval = setInterval(updateGameState, 1000);
    return () => clearInterval(interval);
  }, [blitzConfig]);

  useEffect(() => {
    const getUsername = async () => {
      let username;
      try {
        username = await (connector as unknown as ControllerConnector)?.username();
        if (username) {
          setAddressNameFelt(cairoShortStringToFelt(username.slice(0, 31)));
        }
      } catch (error) {
        console.log("No username found in controller account");
        if ((await connector?.chainId()) === 82743958523457n) {
          // local
          setAddressNameFelt("labubu");
        }
      }
    };
    getUsername();
  }, [connector]);

  const handleObtainEntryToken = useCallback(async () => {
    if (!accountAddress || !requiresEntryToken || !blitzConfig) return;

    setIsObtainingEntryToken(true);
    setEntryTokenStatus("minting");
    try {
      if (
        isNotMainnet &&
        networkProvider &&
        masterAccount &&
        feeTokenAddressHex &&
        feeAmount > 0n &&
        feeTokenBalance < feeAmount
      ) {
        const shortfall = feeAmount - feeTokenBalance;
        const amount = uint256.bnToUint256(shortfall);
        await networkProvider.executeAndCheckTransaction(masterAccount, {
          contractAddress: feeTokenAddressHex,
          entrypoint: "transfer",
          calldata: CallData.compile([accountAddress, amount.low, amount.high]),
        });
        await refetchFeeTokenBalance?.();
      }

      await blitz_realm_obtain_entry_token({
        signer: account,
        feeToken: feeTokenAddressHex,
        feeAmount: blitzConfig.fee_amount,
      });

      await refetchEntryTokenBalance?.();
      setAvailableEntryTokenId(null);
      setHasQueriedEntryToken(false);
      setEntryTokenStatus("idle");
    } catch (error) {
      console.error("Failed to obtain entry token", error);
      setEntryTokenStatus("error");
    } finally {
      setIsObtainingEntryToken(false);
    }
  }, [
    account,
    accountAddress,
    blitzConfig,
    blitz_realm_obtain_entry_token,
    feeAmount,
    feeTokenAddressHex,
    feeTokenBalance,
    isNotMainnet,
    masterAccount,
    networkProvider,
    refetchEntryTokenBalance,
    refetchFeeTokenBalance,
    requiresEntryToken,
  ]);

  // Registration handler
  const handleRegister = useCallback(async () => {
    if (!accountAddress) return;

    if (requiresEntryToken && blitzConfig) {
      if (!availableEntryTokenId) {
        throw new Error("No entry token available. Obtain one before registering.");
      }

      await blitz_realm_register({
        signer: account,
        name: addressNameFelt,
        tokenId: Number(availableEntryTokenId),
        entryTokenAddress: toHexString(blitzConfig.entry_token_address),
        lockId: ENTRY_TOKEN_LOCK_ID,
      });

      await refetchEntryTokenBalance?.();
      await refetchFeeTokenBalance?.();
      setAvailableEntryTokenId(null);
      setHasQueriedEntryToken(false);
      setEntryTokenStatus("idle");
      return;
    }

    await blitz_realm_register({ signer: account, name: addressNameFelt, tokenId: 0 });
  }, [
    account,
    accountAddress,
    addressNameFelt,
    availableEntryTokenId,
    blitzConfig,
    blitz_realm_register,
    refetchEntryTokenBalance,
    refetchFeeTokenBalance,
    requiresEntryToken,
  ]);

  const handleMakeHyperstructures = useCallback(async () => {
    if (!accountAddress) return;
    await blitz_realm_make_hyperstructures({ count: 4, signer: account });
  }, [account, accountAddress, blitz_realm_make_hyperstructures]);

  // Settlement handler
  const handleSettle = useCallback(async () => {
    if (!accountAddress) return;
    await blitz_realm_create({ signer: account });
  }, [account, accountAddress, blitz_realm_create]);

  const handleSelectGame = async () => {
    await selectGame();
  };

  if (!blitzConfig) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-brown/10 border border-brown/30 rounded-lg p-6 text-center space-y-4"
      >
        <AlertCircle className="w-12 h-12 mx-auto text-gold/50" />
        <div>
          <h3 className="text-lg font-bold text-gold mb-2">Configuration Error</h3>
          <p className="text-gold/70">Unable to load Blitz game configuration.</p>
          <p className="text-gold/70 text-sm mt-2">Please refresh the page or contact support if the issue persists.</p>
        </div>
        <Button
          onClick={() => window.location.reload()}
          forceUppercase={false}
          className="!bg-gold !text-brown rounded-md"
        >
          Refresh Page
        </Button>
      </motion.div>
    );
  }

  const { registration_start_at, registration_end_at, creation_start_at, creation_end_at } = blitzConfig;
  // Determine if we are in registration phase
  const now = Date.now() / 1000;
  const canMakeHyperstructures = now >= registration_start_at;

  const gameActiveSection =
    gameState === GameState.GAME_ACTIVE ? (
      <GameActiveState
        isRegistered={playerRegistered?.registered || !!playerSettled}
        onSettle={handleSettle}
        hasSettled={!!playerSettled}
        gameEndAt={seasonConfig?.endAt}
      />
    ) : null;

  // Do not show entry-token wallet when the game is active or when player is registered
  // - hides when Play/Settle are visible
  // - hides when user is not registered and can only spectate
  // - hides when player is already registered
  const hideEntryTokenWallet = gameState === GameState.GAME_ACTIVE || playerRegistered?.registered;

  return (
    <div className="space-y-6">
      {/* Navigation Buttons */}
      <div className="flex justify-between items-center -mb-2">
        <Button
          onClick={() => navigate("/")}
          variant="outline"
          size="xs"
          className="!px-3 !py-1.5"
          forceUppercase={false}
        >
          <div className="flex items-center gap-1.5">
            <Home className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </div>
        </Button>

        <Button onClick={handleSelectGame} variant="outline" size="xs" className="!px-3 !py-1.5" forceUppercase={false}>
          <div className="flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5" />
            <span>{activeWorld || "Select Game"}</span>
          </div>
        </Button>
      </div>

      {activeWorld && (
        <div className="text-center mt-1 mb-1">
          <div className="text-gold text-lg font-extrabold tracking-wide">{activeWorld}</div>
          <div className="mt-3 flex justify-center">
            <div className="w-full max-w-xs">
              <SpectateButton onClick={onSpectatorModeClickTop} />
            </div>
          </div>
        </div>
      )}

      {gameActiveSection}
      {!hasGameEnded && requiresEntryToken && !hideEntryTokenWallet && (
        <div className="bg-brown/10 border border-brown/30 rounded-lg p-4">
          <div className="flex items-center justify-between text-gold">
            <p className="text-sm text-gold/70">Entry tokens in your wallet</p>
            <span className="text-lg font-semibold">{entryTokenBalance.toString()}</span>
          </div>
          <p className="text-xs text-gold/60 mt-2">
            Obtain an entry token first; it will be locked automatically when you register.
          </p>

          {feeTokenAddressHex && feeAmount > 0n && (
            <div className="mt-4 space-y-2 rounded-lg bg-brown/20 p-4">
              <div className="flex items-center justify-between text-sm text-gold">
                <span>Registration fee</span>
                <span className="font-semibold">{formatTokenAmount(feeAmount)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gold/70">Your balance</span>
                <span className={hasSufficientFeeBalance ? "text-gold" : "text-red-300"}>
                  {isFeeBalanceLoading ? "…" : formatTokenAmount(feeTokenBalance)}
                </span>
              </div>
              {!hasSufficientFeeBalance && (
                <p className="text-xs text-red-300">
                  your balance will be auto-topped up when you attempt to obtain entry token.
                </p>
              )}
            </div>
          )}
        </div>
      )}
      {
        <MakeHyperstructuresState
          numHyperStructuresLeft={blitzNumHyperStructuresLeft || 0}
          onMakeHyperstructures={handleMakeHyperstructures}
          canMake={canMakeHyperstructures}
        />
      }
      {devMode && (
        <DevOptionsState
          onDevModeRegister={handleRegister}
          onDevModeSettle={handleSettle}
          onDevModeObtainEntryToken={requiresEntryToken ? handleObtainEntryToken : undefined}
          devMode={devMode || false}
        />
      )}
      {gameState === GameState.NO_GAME && registration_start_at && <NoGameState />}
      {gameState === GameState.REGISTRATION && (
        <RegistrationState
          entryTokenBalance={entryTokenBalance}
          registrationCount={registrationCount}
          registrationStartAt={registration_start_at}
          registrationEndAt={registration_end_at}
          creationStartAt={creation_start_at}
          creationEndAt={creation_end_at}
          isRegistered={playerRegistered?.registered || false}
          onRegister={handleRegister}
          requiresEntryToken={requiresEntryToken}
          onObtainEntryToken={requiresEntryToken ? handleObtainEntryToken : undefined}
          isObtainingEntryToken={isObtainingEntryToken}
          availableEntryTokenId={availableEntryTokenId}
          entryTokenStatus={entryTokenStatus}
          hasSufficientFeeBalance={hasSufficientFeeBalance}
          isFeeBalanceLoading={isFeeBalanceLoading}
        />
      )}
      {/* Always show Factory Games list */}
      <div className="bg-gold/10 border border-gold/30 rounded-lg p-4 space-y-3">
        <p className="text-sm text-gold/70">Factory Games</p>
        <FactoryGamesList />
      </div>
    </div>
  );
};
