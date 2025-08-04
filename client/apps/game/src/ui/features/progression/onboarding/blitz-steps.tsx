import { ReactComponent as Sword } from "@/assets/icons/sword.svg";
import { ReactComponent as TreasureChest } from "@/assets/icons/treasure-chest.svg";
import { useGoToStructure, useSpectatorModeClick } from "@/hooks/helpers/use-navigate";
import { useSetAddressName } from "@/hooks/helpers/use-set-address-name";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { Position } from "@/types/position";
import Button from "@/ui/design-system/atoms/button";
import { configManager, formatTime, getEntityIdFromKeys } from "@bibliothecadao/eternum";
import { useDojo, usePlayerOwnedRealmEntities } from "@bibliothecadao/react";
import { ControllerConnector } from "@cartridge/connector";
import { useComponentValue, useEntityQuery } from "@dojoengine/react";
import { getComponentValue, HasValue } from "@dojoengine/recs";
import { cairoShortStringToFelt } from "@dojoengine/torii-wasm";
import { useAccount } from "@starknet-react/core";
import { motion } from "framer-motion";
import { AlertCircle, Clock, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { SpectateButton } from "./spectate-button";

// Helper function to format timestamp to local time
const formatLocalTime = (timestamp: number): string => {
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const formatLocalDateTime = (timestamp: number): string => {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Game state enum
enum GameState {
  NO_GAME = "NO_GAME",
  REGISTRATION = "REGISTRATION",
  SETTLEMENT = "SETTLEMENT",
  GAME_ACTIVE = "GAME_ACTIVE",
}

// Countdown timer component
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
      <p className="text-sm text-gold/70">{label}</p>
      <p className="text-2xl font-bold text-gold">{timeRemaining}</p>
    </div>
  );
};

// Player count display
const PlayerCount = ({ count }: { count: number }) => {
  return (
    <div className="flex items-center justify-center gap-2 text-gold">
      <Users className="w-5 h-5" />
      <span className="text-lg font-semibold">{count} players registered</span>
    </div>
  );
};

// No game state component
const NoGameState = ({
  registrationStartAt,
  registrationEndAt,
  creationStartAt,
  creationEndAt,
}: {
  registrationStartAt: number;
  registrationEndAt: number;
  creationStartAt: number;
  creationEndAt: number;
}) => {
  const registrationDuration = registrationEndAt - registrationStartAt;
  const settlementDuration = creationEndAt - creationStartAt;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 text-center">
      <div className="py-8">
        <Clock className="w-16 h-16 mx-auto text-gold/50 mb-4" />
        <h3 className="text-xl font-bold text-gold mb-2">No Active Game</h3>
        <p className="text-gold/70">The next Blitz game will start soon!</p>
      </div>

      <CountdownTimer targetTime={registrationStartAt} label="Next game starts in:" />

      <div className="bg-gold/10 border border-gold/30 rounded-lg p-4 space-y-3">
        <p className="text-sm text-gold/70">Upcoming Schedule:</p>
        <div className="text-sm space-y-2">
          <div>
            <p className="text-gold">Registration Phase</p>
            <p className="text-gold/60 text-xs">Starts: {formatLocalDateTime(registrationStartAt)}</p>
            <p className="text-gold/60 text-xs">Duration: {formatTime(registrationDuration)}</p>
          </div>
          <div>
            <p className="text-gold/70">Settlement Phase</p>
            <p className="text-gold/50 text-xs">Starts: {formatLocalDateTime(creationStartAt)}</p>
            <p className="text-gold/50 text-xs">Duration: {formatTime(settlementDuration)}</p>
          </div>
          <div>
            <p className="text-gold/70">Game Starts</p>
            <p className="text-gold/50 text-xs">{formatLocalDateTime(creationEndAt)}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// Make hyperstructures state component
const MakeHyperstructuresState = ({
  numHyperStructuresLeft,
  onMakeHyperstructures,
}: {
  numHyperStructuresLeft: number;
  onMakeHyperstructures: () => Promise<void>;
}) => {
  const [isMakingHyperstructures, setIsMakingHyperstructures] = useState(false);
  const handleMakeHyperstructures = async () => {
    setIsMakingHyperstructures(true);
    try {
      await onMakeHyperstructures();
    } catch (error) {
      console.error("Make hyperstructures failed:", error);
    } finally {
      setIsMakingHyperstructures(false);
    }
  };

  return (
    <>
      {numHyperStructuresLeft > 0 && (
        <Button
          onClick={handleMakeHyperstructures}
          disabled={isMakingHyperstructures}
          className="w-full h-12 !text-brown !bg-gold !normal-case rounded-md animate-pulse"
        >
          <div className="flex items-center justify-center">
            {isMakingHyperstructures ? (
              <div className="flex items-center justify-center">
                <img src="/images/logos/eternum-loader.png" className="w-5 h-5 mr-2 animate-spin" />
                <span>...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <Sword className="w-5 h-5 mr-2 fill-brown" />
                <span>Make Hyperstructures [{numHyperStructuresLeft} left]</span>
              </div>
            )}
          </div>
        </Button>
      )}
    </>
  );
};

// Registration state component
const RegistrationState = ({
  registrationCount,
  registrationStartAt,
  registrationEndAt,
  creationStartAt,
  creationEndAt,
  isRegistered,
  onRegister,
}: {
  registrationCount: number;
  registrationStartAt: number;
  registrationEndAt: number;
  creationStartAt: number;
  creationEndAt: number;
  isRegistered: boolean;
  onRegister: () => Promise<void>;
}) => {
  const {
    setup: { components },
  } = useDojo();

  const [isRegistering, setIsRegistering] = useState(false);
  const onSpectatorModeClick = useSpectatorModeClick(components);

  // Calculate phase durations
  const registrationDuration = registrationEndAt - registrationStartAt;
  const settlementDuration = creationEndAt - creationStartAt;

  const handleRegister = async () => {
    setIsRegistering(true);
    try {
      await onRegister();
    } catch (error) {
      console.error("Registration failed:", error);
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="text-center space-y-4">
        <h3 className="text-xl font-bold text-gold">Registration Open</h3>
        <PlayerCount count={registrationCount} />
        <CountdownTimer targetTime={registrationEndAt} label="Registration closes in:" />

        <div className="bg-gold/10 border border-gold/30 rounded-lg p-3 text-sm space-y-2">
          <div>
            <p className="text-gold/70">Current Phase Duration: {formatTime(registrationDuration)}</p>
            <p className="text-gold/60 text-xs">Ends at: {formatLocalTime(registrationEndAt)}</p>
          </div>
          <div>
            <p className="text-gold/70">Next: Settlement phase</p>
            <p className="text-gold/60 text-xs">
              Starts at: {formatLocalTime(creationStartAt)} ({formatTime(settlementDuration)})
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {isRegistered ? (
          <div className="bg-gold/10 border border-gold/30 rounded-lg p-4 text-center">
            <TreasureChest className="w-8 h-8 mx-auto mb-2 fill-gold" />
            <p className="text-gold font-medium">You are registered!</p>
            <p className="text-sm text-gold/70 mt-1">Wait for the settlement phase to begin</p>
          </div>
        ) : (
          <Button
            onClick={handleRegister}
            disabled={isRegistering}
            className="w-full h-12 !text-brown !bg-gold !normal-case rounded-md animate-pulse"
          >
            {isRegistering ? (
              <div className="flex items-center justify-center">
                <img src="/images/logos/eternum-loader.png" className="w-5 h-5 mr-2 animate-spin" />
                <span>Registering...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <Sword className="w-5 h-5 mr-2 fill-brown" />
                <span>Register for Blitz</span>
              </div>
            )}
          </Button>
        )}

        <SpectateButton onClick={onSpectatorModeClick} />
      </div>
    </motion.div>
  );
};

// Settlement state component
const SettlementState = ({
  creationStartAt,
  creationEndAt,
  isRegistered,
  hasSettled,
  onSettle,
}: {
  creationStartAt: number;
  creationEndAt: number;
  isRegistered: boolean;
  hasSettled: boolean;
  onSettle: () => Promise<void>;
}) => {
  const {
    setup: { components },
  } = useDojo();

  const [isSettling, setIsSettling] = useState(false);

  const goToStructure = useGoToStructure();
  const realmEntities = usePlayerOwnedRealmEntities();
  const onSpectatorModeClick = useSpectatorModeClick(components);

  const handleSettle = async () => {
    setIsSettling(true);
    try {
      await onSettle();
    } catch (error) {
      console.error("Settlement failed:", error);
    } finally {
      setIsSettling(false);
    }
  };

  const handlePlay = () => {
    const firstRealm = realmEntities[0];
    if (!firstRealm) return;

    const structure = getComponentValue(components.Structure, firstRealm);
    if (!structure) return;

    goToStructure(structure.entity_id, new Position({ x: structure.base.coord_x, y: structure.base.coord_y }), false);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="text-center space-y-4">
        <h3 className="text-xl font-bold text-gold">Settlement Phase</h3>
        <CountdownTimer targetTime={creationEndAt} label="Settlement phase ends in:" />

        <div className="bg-gold/10 border border-gold/30 rounded-lg p-3 text-sm space-y-2">
          <div>
            <p className="text-gold/70">Current Phase Duration: {formatTime(creationEndAt - creationStartAt)}</p>
            <p className="text-gold/60 text-xs">Ends at: {formatLocalTime(creationEndAt)}</p>
          </div>
          <p className="text-gold/70">Game starts at: {formatLocalTime(creationEndAt)}</p>
          <p className="text-gold font-semibold">⚡ Settle quickly to secure your spot!</p>
        </div>
      </div>

      {isRegistered ? (
        <div className="space-y-4">
          {hasSettled ? (
            <>
              <div className="bg-gold/10 border border-gold/30 rounded-lg p-4 text-center">
                <TreasureChest className="w-8 h-8 mx-auto mb-2 fill-gold" />
                <p className="text-gold font-medium">Settlement Complete!</p>
                <p className="text-sm text-gold/70 mt-1">Wait for the settlement phase to finish before playing</p>
              </div>

              <Button
                disabled={true}
                onClick={handlePlay}
                className="w-full h-12 !text-brown !bg-gold !normal-case rounded-md"
              >
                <div className="flex items-center justify-center">
                  <Sword className="w-5 h-5 mr-2 fill-brown" />
                  <span>Play Blitz</span>
                </div>
              </Button>
            </>
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
                className="w-full h-12 !text-brown !bg-gold !normal-case rounded-md animate-pulse"
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

          <SpectateButton onClick={onSpectatorModeClick} />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-brown/10 border border-brown/30 rounded-lg p-4 text-center">
            <p className="text-gold/70">You are not registered for this game</p>
          </div>
          <SpectateButton onClick={onSpectatorModeClick} />
        </div>
      )}
    </motion.div>
  );
};

// Game active state component
const GameActiveState = ({ hasSettled, gameEndAt }: { hasSettled: boolean; gameEndAt?: number }) => {
  const {
    setup: { components },
  } = useDojo();

  const goToStructure = useGoToStructure();
  const realmEntities = usePlayerOwnedRealmEntities();
  const onSpectatorModeClick = useSpectatorModeClick(components);

  const handlePlay = () => {
    const firstRealm = realmEntities[0];
    if (!firstRealm) return;

    const structure = getComponentValue(components.Structure, firstRealm);
    if (!structure) return;

    goToStructure(structure.entity_id, new Position({ x: structure.base.coord_x, y: structure.base.coord_y }), false);
  };

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
        {hasSettled ? (
          <>
            <Button onClick={handlePlay} className="w-full h-12 !text-brown !bg-gold !normal-case rounded-md ">
              <div className="flex items-center justify-center">
                <Sword className="w-5 h-5 mr-2 fill-brown" />
                <span>Play Blitz</span>
              </div>
            </Button>
            <SpectateButton onClick={onSpectatorModeClick} />
          </>
        ) : (
          <>
            <div className="bg-brown/10 border border-brown/30 rounded-lg p-4 text-center">
              <p className="text-gold/70">You did not settle in this game</p>
            </div>
            <SpectateButton onClick={onSpectatorModeClick} />
          </>
        )}
      </div>
    </motion.div>
  );
};

// Main Blitz onboarding component
export const BlitzOnboarding = () => {
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

  const blitzConfig = configManager.getBlitzConfig()?.blitz_registration_config;
  const blitzNumHyperStructuresLeft = configManager.getBlitzConfig()?.blitz_num_hyperstructures_left;
  const seasonConfig = configManager.getSeasonConfig();
  const playerRegistered = useComponentValue(
    components.BlitzRealmPlayerRegister,
    getEntityIdFromKeys([BigInt(account.address)]),
  );

  const { connector } = useAccount();

  const playerSettled = useEntityQuery([HasValue(components.Structure, { owner: BigInt(account.address) })]).length > 0;

  useSetAddressName(setup, playerSettled ? account : null, connector);

  // Determine current game state based on time
  useEffect(() => {
    if (!blitzConfig) return;

    const updateGameState = () => {
      const now = Date.now() / 1000;

      if (now < blitzConfig.registration_start_at) {
        // Before registration starts
        setGameState(GameState.NO_GAME);
      } else if (now >= blitzConfig.registration_start_at && now < blitzConfig.registration_end_at) {
        // Registration period
        setGameState(GameState.REGISTRATION);
      } else if (now >= blitzConfig.creation_start_at && now < blitzConfig.creation_end_at) {
        // Settlement period
        setGameState(GameState.SETTLEMENT);
      } else if (now >= blitzConfig.creation_end_at) {
        // Game is active
        setGameState(GameState.GAME_ACTIVE);
      }
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
      }
    };
    getUsername();
  }, [connector]);

  const hasAcceptedTS = useUIStore((state) => state.hasAcceptedTS);
  const setShowToS = useUIStore((state) => state.setShowToS);

  // Registration handler
  const handleRegister = async () => {
    if (!account?.address) return;
    await blitz_realm_register({ owner: account.address, signer: account, name: addressNameFelt });
  };

  const handleMakeHyperstructures = async () => {
    if (!account?.address) return;
    await blitz_realm_make_hyperstructures({ count: 8, signer: account });
  };

  // Settlement handler
  const handleSettle = async () => {
    if (!account?.address) return;
    await blitz_realm_create({ signer: account });
  };

  if (!hasAcceptedTS) {
    return (
      <Button size="lg" className="!bg-gold border-none w-full" onClick={() => setShowToS(true)}>
        <div className="text-black flex-grow text-center">Accept ToS</div>
      </Button>
    );
  }

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
        <Button onClick={() => window.location.reload()} className="!bg-gold !text-brown !normal-case rounded-md">
          Refresh Page
        </Button>
      </motion.div>
    );
  }

  const { registration_start_at, registration_end_at, creation_start_at, creation_end_at } = blitzConfig;

  return (
    <div className="space-y-6">
      <MakeHyperstructuresState
        numHyperStructuresLeft={blitzNumHyperStructuresLeft || 0}
        onMakeHyperstructures={handleMakeHyperstructures}
      />
      {gameState === GameState.NO_GAME && registration_start_at && (
        <NoGameState
          registrationStartAt={registration_start_at}
          registrationEndAt={registration_end_at}
          creationStartAt={creation_start_at}
          creationEndAt={creation_end_at}
        />
      )}
      {gameState === GameState.REGISTRATION && (
        <RegistrationState
          registrationCount={blitzConfig.registration_count}
          registrationStartAt={registration_start_at}
          registrationEndAt={registration_end_at}
          creationStartAt={creation_start_at}
          creationEndAt={creation_end_at}
          isRegistered={playerRegistered?.registered || false}
          onRegister={handleRegister}
        />
      )}
      {gameState === GameState.SETTLEMENT && (
        <SettlementState
          creationStartAt={creation_start_at}
          creationEndAt={creation_end_at}
          isRegistered={playerRegistered?.registered || !!playerSettled}
          hasSettled={!!playerSettled}
          onSettle={handleSettle}
        />
      )}
      {gameState === GameState.GAME_ACTIVE && (
        <GameActiveState hasSettled={!!playerSettled} gameEndAt={seasonConfig?.endAt} />
      )}
    </div>
  );
};
