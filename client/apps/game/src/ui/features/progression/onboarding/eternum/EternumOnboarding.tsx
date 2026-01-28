import { ReactComponent as Sword } from "@/assets/icons/sword.svg";
import { useGoToStructure, useSpectatorModeClick } from "@/hooks/helpers/use-navigate";
import { useSetAddressName } from "@/hooks/helpers/use-set-address-name";
import { useUIStore } from "@/hooks/store/use-ui-store";
import Button from "@/ui/design-system/atoms/button";
import { configManager, Position } from "@bibliothecadao/eternum";
import { useDojo, usePlayerOwnedRealmEntities, usePlayerOwnedVillageEntities } from "@bibliothecadao/react";
import { getComponentValue } from "@dojoengine/recs";
import { useAccount } from "@starknet-react/core";
import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { env } from "../../../../../../env";
import { SpectateButton } from "../spectate-button";

// Animation variants for the forge button
const buttonVariants = {
  idle: { scale: 1 },
  hover: { scale: 1.05 },
  tap: { scale: 0.95 },
};

const rippleVariants = {
  pulse: {
    scale: [1, 1.2, 1],
    opacity: [0.4, 0, 0.4],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

const numberVariants = {
  enter: { scale: 1.5, opacity: 0 },
  center: { scale: 1, opacity: 1 },
  breathing: {
    scale: [1, 1.05, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

interface SpireForgeProps {
  numSpiresLeft: number;
  onForge: () => Promise<void>;
  canMake: boolean;
}

const SpireForge = ({ numSpiresLeft, onForge, canMake }: SpireForgeProps) => {
  const [isForging, setIsForging] = useState(false);
  const [currentCount, setCurrentCount] = useState(numSpiresLeft);

  // Auto-rerender and check config every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const latestBlitzConfig = configManager.getBlitzConfig();
      const latestCount = latestBlitzConfig?.num_spires_left;
      if (latestCount !== undefined) {
        setCurrentCount(latestCount);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Update state when prop changes
  useEffect(() => {
    setCurrentCount(numSpiresLeft);
  }, [numSpiresLeft]);

  const handleForge = async () => {
    setIsForging(true);
    try {
      await onForge();
    } catch (error) {
      console.error("Make spires failed:", error);
    } finally {
      setIsForging(false);
    }
  };

  if (currentCount <= 0 || !canMake) {
    return null;
  }

  return (
    <div className="flex flex-col items-center space-y-4 my-4">
      {/* Title */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <h3 className="text-gold font-semibold text-sm">Forge Spires</h3>
        <p className="text-gold/60 text-xs mt-1">Click to create spires on the map</p>
      </motion.div>

      {/* Forge Button - Gold color scheme to match StepOne */}
      <motion.button
        onClick={handleForge}
        disabled={isForging}
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
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#ffffff")}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#fef3c7")}
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
          variants={numberVariants}
          animate={isForging ? undefined : "breathing"}
        >
          {isForging ? (
            <motion.img
              src="/images/logos/eternum-loader.png"
              className="w-8 h-8"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          ) : (
            <motion.span key={currentCount} variants={numberVariants} initial="enter" animate="center">
              {currentCount}
            </motion.span>
          )}
        </motion.div>

        {/* Sparkles */}
        {!isForging && (
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
    </div>
  );
};

export const EternumOnboarding = () => {
  const {
    setup: { components },
    account: { account },
    setup,
  } = useDojo();
  const {
    systemCalls: { spire_make_spires },
  } = setup;

  const hasAcceptedTS = useUIStore((state) => state.hasAcceptedTS);
  const setShowToS = useUIStore((state) => state.setShowToS);
  const { connector } = useAccount();

  const onSpectatorModeClick = useSpectatorModeClick(setup);

  const realmEntities = usePlayerOwnedRealmEntities();
  const villageEntities = usePlayerOwnedVillageEntities();

  const hasRealmsOrVillages = useMemo(() => {
    return realmEntities.length > 0 || villageEntities.length > 0;
  }, [realmEntities, villageEntities]);

  const isSeasonActive = env.VITE_PUBLIC_SEASON_START_TIME <= Date.now() / 1000;
  const canPlay = hasRealmsOrVillages && isSeasonActive;

  // Only set address name if user has realms or villages
  useSetAddressName(setup, hasRealmsOrVillages ? account : null, connector);

  const [timeRemaining, setTimeRemaining] = useState<string>("");

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now() / 1000;
      const timeLeft = env.VITE_PUBLIC_SEASON_START_TIME - now;

      if (timeLeft <= 0) {
        setTimeRemaining("");
        return;
      }

      const days = Math.floor(timeLeft / (60 * 60 * 24));
      const hours = Math.floor((timeLeft % (60 * 60 * 24)) / (60 * 60));
      const minutes = Math.floor((timeLeft % (60 * 60)) / 60);
      const seconds = Math.floor(timeLeft % 60);
      const time = `${days}d ${hours}h ${minutes}m ${seconds}s`;

      setTimeRemaining(time);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, []);

  const goToStructure = useGoToStructure(setup);

  const onPlayModeClick = () => {
    const randomRealmEntityOrVillageEntity =
      realmEntities.length > 0 ? realmEntities[0] : villageEntities.length > 0 ? villageEntities[0] : undefined;

    const structure = randomRealmEntityOrVillageEntity
      ? getComponentValue(components.Structure, randomRealmEntityOrVillageEntity)
      : undefined;

    if (!structure) return;
    void goToStructure(
      structure.entity_id,
      new Position({ x: structure.base.coord_x, y: structure.base.coord_y }),
      false,
    );
  };

  // Spire forge state
  const [numSpiresLeft, setNumSpiresLeft] = useState(0);
  const [spiresSettledCount, setSpiresSettledCount] = useState(0);
  const [canMakeSpires, setCanMakeSpires] = useState(false);

  // Poll for config updates
  useEffect(() => {
    const updateConfig = () => {
      const blitzConfig = configManager.getBlitzConfig();
      const seasonConfig = configManager.getSeasonConfig();

      const left = blitzConfig?.num_spires_left ?? 0;
      const settled = blitzConfig?.spires_settled_count ?? 0;

      setNumSpiresLeft(left);
      setSpiresSettledCount(settled);

      // Can make spires if settling has started
      if (seasonConfig?.startSettlingAt) {
        const now = Date.now() / 1000;
        setCanMakeSpires(now >= seasonConfig.startSettlingAt);
      }
    };

    updateConfig();
    const interval = setInterval(updateConfig, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleMakeSpires = useCallback(async () => {
    if (!account?.address) return;
    // Create spires in batches of 7 to prevent gas issues
    const spireCount = 7;
    await spire_make_spires({ count: spireCount, spiresSettledCount, signer: account });
  }, [account, spiresSettledCount, spire_make_spires]);

  return (
    <div className="flex flex-col justify-center space-y-4 items-center flex-wrap">
      {/* Spire Forge Section */}
      {numSpiresLeft > 0 && canMakeSpires && (
        <SpireForge numSpiresLeft={numSpiresLeft} onForge={handleMakeSpires} canMake={canMakeSpires} />
      )}

      {/* Play/ToS Button - Same as StepOne */}
      {hasAcceptedTS ? (
        <Button
          size="lg"
          variant="gold"
          disabled={!canPlay}
          className={`w-full ${!canPlay ? "opacity-40 hover:none disabled:pointer-events-none" : ""}`}
          onClick={onPlayModeClick}
        >
          <Sword className="w-6 fill-current mr-2" />
          <div className="text-black flex-grow text-center">{isSeasonActive ? "Play Realms" : timeRemaining}</div>
        </Button>
      ) : (
        <Button size="lg" className="!bg-gold border-none w-full" onClick={() => setShowToS(true)}>
          <div className="text-black flex-grow text-center">Accept ToS</div>
        </Button>
      )}

      {/* Spectate Button - Same as StepOne */}
      <SpectateButton onClick={onSpectatorModeClick} />
    </div>
  );
};
