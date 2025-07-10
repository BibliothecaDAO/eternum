import { ReactComponent as Eye } from "@/assets/icons/eye.svg";
import { ReactComponent as Sword } from "@/assets/icons/sword.svg";
import { ReactComponent as TreasureChest } from "@/assets/icons/treasure-chest.svg";
import { useGoToStructure, useSpectatorModeClick } from "@/hooks/helpers/use-navigate";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { Position } from "@/types/position";
import Button from "@/ui/design-system/atoms/button";
import { useDojo, usePlayerOwnedRealmEntities, usePlayerOwnedVillageEntities } from "@bibliothecadao/react";
import { getComponentValue } from "@dojoengine/recs";
import { motion } from "framer-motion";
import { Clock, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

// Dummy data for development
const DUMMY_DATA = {
  nextGameStart: Date.now() / 1000 + 10, // 10 seconds from now
  registrationCutoff: Date.now() / 1000 + 20, // 20 seconds from now
  settlementEnd: Date.now() / 1000 + 30, // 30 seconds from now
  registeredPlayers: 42,
  isRegistered: true,
  hasSettled: false,
  gameActive: false,
};

// Game state enum
enum GameState {
  NO_GAME = "NO_GAME",
  REGISTRATION = "REGISTRATION",
  SETTLEMENT = "SETTLEMENT",
  GAME_ACTIVE = "GAME_ACTIVE",
}

// Helper function to format time
const formatTimeRemaining = (seconds: number): string => {
  if (seconds <= 0) return "0s";

  const days = Math.floor(seconds / (60 * 60 * 24));
  const hours = Math.floor((seconds % (60 * 60 * 24)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(" ");
};

// Countdown timer component
const CountdownTimer = ({ targetTime, label }: { targetTime: number; label: string }) => {
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now() / 1000;
      const timeLeft = targetTime - now;
      setTimeRemaining(formatTimeRemaining(timeLeft));
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
const NoGameState = () => {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 text-center">
      <div className="py-8">
        <Clock className="w-16 h-16 mx-auto text-gold/50 mb-4" />
        <h3 className="text-xl font-bold text-gold mb-2">No Active Game</h3>
        <p className="text-gold/70">The next Blitz game will start soon!</p>
      </div>

      <CountdownTimer targetTime={DUMMY_DATA.nextGameStart} label="Next game starts in:" />
    </motion.div>
  );
};

// Registration state component
const RegistrationState = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [isRegistered, setIsRegistered] = useState(DUMMY_DATA.isRegistered);

  const handleRegister = async () => {
    setIsRegistering(true);
    // TODO: Implement actual registration logic
    await new Promise((resolve) => setTimeout(resolve, 1500)); // Simulate API call
    setIsRegistered(true);
    setIsRegistering(false);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="text-center space-y-4">
        <h3 className="text-xl font-bold text-gold">Registration Open</h3>
        <PlayerCount count={DUMMY_DATA.registeredPlayers} />
        <CountdownTimer targetTime={DUMMY_DATA.registrationCutoff} label="Registration closes in:" />
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

        <SpectateButton />
      </div>
    </motion.div>
  );
};

// Settlement state component
const SettlementState = () => {
  const {
    setup: { components },
  } = useDojo();

  const [isRegistered] = useState(DUMMY_DATA.isRegistered);
  const [hasSettled, setHasSettled] = useState(DUMMY_DATA.hasSettled);
  const [isSettling, setIsSettling] = useState(false);

  const goToStructure = useGoToStructure();
  const realmEntities = usePlayerOwnedRealmEntities();

  const handleSettle = async () => {
    setIsSettling(true);
    // TODO: Implement actual settlement logic - location will be assigned automatically
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setHasSettled(true);
    setIsSettling(false);
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
        <CountdownTimer targetTime={DUMMY_DATA.settlementEnd} label="Settlement phase ends in:" />
      </div>

      {isRegistered ? (
        <div className="space-y-4">
          {hasSettled ? (
            <>
              <div className="bg-gold/10 border border-gold/30 rounded-lg p-4 text-center">
                <TreasureChest className="w-8 h-8 mx-auto mb-2 fill-gold" />
                <p className="text-gold font-medium">Settlement Complete!</p>
                <p className="text-sm text-gold/70 mt-1">Your realm is ready for battle</p>
              </div>

              <Button onClick={handlePlay} className="w-full h-12 !text-brown !bg-gold !normal-case rounded-md">
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

          <SpectateButton />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-brown/10 border border-brown/30 rounded-lg p-4 text-center">
            <p className="text-gold/70">You are not registered for this game</p>
          </div>
          <SpectateButton />
        </div>
      )}
    </motion.div>
  );
};

// Game active state component
const GameActiveState = () => {
  const {
    setup: { components },
  } = useDojo();

  const [hasSettled] = useState(DUMMY_DATA.hasSettled);
  const goToStructure = useGoToStructure();
  const realmEntities = usePlayerOwnedRealmEntities();

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
            <SpectateButton />
          </>
        ) : (
          <>
            <div className="bg-brown/10 border border-brown/30 rounded-lg p-4 text-center">
              <p className="text-gold/70">You did not settle in this game</p>
            </div>
            <SpectateButton />
          </>
        )}
      </div>
    </motion.div>
  );
};

// Spectate button component (reusing from steps.tsx)
export const SpectateButton = ({
  onClick,
  forceSpectatorMode = false,
}: {
  onClick?: () => void;
  forceSpectatorMode?: boolean;
}) => {
  const {
    setup: { components },
  } = useDojo();

  const realmEntities = usePlayerOwnedRealmEntities();
  const villageEntities = usePlayerOwnedVillageEntities();
  const hasRealmsOrVillages = useMemo(() => {
    return realmEntities.length > 0 || villageEntities.length > 0;
  }, [realmEntities, villageEntities]);

  const defaultSpectatorClick = useSpectatorModeClick(components);
  const goToStructure = useGoToStructure();

  const onPlayModeClick = () => {
    const randomRealmEntityOrVillageEntity =
      realmEntities.length > 0 ? realmEntities[0] : villageEntities.length > 0 ? villageEntities[0] : undefined;

    const structure = randomRealmEntityOrVillageEntity
      ? getComponentValue(components.Structure, randomRealmEntityOrVillageEntity)
      : undefined;

    if (!structure) return;
    goToStructure(structure.entity_id, new Position({ x: structure.base.coord_x, y: structure.base.coord_y }), false);
  };

  const handleClick = onClick || (hasRealmsOrVillages && !forceSpectatorMode ? onPlayModeClick : defaultSpectatorClick);

  return (
    <Button className="w-full h-12" onClick={handleClick} size="lg">
      <div className="flex items-center justify-center">
        <Eye className="w-6 fill-current mr-2" />
        <span>Spectate</span>
      </div>
    </Button>
  );
};

// Main Blitz onboarding component
export const BlitzOnboarding = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.NO_GAME);

  // Determine current game state based on time
  useEffect(() => {
    const updateGameState = () => {
      const now = Date.now() / 1000;

      if (now < DUMMY_DATA.nextGameStart - 43200) {
        // More than 12 hours before next game
        setGameState(GameState.NO_GAME);
      } else if (now < DUMMY_DATA.registrationCutoff) {
        // Registration period
        setGameState(GameState.REGISTRATION);
      } else if (now < DUMMY_DATA.settlementEnd) {
        // Settlement period
        setGameState(GameState.SETTLEMENT);
      } else {
        // Game is active
        setGameState(GameState.GAME_ACTIVE);
      }
    };

    updateGameState();
    const interval = setInterval(updateGameState, 1000);
    return () => clearInterval(interval);
  }, []);

  const hasAcceptedTS = useUIStore((state) => state.hasAcceptedTS);
  const setShowToS = useUIStore((state) => state.setShowToS);

  if (!hasAcceptedTS) {
    return (
      <Button size="lg" className="!bg-gold border-none w-full" onClick={() => setShowToS(true)}>
        <div className="text-black flex-grow text-center">Accept ToS</div>
      </Button>
    );
  }

  return (
    <div className="space-y-6">
      {gameState === GameState.NO_GAME && <NoGameState />}
      {gameState === GameState.REGISTRATION && <RegistrationState />}
      {gameState === GameState.SETTLEMENT && <SettlementState />}
      {gameState === GameState.GAME_ACTIVE && <GameActiveState />}
    </div>
  );
};
