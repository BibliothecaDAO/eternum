import { ROUTES } from "@/shared/consts/routes";
import { useSetAddressName } from "@/shared/hooks/use-set-address-name";
import { useSyncPlayerStructures } from "@/shared/hooks/use-sync-player-structures";
import { Button } from "@/shared/ui/button";
import {
  configManager,
  ENTRY_TOKEN_LOCK_ID,
  formatTime,
  getEntityIdFromKeys,
  LordsAbi,
  toHexString,
} from "@bibliothecadao/eternum";
import { useDojo, useEntryTokenBalance } from "@bibliothecadao/react";
import { ControllerConnector } from "@cartridge/connector";
import { useComponentValue, useEntityQuery } from "@dojoengine/react";
import { getComponentValue, HasValue } from "@dojoengine/recs";
import { cairoShortStringToFelt } from "@dojoengine/torii-wasm";
import { useAccount, useCall } from "@starknet-react/core";
import { useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { AlertCircle, Eye, Hammer, ShieldCheck, Swords, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Abi, CallData, uint256 } from "starknet";
import { env } from "../../../../env";

// Helper functions to format timestamps
const formatLocalTime = (timestamp: number): string => {
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString([], { weekday: "short", hour: "2-digit", minute: "2-digit" });
};

const formatLocalDateTime = (timestamp: number): string => {
  const date = new Date(timestamp * 1000);
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

enum GameState {
  NO_GAME = "NO_GAME",
  REGISTRATION = "REGISTRATION",
  GAME_ACTIVE = "GAME_ACTIVE",
}

const CountdownTimer = ({ targetTime, label }: { targetTime: number; label: string }) => {
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
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold text-gold">{timeRemaining}</p>
    </div>
  );
};

const PlayerCount = ({ count }: { count: number }) => (
  <div className="flex items-center justify-center gap-2 text-gold">
    <Users className="h-5 w-5" />
    <span className="text-base font-semibold">{count} warriors assembled</span>
  </div>
);

const NoGameState = ({
  registrationStartAt,
  registrationEndAt,
  creationStartAt,
}: {
  registrationStartAt: number;
  registrationEndAt: number;
  creationStartAt: number;
}) => {
  const registrationDuration = registrationEndAt - registrationStartAt;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 text-center">
      <CountdownTimer targetTime={registrationStartAt} label="Registration starts in" />

      <div className="rounded-lg border border-gold/30 bg-gold/10 p-4 space-y-2">
        <p className="text-xs uppercase tracking-wide text-gold/80">⚔️ Upcoming Battle Schedule</p>
        <div className="text-sm space-y-2">
          <div>
            <p className="font-semibold text-gold">🛡️ Registration Phase</p>
            <p className="text-xs text-gold/60">Starts: {formatLocalDateTime(registrationStartAt)}</p>
            <p className="text-xs text-gold/60">Duration: {formatTime(registrationDuration)}</p>
          </div>
          <div>
            <p className="font-semibold text-gold">⚡ Battle Begins</p>
            <p className="text-xs text-gold/50">{formatLocalDateTime(creationStartAt)}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const buttonVariants = {
  idle: { scale: 1, rotate: 0 },
  hover: {
    scale: 1.05,
    rotate: [0, -2, 2, -2, 2, 0],
    transition: { scale: { duration: 0.2 }, rotate: { duration: 0.6, repeat: Infinity } },
  },
  tap: { scale: 0.94, rotate: 0, transition: { duration: 0.12 } },
};

const numberVariants = {
  enter: { scale: 2, opacity: 0, rotate: 180 },
  center: {
    scale: 1,
    opacity: 1,
    rotate: 0,
    transition: { type: "spring", damping: 12, stiffness: 100, duration: 0.8 },
  },
  breathing: {
    scale: [1, 1.05, 1],
    y: [0, -2, 0],
    transition: { duration: 1.8, repeat: Infinity, ease: "easeInOut" },
  },
};

const rippleVariants = {
  pulse: {
    scale: [1, 1.5, 1],
    opacity: [0.6, 0, 0.6],
    transition: { duration: 2, repeat: Infinity, ease: "easeOut" },
  },
};

const HyperstructureForgeButton = ({
  count,
  isLoading,
  onClick,
}: {
  count: number;
  isLoading: boolean;
  onClick: () => void;
}) => (
  <motion.button
    onClick={onClick}
    disabled={isLoading}
    variants={buttonVariants}
    initial="idle"
    whileHover="hover"
    whileTap="tap"
    className="relative h-24 w-24 rounded-full focus:outline-none focus:ring-4 focus:ring-yellow-300/50 disabled:cursor-not-allowed disabled:opacity-50"
    style={{
      background: "radial-gradient(circle at 30% 30%, #facc15, #ca8a04, #f59e0b)",
      boxShadow:
        "0 8px 32px rgba(251, 191, 36, 0.4), inset 0 2px 8px rgba(255, 255, 255, 0.4), inset 0 -2px 8px rgba(0, 0, 0, 0.1)",
      border: "4px solid #fef3c7",
    }}
  >
    <motion.div
      className="absolute inset-0 rounded-full border-2 border-yellow-200"
      variants={rippleVariants}
      animate="pulse"
    />
    <div className="relative flex h-full flex-col items-center justify-center space-y-1 text-brown">
      <Hammer className="h-8 w-8" />
      <motion.span
        key={count}
        variants={numberVariants}
        initial="enter"
        animate="center"
        className="text-lg font-bold tracking-tight"
      >
        {count}
      </motion.span>
      <span className="text-xs font-semibold uppercase">to forge</span>
    </div>
    {isLoading && (
      <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30">
        <img src="/images/logos/eternum-loader.apng" className="h-5 w-5" />
      </div>
    )}
  </motion.button>
);

const MakeHyperstructuresState = ({
  numHyperStructuresLeft,
  onMakeHyperstructures,
  canMake,
}: {
  numHyperStructuresLeft: number;
  onMakeHyperstructures: () => Promise<void>;
  canMake: boolean;
}) => {
  const [isMakingHyperstructures, setIsMakingHyperstructures] = useState(false);
  const [currentLeft, setCurrentLeft] = useState(numHyperStructuresLeft);

  useEffect(() => {
    setCurrentLeft(numHyperStructuresLeft);
  }, [numHyperStructuresLeft]);

  useEffect(() => {
    const interval = setInterval(() => {
      const latest = configManager.getBlitzConfig()?.blitz_num_hyperstructures_left;
      if (typeof latest === "number") {
        setCurrentLeft(latest);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const handleMake = async () => {
    setIsMakingHyperstructures(true);
    try {
      await onMakeHyperstructures();
    } catch (error) {
      console.error("Make hyperstructures failed", error);
    } finally {
      setIsMakingHyperstructures(false);
    }
  };

  if (!canMake || currentLeft <= 0) {
    return null;
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <h3 className="text-sm font-semibold text-gold">🔨 Forge Hyperstructures</h3>
        <p className="text-xs text-muted-foreground">Secure your late-game dominance before battle begins!</p>
      </motion.div>

      <HyperstructureForgeButton count={currentLeft} isLoading={isMakingHyperstructures} onClick={handleMake} />
    </div>
  );
};

const RegistrationState = ({
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
  hasSufficientFeeBalance,
  isFeeBalanceLoading,
}: {
  entryTokenBalance: bigint;
  registrationCount: number;
  registrationEndAt: number;
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
  const [isRegistering, setIsRegistering] = useState(false);
  const navigate = useNavigate();

  const tokenReady = !requiresEntryToken || Boolean(availableEntryTokenId);

  const handleRegister = async () => {
    setIsRegistering(true);
    try {
      await onRegister();
    } catch (error) {
      console.error("Registration failed", error);
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="space-y-3 text-center">
        <h3 className="text-lg font-semibold text-gold">⚔️ Join the Battle!</h3>
        <PlayerCount count={registrationCount} />
        <CountdownTimer targetTime={registrationEndAt} label="Registration closes in" />
      </div>

      {isRegistered ? (
        <div className="rounded-lg border border-gold/30 bg-gold/10 p-4 text-center">
          <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-gold" />
          <p className="font-medium text-gold">🛡️ You're ready for battle!</p>
          <p className="mt-1 text-sm text-gold/70">Prepare yourself, warrior. The fight begins soon.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requiresEntryToken && (
            <div className="space-y-2">
              <Button
                onClick={() => onObtainEntryToken?.()}
                disabled={isObtainingEntryToken}
                variant="secondary"
                className="w-full"
              >
                {isObtainingEntryToken ? (
                  <div className="flex items-center justify-center gap-2">
                    <img src="/images/logos/eternum-loader.apng" className="h-5 w-5" />
                    <span>Minting entry token...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <Hammer className="h-5 w-5" />
                    <span>Forge Entry Token</span>
                  </div>
                )}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                {availableEntryTokenId
                  ? `Token #${availableEntryTokenId.toString()} is ready. Proceed to register.`
                  : entryTokenStatus === "minting"
                    ? "Minting your entry token..."
                    : entryTokenStatus === "timeout"
                      ? "Minted! Still waiting for the token to appear. If it doesn't show, try again shortly."
                      : entryTokenStatus === "error"
                        ? "Mint failed. Please try again."
                        : "Mint an entry token before registering. We'll lock it automatically when you join."}
              </p>
              {requiresEntryToken && entryTokenBalance < 1 && (
                <p className="text-center text-[10px] text-red-300">Top up your balance before registering.</p>
              )}
            </div>
          )}

          <Button onClick={handleRegister} disabled={isRegistering || !tokenReady} className="w-full">
            {isRegistering ? (
              <div className="flex items-center justify-center gap-2">
                <img src="/images/logos/eternum-loader.apng" className="h-5 w-5" />
                <span>Registering...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <Swords className="h-5 w-5" />
                <span>⚔️ Enter the Arena</span>
              </div>
            )}
          </Button>
          {requiresEntryToken && isFeeBalanceLoading && (
            <p className="text-center text-xs text-muted-foreground">Checking fee balance…</p>
          )}
        </div>
      )}

      <SpectateButton onClick={() => navigate({ to: ROUTES.WORLDMAP })} />
    </motion.div>
  );
};

const GameActiveState = ({
  hasSettled,
  isRegistered,
  gameEndAt,
  onSettle,
}: {
  hasSettled: boolean;
  isRegistered: boolean;
  gameEndAt?: number;
  onSettle: () => Promise<void>;
}) => {
  const [isSettling, setIsSettling] = useState(false);
  const navigate = useNavigate();

  const handleSettle = async () => {
    setIsSettling(true);
    try {
      await onSettle();
    } catch (error) {
      console.error("Settlement failed", error);
    } finally {
      setIsSettling(false);
    }
  };

  const onPlay = () => {
    navigate({ to: ROUTES.HOME });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="space-y-2 text-center">
        <h3 className="text-lg font-semibold text-gold">⚡ Game Active!</h3>
        {gameEndAt && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Victory deadline: {formatLocalTime(gameEndAt)}</p>
            <p className="text-sm font-semibold text-gold">🏆 Conquer everything!</p>
          </div>
        )}
      </div>

      {isRegistered ? (
        hasSettled ? (
          <div className="space-y-3">
            <Button onClick={onPlay} className="w-full">
              <div className="flex items-center justify-center gap-2">
                <span>⚡ Play Blitz</span>
              </div>
            </Button>
            <SpectateButton onClick={() => navigate({ to: ROUTES.WORLDMAP })} />
          </div>
        ) : (
          <div className="space-y-3">
            <Button onClick={handleSettle} disabled={isSettling} className="w-full">
              {isSettling ? (
                <div className="flex items-center justify-center gap-2">
                  <img src="/images/logos/eternum-loader.apng" className="h-5 w-5" />
                  <span>Settling...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <span>🏰 Settle Your Kingdom</span>
                </div>
              )}
            </Button>
            <SpectateButton onClick={() => navigate({ to: ROUTES.WORLDMAP })} />
          </div>
        )
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-gold/30 bg-brown/10 p-4 text-center">
            <p className="text-sm text-gold/70">⚠️ You missed the call to arms for this battle.</p>
          </div>
          <SpectateButton onClick={() => navigate({ to: ROUTES.WORLDMAP })} />
        </div>
      )}
    </motion.div>
  );
};

const DevOptionsState = ({
  devMode,
  onDevModeRegister,
  onDevModeSettle,
}: {
  devMode: boolean;
  onDevModeRegister: () => Promise<void>;
  onDevModeSettle: () => Promise<void>;
}) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [isSettling, setIsSettling] = useState(false);

  if (!devMode) {
    return null;
  }

  const handleRegister = async () => {
    setIsRegistering(true);
    try {
      await onDevModeRegister();
    } catch (error) {
      console.error("Dev register failed", error);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleSettle = async () => {
    setIsSettling(true);
    try {
      await onDevModeSettle();
    } catch (error) {
      console.error("Dev settle failed", error);
    } finally {
      setIsSettling(false);
    }
  };

  return (
    <div className="rounded-lg border border-dashed border-gold/40 bg-gold/5 p-4 space-y-2 text-sm text-gold/80">
      <p className="font-medium text-gold">Dev Helpers</p>
      <div className="flex flex-col gap-2">
        <Button onClick={handleRegister} disabled={isRegistering} variant="secondary">
          {isRegistering ? "Registering..." : "Force Register"}
        </Button>
        <Button onClick={handleSettle} disabled={isSettling} variant="secondary">
          {isSettling ? "Settling..." : "Force Settle"}
        </Button>
      </div>
    </div>
  );
};

const SpectateButton = ({ onClick }: { onClick: () => void }) => (
  <Button onClick={onClick} className="w-full" variant="secondary">
    <div className="flex items-center justify-center gap-2">
      <Eye className="h-5 w-5" />
      <span>Spectate</span>
    </div>
  </Button>
);

export const BlitzOnboarding = () => {
  const navigate = useNavigate();
  useSyncPlayerStructures();
  const [gameState, setGameState] = useState<GameState>(GameState.NO_GAME);
  const [addressNameFelt, setAddressNameFelt] = useState<string>("");

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

  const { connector } = useAccount();
  const blitzConfig = configManager.getBlitzConfig()?.blitz_registration_config;
  const blitzNumHyperStructuresLeft = configManager.getBlitzConfig()?.blitz_num_hyperstructures_left;
  const seasonConfig = configManager.getSeasonConfig();
  const devMode = configManager.getDevModeConfig()?.dev_mode_on ?? false;
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
  const [isToppingUp, setIsToppingUp] = useState(false);

  const accountOwner = account?.address ? BigInt(account.address) : 0n;

  const playerRegistered = useComponentValue(components.BlitzRealmPlayerRegister, getEntityIdFromKeys([accountOwner]));

  const playerStructures = useEntityQuery([HasValue(components.Structure, { owner: accountOwner })]);

  const playerSettled = useMemo(() => {
    return playerStructures.length > 0;
  }, [playerStructures]);

  useSetAddressName(setup, playerSettled ? account : null, (connector as ControllerConnector) ?? null);

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
    args: [(account?.address as `0x${string}`) ?? "0x0"],
    watch: true,
    refetchInterval: 5_000,
    enabled: Boolean(account?.address && feeTokenAddressHex),
  });

  const feeTokenBalance = useMemo(() => normalizeUint256(feeTokenCall.data), [feeTokenCall.data]);
  const refetchFeeTokenBalance = feeTokenCall.refetch ? () => feeTokenCall.refetch() : undefined;
  const isFeeBalanceLoading = feeTokenCall.isLoading && Boolean(feeTokenAddressHex);
  const hasSufficientFeeBalance = !requiresEntryToken || feeAmount === 0n || feeTokenBalance >= feeAmount;
  const feeBalanceShortfall = feeAmount > feeTokenBalance ? feeAmount - feeTokenBalance : 0n;
  const isLocalChain = env.VITE_PUBLIC_CHAIN === "local";
  const canTopUpBalance = Boolean(!isLocalChain && feeTokenAddressHex && masterAccount);

  const formatTokenAmount = (value: bigint) => value.toString();

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
      const entryTokenAddressHex = toHexString(blitzConfig?.entry_token_address ?? 0n);
      console.log("[Mobile] Entry token random lookup", {
        owner: account.address,
        entryTokenAddressHex,
        balance: entryTokenBalance.toString(),
        randomIndex: randomIndex.toString(),
      });

      const tokenId = await getEntryTokenIdByIndex(
        account.address,
        {
          entryTokenAddress: entryTokenAddressHex as `0x${string}`,
          validate: (candidate) => {
            const registerComponent = components.BlitzEntryTokenRegister;
            if (!registerComponent) return true;
            const registerRecord = getComponentValue(registerComponent, getEntityIdFromKeys([candidate]));
            const available = !registerRecord?.registered;
            if (!available) {
              console.log("[Mobile] Entry token already registered", { tokenId: candidate.toString() });
            }
            return available;
          },
          onDebug: (message, context) => console.debug(`[Mobile EntryTokenLookup] ${message}`, context),
        },
        randomIndex,
      );

      if (tokenId) {
        setAvailableEntryTokenId(tokenId);
        setEntryTokenStatus("idle");
      } else {
        setEntryTokenStatus("timeout");
      }
    })();
  }, [
    account.address,
    availableEntryTokenId,
    blitzConfig,
    components.BlitzEntryTokenRegister,
    entryTokenBalance,
    getEntryTokenIdByIndex,
    hasQueriedEntryToken,
    requiresEntryToken,
  ]);

  useEffect(() => {
    if (!blitzConfig) return;

    const updateGameState = () => {
      const now = Date.now() / 1000;

      if (now < blitzConfig.registration_start_at) {
        setGameState(GameState.NO_GAME);
      } else if (now >= blitzConfig.registration_start_at && now < blitzConfig.registration_end_at) {
        setGameState(GameState.REGISTRATION);
      } else if (now >= blitzConfig.creation_start_at) {
        setGameState(GameState.GAME_ACTIVE);
      }
    };

    updateGameState();
    const interval = setInterval(updateGameState, 1000);
    return () => clearInterval(interval);
  }, [blitzConfig]);

  useEffect(() => {
    const getUsername = async () => {
      let username: string | undefined;
      try {
        username = await (connector as unknown as ControllerConnector | undefined)?.username();
        if (username) {
          setAddressNameFelt(cairoShortStringToFelt(username.slice(0, 31)));
          return;
        }
      } catch (error) {
        console.log("No username found in controller account", error);
      }

      try {
        const chainId = await (connector as ControllerConnector | undefined)?.chainId?.();
        if (chainId === 82743958523457n) {
          setAddressNameFelt("labubu");
        }
      } catch (error) {
        console.log("Unable to read controller chainId", error);
      }
    };

    void getUsername();
  }, [connector]);

  const handleObtainEntryToken = async () => {
    if (!account?.address || !requiresEntryToken || !blitzConfig) return;

    setIsObtainingEntryToken(true);
    setEntryTokenStatus("minting");
    try {
      const feeTokenAddressHex = toHexString(blitzConfig.fee_token);
      await blitz_realm_obtain_entry_token({
        signer: account,
        feeToken: feeTokenAddressHex,
        feeAmount: blitzConfig.fee_amount,
      });
      await refetchEntryTokenBalance?.();
      setAvailableEntryTokenId(null);
      setHasQueriedEntryToken(false);
      setEntryTokenStatus("idle");
      await refetchFeeTokenBalance?.();
    } catch (error) {
      console.error("Failed to obtain entry token", error);
      setEntryTokenStatus("error");
    } finally {
      setIsObtainingEntryToken(false);
    }
  };

  const handleTopUpFeeBalance = async () => {
    if (!masterAccount || !network?.provider || !account?.address || !feeTokenAddressHex || feeAmount === 0n) {
      return;
    }

    setIsToppingUp(true);
    try {
      const amount = uint256.bnToUint256(feeAmount);
      await network.provider.executeAndCheckTransaction(masterAccount, {
        contractAddress: feeTokenAddressHex,
        entrypoint: "transfer",
        calldata: CallData.compile([account.address, amount.low, amount.high]),
      });

      await refetchFeeTokenBalance?.();
      setHasQueriedEntryToken(false);
    } catch (error) {
      console.error("[Mobile] Failed to top up registration fee balance", error);
    } finally {
      setIsToppingUp(false);
    }
  };

  const handleRegister = async () => {
    if (!account?.address) return;

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
  };

  const handleMakeHyperstructures = async () => {
    if (!account?.address) return;
    await blitz_realm_make_hyperstructures({ count: 4, signer: account });
  };

  const handleSettle = async () => {
    if (!account?.address) return;
    await blitz_realm_create({ signer: account });
    navigate({ to: ROUTES.HOME });
  };

  if (!blitzConfig) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-3 rounded-lg border border-brown/30 bg-brown/10 p-4 text-center"
      >
        <AlertCircle className="mx-auto h-10 w-10 text-gold/60" />
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-gold">⚠️ Battle System Offline</h3>
          <p className="text-sm text-gold/70">Unable to connect to the arena. Refresh to rejoin the fight!</p>
        </div>
        <Button onClick={() => window.location.reload()} className="bg-gold text-brown hover:bg-gold/90">
          ⚡ Reconnect to Arena
        </Button>
      </motion.div>
    );
  }

  const { registration_start_at, registration_end_at, creation_start_at } = blitzConfig;
  const now = Date.now() / 1000;
  const canMakeHyperstructures = now >= registration_start_at;

  return (
    <div className="space-y-6">
      {hasEntryTokenContract && (
        <div className="rounded-lg border border-border/40 bg-gold/5 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Entry tokens</span>
            <span className="text-lg font-semibold text-gold">{entryTokenBalance.toString()}</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Obtain an entry token before registering; we lock it for you during registration.
          </p>

          {feeTokenAddressHex && feeAmount > 0n && (
            <div className="mt-4 space-y-2 rounded-lg bg-gold/10 p-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Registration fee</span>
                <span className="text-sm font-semibold text-gold">{formatTokenAmount(feeAmount)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Your balance</span>
                <span className={hasSufficientFeeBalance ? "text-gold text-sm" : "text-red-300 text-sm"}>
                  {isFeeBalanceLoading ? "…" : formatTokenAmount(feeTokenBalance)}
                </span>
              </div>
              {!hasSufficientFeeBalance && (
                <p className="text-[10px] text-red-300">Top balance to cover entry token fee.</p>
              )}
              {canTopUpBalance && !hasSufficientFeeBalance && (
                <Button onClick={handleTopUpFeeBalance} disabled={isToppingUp} variant="secondary" className="w-full">
                  {isToppingUp ? "Topping up…" : "Top up balance"}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
      <MakeHyperstructuresState
        numHyperStructuresLeft={blitzNumHyperStructuresLeft || 0}
        onMakeHyperstructures={handleMakeHyperstructures}
        canMake={canMakeHyperstructures}
      />

      <DevOptionsState devMode={devMode} onDevModeRegister={handleRegister} onDevModeSettle={handleSettle} />

      {gameState === GameState.NO_GAME && (
        <NoGameState
          registrationStartAt={registration_start_at}
          registrationEndAt={registration_end_at}
          creationStartAt={creation_start_at}
        />
      )}

      {gameState === GameState.REGISTRATION && (
        <RegistrationState
          entryTokenBalance={entryTokenBalance}
          registrationCount={blitzConfig.registration_count}
          registrationEndAt={registration_end_at}
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

      {gameState === GameState.GAME_ACTIVE && (
        <GameActiveState
          hasSettled={playerSettled}
          isRegistered={playerRegistered?.registered || playerSettled}
          gameEndAt={seasonConfig?.endAt}
          onSettle={handleSettle}
        />
      )}
    </div>
  );
};
