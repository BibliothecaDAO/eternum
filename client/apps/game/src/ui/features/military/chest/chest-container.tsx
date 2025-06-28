import { soundSelector, useUiSounds } from "@/hooks/helpers/use-ui-sound";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { useDojo } from "@bibliothecadao/react";
import { ClientComponents, getRelicInfo, ID, RelicInfo, RELICS, ResourcesIds, world } from "@bibliothecadao/types";
import { ComponentValue, defineComponentSystem, isComponentUpdate } from "@dojoengine/recs";
import { AnimatePresence, motion, useAnimation, useMotionValue } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

// Relic Card Component - Simplified without tooltip
const RelicCard = ({ relic, isHovered }: { relic: RelicInfo; isHovered: boolean }) => {
  // Map relic names to resource icon component names

  const resourceName = ResourcesIds[relic.id];
  console.log({ resourceName, relic });

  return (
    <motion.div
      className="relative flex-shrink-0 mx-6"
      whileHover={{ scale: 1.1 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
    >
      <div className="relative">
        {/* Relic Icon - Bigger Size */}
        <div
          className={`w-24 h-24 flex items-center justify-center rounded-xl border backdrop-blur-sm transition-all duration-200 ${
            isHovered ? "bg-gold/20 border-gold/60 shadow-lg shadow-gold/25" : "bg-dark-brown/80 border-gold/30"
          }`}
        >
          <ResourceIcon resource={resourceName} size="xl" withTooltip={false} />
        </div>
      </div>
    </motion.div>
  );
};

// Horizontal Relic Carousel Component with Side Info Panel
const RelicCarousel = ({ foundRelics }: { foundRelics: number[] }) => {
  const [isPaused, setIsPaused] = useState(false);
  const [hoveredRelic, setHoveredRelic] = useState<number | null>(null);

  // Motion values for position-aware animation
  const x = useMotionValue(0);
  const controls = useAnimation();

  // Get relic info for found relics, or show all relics as preview
  const displayRelics = useMemo(() => {
    if (foundRelics.length > 0) {
      return foundRelics.map((id) => getRelicInfo(id)).filter(Boolean) as RelicInfo[];
    }
    // Show a sample of relics for preview
    return RELICS.slice(0, 8);
  }, [foundRelics]);

  // Create multiple copies for seamless looping
  const extendedRelics = useMemo(() => {
    return [...displayRelics, ...displayRelics, ...displayRelics];
  }, [displayRelics]);

  // Get the currently hovered relic info
  const hoveredRelicInfo = hoveredRelic !== null ? extendedRelics[hoveredRelic] : null;

  // Animation control effects
  useEffect(() => {
    if (!isPaused) {
      // Start continuous animation from current position
      const currentX = x.get();
      const targetX = currentX - 1200;

      controls.start({
        x: targetX,
        transition: {
          duration: (Math.abs(targetX - currentX) / 1200) * 20,
          ease: "linear",
          repeat: Infinity,
          repeatType: "loop",
        },
      });
    } else {
      // Stop animation at current position
      controls.stop();
    }
  }, [isPaused, controls, x]);

  // Reset position when it goes too far
  useEffect(() => {
    const unsubscribe = x.on("change", (latest) => {
      if (latest <= -1200) {
        x.set(0);
      }
    });

    return unsubscribe;
  }, [x]);

  return (
    <div className="w-full">
      {/* Carousel Section */}
      <div className="relative h-32 overflow-visible mb-8">
        {/* Gradient overlays for smooth edges */}
        <div className="absolute left-0 top-0 w-20 h-full bg-gradient-to-r from-dark-brown via-dark-brown/80 to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 w-20 h-full bg-gradient-to-l from-dark-brown via-dark-brown/80 to-transparent z-10 pointer-events-none" />

        {/* Carousel Container */}
        <div className="relative h-full flex items-center overflow-hidden">
          <motion.div
            className="flex items-center"
            style={{ x }}
            animate={controls}
            onHoverStart={() => setIsPaused(true)}
            onHoverEnd={() => {
              setIsPaused(false);
              setHoveredRelic(null);
            }}
          >
            {extendedRelics.map((relic, index) => (
              <div
                key={`${relic.id}-${index}`}
                onMouseEnter={() => setHoveredRelic(index)}
                onMouseLeave={() => setHoveredRelic(null)}
              >
                <RelicCard relic={relic} isHovered={hoveredRelic === index} />
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Bottom Information Panel */}
      <div className="w-full flex justify-center">
        <div className="max-w-2xl w-full h-32 flex items-center">
          <AnimatePresence mode="wait">
            {hoveredRelicInfo ? (
              <motion.div
                key={hoveredRelicInfo.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.3 }}
                className="w-full"
              >
                <div className="bg-dark-brown/95 backdrop-blur-md p-4 rounded-lg border border-gold/40 shadow-xl">
                  <h3 className="text-gold font-bold text-lg mb-2">{hoveredRelicInfo.name}</h3>
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        hoveredRelicInfo.type === "Stamina"
                          ? "bg-green-600/20 text-green-400"
                          : hoveredRelicInfo.type === "Damage"
                            ? "bg-red-600/20 text-red-400"
                            : hoveredRelicInfo.type === "Damage Reduction"
                              ? "bg-blue-600/20 text-blue-400"
                              : hoveredRelicInfo.type === "Exploration"
                                ? "bg-purple-600/20 text-purple-400"
                                : "bg-yellow-600/20 text-yellow-400"
                      }`}
                    >
                      {hoveredRelicInfo.type}
                    </span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        hoveredRelicInfo.activation === "Army"
                          ? "bg-red-600/20 text-red-400"
                          : "bg-green-600/20 text-green-400"
                      }`}
                    >
                      {hoveredRelicInfo.activation}
                    </span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-bold ${
                        hoveredRelicInfo.level === 2
                          ? "bg-purple-600/20 text-purple-400"
                          : "bg-blue-600/20 text-blue-400"
                      }`}
                    >
                      Level {hoveredRelicInfo.level}
                    </span>
                  </div>
                  <p className="text-gray-300 text-sm mb-2">{hoveredRelicInfo.effect}</p>
                  {hoveredRelicInfo.duration && (
                    <p className="text-gold/70 text-xs mb-1">Duration: {hoveredRelicInfo.duration}</p>
                  )}
                  {hoveredRelicInfo.craftable && <p className="text-blue-400 text-xs">✨ Craftable</p>}
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="w-full flex items-start justify-center pt-4"
              >
                <div className="text-center text-gold/50">
                  <div className="text-3xl mb-2">☝️</div>
                  <p className="text-sm">Hover over a relic above to see its details</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export const ChestContainer = ({
  explorerEntityId,
  chestHex,
}: {
  explorerEntityId: ID;
  chestHex: { x: number; y: number };
}) => {
  const [isShaking, setIsShaking] = useState(false);
  const [hasClicked, setHasClicked] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [chestResult, setChestResult] = useState<ComponentValue<
    ClientComponents["events"]["OpenRelicChestEvent"]["schema"]
  > | null>(null);
  const [showResult, setShowResult] = useState(false);

  const shakeTimeout = useRef<NodeJS.Timeout | null>(null);

  // Sound effects
  const { play: playChestSound1 } = useUiSounds(soundSelector.relicChest1);
  const { play: playChestSound2 } = useUiSounds(soundSelector.relicChest2);
  const { play: playChestOpenSound } = useUiSounds(soundSelector.relicChest3);

  const {
    setup: {
      systemCalls,
      network: { contractComponents },
    },
    account: { account },
  } = useDojo();

  // Event listener for OpenRelicChestEvent
  useEffect(() => {
    const handleChestEventUpdate = (update: any) => {
      if (isComponentUpdate(update, contractComponents.events.OpenRelicChestEvent)) {
        const [currentState, _prevState] = update.value;

        // Check if this event matches our current chest opening
        if (
          currentState?.explorer_id === explorerEntityId &&
          currentState?.chest_coord?.x === chestHex.x &&
          currentState?.chest_coord?.y === chestHex.y
        ) {
          setChestResult(currentState);
          setShowResult(true);
          // Play chest open sound when event arrives
          playChestOpenSound();
        }
      }
    };

    // Register the component system to listen for chest events
    defineComponentSystem(world, contractComponents.events.OpenRelicChestEvent, handleChestEventUpdate, {
      runOnInit: false,
    });
  }, [contractComponents.events.OpenRelicChestEvent, explorerEntityId, chestHex, playChestOpenSound]);

  const handleChestClick = async () => {
    if (!account) return;

    // Increment click count and play alternating click sounds
    const newClickCount = clickCount + 1;
    setClickCount(newClickCount);

    // Alternate between the two click sounds
    if (newClickCount % 2 === 1) {
      playChestSound1();
    } else {
      playChestSound2();
    }

    // Trigger shake animation
    setIsShaking(true);

    // Clear any existing timeout
    if (shakeTimeout.current) {
      clearTimeout(shakeTimeout.current);
    }

    // Stop shaking after animation completes
    shakeTimeout.current = setTimeout(() => {
      setIsShaking(false);
    }, 500);

    // Only trigger transaction on first click
    if (!hasClicked) {
      setHasClicked(true);
      try {
        // TODO: Uncomment when ready to enable transactions
        await systemCalls.open_chest({
          signer: account,
          explorer_id: explorerEntityId,
          chest_coord: {
            x: chestHex.x,
            y: chestHex.y,
          },
        });
        console.log("Chest opening transaction would be triggered here");
      } catch (error) {
        console.error("Failed to open chest:", error);
      }
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (shakeTimeout.current) {
        clearTimeout(shakeTimeout.current);
      }
    };
  }, []);

  // Show result when event arrives
  if (showResult && chestResult) {
    return (
      <div className="flex flex-col items-center justify-center p-8 min-h-screen">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="flex flex-col items-center mb-8"
        >
          <div className="text-gold text-2xl mb-4">🎉 Chest Opened!</div>
          <img src="/images/relic-chest/chest-opened.png" alt="Open Chest" className="w-48 h-48 mb-4" />
          <p className="text-gold mb-4">Relics discovered!</p>

          <p className="text-gold/70 text-sm text-center">The relics have been added to your explorer's inventory.</p>
        </motion.div>

        {/* Horizontal Relic Carousel */}
        <div className="w-full max-w-6xl mt-8">
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
          >
            <h3 className="text-center text-gold text-lg font-semibold mb-4">
              {chestResult.relics && chestResult.relics.length > 0 ? "Your Discovered Relics" : "Available Relics"}
            </h3>
            <RelicCarousel foundRelics={chestResult.relics || []} />
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-8">
      <div className="text-gold text-xl mb-4">📦 Relic Chest</div>
      <p className="text-gold/80 mb-6 text-center max-w-md">
        This chest contains valuable relics that can enhance your structures and armies. Click on the chest to open it!
      </p>

      {/* Chest Image with Click Animation */}
      <motion.div
        className="cursor-pointer"
        onClick={handleChestClick}
        animate={
          isShaking
            ? {
                x: [-2, 2, -2, 2, 0],
                y: [-1, 1, -1, 1, 0],
                rotate: [-1, 1, -1, 1, 0],
              }
            : {}
        }
        transition={{
          duration: 0.5,
          ease: "easeInOut",
        }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <img src="/images/relic-chest/chest-closed.png" alt="Closed Chest" className="w-48 h-48 mb-4" />
      </motion.div>

      {hasClicked && (
        <div className="text-center mt-4">
          <p className="text-gold/70 text-sm animate-pulse">
            {showResult ? "Chest opened!" : "Opening chest... waiting for transaction..."}
          </p>
        </div>
      )}

      <p className="text-gold/60 text-xs mt-4 text-center">
        Click the chest to open it. Each click will shake the chest!
      </p>

      {/* Horizontal Relic Carousel - Always Visible */}
      <div className="w-full mt-8">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
        >
          <h3 className="text-center text-gold text-lg font-semibold mb-4">Possible Relics in This Chest</h3>
          <RelicCarousel foundRelics={[]} />
        </motion.div>
      </div>
    </div>
  );
};
