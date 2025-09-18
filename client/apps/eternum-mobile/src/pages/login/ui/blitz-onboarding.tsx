import { ROUTES } from "@/shared/consts/routes";
import { useSetAddressName } from "@/shared/hooks/use-set-address-name";
import { useSyncPlayerStructures } from "@/shared/hooks/use-sync-player-structures";
import { Button } from "@/shared/ui/button";
import { configManager, formatTime, getEntityIdFromKeys } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ControllerConnector } from "@cartridge/connector";
import { useComponentValue, useEntityQuery } from "@dojoengine/react";
import { HasValue } from "@dojoengine/recs";
import { cairoShortStringToFelt } from "@dojoengine/torii-wasm";
import { useAccount } from "@starknet-react/core";
import { useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { AlertCircle, Eye, Hammer, ShieldCheck, Swords, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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
    <span className="text-base font-semibold">{count} players registered</span>
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
        <p className="text-xs uppercase tracking-wide text-gold/80">Upcoming Schedule</p>
        <div className="text-sm space-y-2">
          <div>
            <p className="font-semibold text-gold">Registration Phase</p>
            <p className="text-xs text-gold/60">Starts: {formatLocalDateTime(registrationStartAt)}</p>
            <p className="text-xs text-gold/60">Duration: {formatTime(registrationDuration)}</p>
          </div>
          <div>
            <p className="font-semibold text-gold">Game Launch</p>
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
      <span className="text-xs font-semibold uppercase">left</span>
    </div>
    {isLoading && (
      <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30">
        <img src="/images/logos/eternum-loader.png" className="h-5 w-5 animate-spin" />
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
        <h3 className="text-sm font-semibold text-gold">Forge Hyperstructures</h3>
        <p className="text-xs text-muted-foreground">Secure your late-game edge before the match starts.</p>
      </motion.div>

      <HyperstructureForgeButton count={currentLeft} isLoading={isMakingHyperstructures} onClick={handleMake} />
    </div>
  );
};

const RegistrationState = ({
  registrationCount,
  registrationEndAt,
  isRegistered,
  onRegister,
}: {
  registrationCount: number;
  registrationEndAt: number;
  isRegistered: boolean;
  onRegister: () => Promise<void>;
}) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const navigate = useNavigate();

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
        <h3 className="text-lg font-semibold text-gold">Registration Open</h3>
        <PlayerCount count={registrationCount} />
        <CountdownTimer targetTime={registrationEndAt} label="Registration closes in" />
      </div>

      {isRegistered ? (
        <div className="rounded-lg border border-gold/30 bg-gold/10 p-4 text-center">
          <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-gold" />
          <p className="font-medium text-gold">You are registered!</p>
          <p className="mt-1 text-sm text-gold/70">Kick back until the match begins.</p>
        </div>
      ) : (
        <Button onClick={handleRegister} disabled={isRegistering} className="w-full">
          {isRegistering ? (
            <div className="flex items-center justify-center gap-2">
              <img src="/images/logos/eternum-loader.png" className="h-5 w-5 animate-spin" />
              <span>Registering...</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <Swords className="h-5 w-5" />
              <span>Register for Blitz</span>
            </div>
          )}
        </Button>
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
        <h3 className="text-lg font-semibold text-gold">Game Active</h3>
        {gameEndAt && <p className="text-xs text-muted-foreground">Ends {formatLocalTime(gameEndAt)}</p>}
      </div>

      {isRegistered ? (
        hasSettled ? (
          <div className="space-y-3">
            <Button onClick={onPlay} className="w-full">
              <div className="flex items-center justify-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                <span>Play Blitz</span>
              </div>
            </Button>
            <SpectateButton onClick={() => navigate({ to: ROUTES.WORLDMAP })} />
          </div>
        ) : (
          <div className="space-y-3">
            <Button onClick={handleSettle} disabled={isSettling} className="w-full">
              {isSettling ? (
                <div className="flex items-center justify-center gap-2">
                  <img src="/images/logos/eternum-loader.png" className="h-5 w-5 animate-spin" />
                  <span>Settling...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  <span>Settle Realm</span>
                </div>
              )}
            </Button>
            <SpectateButton onClick={() => navigate({ to: ROUTES.WORLDMAP })} />
          </div>
        )
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-gold/30 bg-brown/10 p-4 text-center">
            <p className="text-sm text-gold/70">You are not registered for this game.</p>
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

  const {
    setup,
    setup: {
      account: { account },
      components,
      systemCalls: { blitz_realm_register, blitz_realm_create, blitz_realm_make_hyperstructures },
    },
  } = useDojo();

  const { connector } = useAccount();
  const blitzConfig = configManager.getBlitzConfig()?.blitz_registration_config;
  const blitzNumHyperStructuresLeft = configManager.getBlitzConfig()?.blitz_num_hyperstructures_left;
  const seasonConfig = configManager.getSeasonConfig();
  const devMode = configManager.getDevModeConfig()?.dev_mode_on ?? false;

  const accountOwner = account?.address ? BigInt(account.address) : 0n;

  const playerRegistered = useComponentValue(components.BlitzRealmPlayerRegister, getEntityIdFromKeys([accountOwner]));

  const playerStructures = useEntityQuery([HasValue(components.Structure, { owner: accountOwner })]);

  const playerSettled = useMemo(() => {
    return playerStructures.length > 0;
  }, [playerStructures]);

  useSetAddressName(setup, playerSettled ? account : null, (connector as ControllerConnector) ?? null);

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

  const handleRegister = async () => {
    if (!account?.address) return;
    await blitz_realm_register({ owner: account.address, signer: account, name: addressNameFelt });
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
          <h3 className="text-base font-semibold text-gold">Configuration Error</h3>
          <p className="text-sm text-gold/70">Unable to load Blitz configuration. Please refresh and try again.</p>
        </div>
        <Button onClick={() => window.location.reload()} className="bg-gold text-brown hover:bg-gold/90">
          Refresh
        </Button>
      </motion.div>
    );
  }

  const { registration_start_at, registration_end_at, creation_start_at } = blitzConfig;
  const now = Date.now() / 1000;
  const canMakeHyperstructures = now >= registration_start_at;

  return (
    <div className="space-y-6">
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
          registrationCount={blitzConfig.registration_count}
          registrationEndAt={registration_end_at}
          isRegistered={playerRegistered?.registered || false}
          onRegister={handleRegister}
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
