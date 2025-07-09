import { soundSelector, useUiSounds } from "@/hooks/helpers/use-ui-sound";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { useDojo } from "@bibliothecadao/react";
import { getRelicInfo, ID, RelicInfo, RELICS, ResourcesIds, world } from "@bibliothecadao/types";
import { defineComponentSystem, isComponentUpdate } from "@dojoengine/recs";
import { AnimatePresence, motion, useMotionValue } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

// Relic Card Component - Simplified without tooltip
const RelicCard = ({ relic, isHovered }: { relic: RelicInfo; isHovered: boolean }) => {
  // Map relic names to resource icon component names

  const resourceName = ResourcesIds[relic.id];

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

// Horizontal Relic Carousel Component with Drag Controls
const RelicCarousel = ({ foundRelics }: { foundRelics: number[] }) => {
  const [hoveredRelic, setHoveredRelic] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Motion values for position-aware animation
  const x = useMotionValue(0);

  // Sound effect for hovering
  const { play: playHoverSound } = useUiSounds(soundSelector.hoverClick);

  // Get relic info for found relics, or show all relics as preview
  const displayRelics = useMemo(() => {
    if (foundRelics.length > 0) {
      return foundRelics.map((id) => getRelicInfo(id)).filter(Boolean) as RelicInfo[];
    }
    // Show all relics for preview
    return RELICS;
  }, [foundRelics]);

  // Create multiple copies for seamless looping
  const extendedRelics = useMemo(() => {
    return [...displayRelics, ...displayRelics, ...displayRelics];
  }, [displayRelics]);

  // Get the currently hovered relic info
  const hoveredRelicInfo = hoveredRelic !== null ? extendedRelics[hoveredRelic] : null;

  // Calculate carousel dimensions
  const itemWidth = 132; // 96px width + 24px margin each side
  const totalWidth = displayRelics.length * itemWidth;

  // Reset position for seamless looping
  useEffect(() => {
    const unsubscribe = x.on("change", (latest) => {
      if (latest < -totalWidth) {
        x.set(latest + totalWidth);
      } else if (latest > 0) {
        x.set(latest - totalWidth);
      }
    });

    return unsubscribe;
  }, [x, totalWidth]);

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
            className="flex items-center cursor-grab active:cursor-grabbing"
            style={{ x }}
            drag="x"
            dragConstraints={{ left: -totalWidth * 2, right: totalWidth }}
            dragElastic={0.2}
            onDragStart={() => {
              setIsDragging(true);
            }}
            onDragEnd={() => setIsDragging(false)}
            whileDrag={{ cursor: "grabbing" }}
          >
            {extendedRelics.map((relic, index) => (
              <div
                key={`${relic.id}-${index}`}
                onMouseEnter={() => {
                  if (!isDragging) { // Only play sound if not dragging
                    playHoverSound();
                  }
                  setHoveredRelic(index);
                }}
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
                  <div className="text-3xl mb-2">👆</div>
                  <p className="text-sm">Drag to browse • Hover to see details</p>
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
  const [chestResult, setChestResult] = useState<number[] | null>(null);
  const [showResult, setShowResult] = useState(false);

  const shakeTimeout = useRef<NodeJS.Timeout | null>(null);

  // Sound effects
  const { play: playChestSound1 } = useUiSounds(soundSelector.relicChest1);
  const { play: playChestSound2 } = useUiSounds(soundSelector.relicChest2);
  const { play: playChestOpenSound } = useUiSounds(soundSelector.relicChest3);

  const toggleModal = useUIStore((state) => state.toggleModal);

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
          setChestResult(currentState.relics.map((relic: any) => relic.value));
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
    const relicInfos = chestResult.map((id) => getRelicInfo(id as ResourcesIds)).filter(Boolean) as RelicInfo[];

    return (
      <div className="flex flex-col items-center justify-center p-8 min-h-[80vh]">
        {/* Header Section */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="flex flex-col items-center mb-12"
        >
          <motion.div
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="text-gold text-3xl mb-6 font-bold"
          >
            🎉 Chest Opened!
          </motion.div>

          <motion.img
            src="/images/relic-chest/chest-opened.png"
            alt="Open Chest"
            className="w-56 h-56 mb-6"
            initial={{ rotate: -5 }}
            animate={{ rotate: 5 }}
            transition={{
              repeat: Infinity,
              repeatType: "reverse",
              duration: 2,
              ease: "easeInOut",
            }}
          />

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-center"
          >
            <p className="text-gold text-xl mb-2">
              {relicInfos.length} {relicInfos.length === 1 ? "Relic" : "Relics"} Discovered!
            </p>
            <p className="text-gold/70 text-sm">
              These powerful artifacts have been added to your explorer's inventory
            </p>
          </motion.div>
        </motion.div>

        {/* Relics Grid Display */}
        <div className="w-full max-w-5xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {relicInfos.map((relic, index) => (
              <motion.div
                key={relic.id}
                initial={{ scale: 0, opacity: 0, rotate: -180 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{
                  delay: 0.3 + index * 0.2,
                  type: "spring",
                  stiffness: 260,
                  damping: 20,
                }}
              >
                <motion.div
                  className="relative bg-dark-brown/90 backdrop-blur-md rounded-xl border-2 border-gold/60 p-6 shadow-2xl overflow-hidden"
                  whileHover={{
                    scale: 1.05,
                    borderColor: "rgba(255, 215, 0, 0.9)",
                    transition: { duration: 0.2 },
                  }}
                >
                  {/* Glow effect for rare relics */}
                  {relic.level === 2 && (
                    <motion.div
                      className="absolute inset-0 bg-gradient-radial from-purple-600/20 via-transparent to-transparent"
                      animate={{
                        opacity: [0.5, 0.8, 0.5],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />
                  )}

                  {/* Relic Content */}
                  <div className="relative z-10">
                    {/* Relic Image */}
                    <div className="flex justify-center mb-4">
                      <motion.div
                        className="w-32 h-32 flex items-center justify-center bg-black/30 rounded-lg p-4"
                        animate={
                          relic.level === 2
                            ? {
                                boxShadow: [
                                  "0 0 20px rgba(168, 85, 247, 0.5)",
                                  "0 0 40px rgba(168, 85, 247, 0.8)",
                                  "0 0 20px rgba(168, 85, 247, 0.5)",
                                ],
                              }
                            : {}
                        }
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      >
                        <ResourceIcon resource={ResourcesIds[relic.id]} size="xl" withTooltip={false} />
                      </motion.div>
                    </div>

                    {/* Relic Name */}
                    <h4 className="text-gold font-bold text-lg text-center mb-3">{relic.name}</h4>

                    {/* Badges */}
                    <div className="flex justify-center gap-2 mb-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          relic.type === "Stamina"
                            ? "bg-green-600/30 text-green-400 border border-green-500/50"
                            : relic.type === "Damage"
                              ? "bg-red-600/30 text-red-400 border border-red-500/50"
                              : relic.type === "Damage Reduction"
                                ? "bg-blue-600/30 text-blue-400 border border-blue-500/50"
                                : relic.type === "Exploration"
                                  ? "bg-purple-600/30 text-purple-400 border border-purple-500/50"
                                  : "bg-yellow-600/30 text-yellow-400 border border-yellow-500/50"
                        }`}
                      >
                        {relic.type}
                      </span>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          relic.level === 2
                            ? "bg-purple-600/30 text-purple-400 border border-purple-500/50"
                            : "bg-blue-600/30 text-blue-400 border border-blue-500/50"
                        }`}
                      >
                        Level {relic.level}
                      </span>
                    </div>

                    {/* Effect Description */}
                    <p className="text-gray-300 text-sm text-center mb-3 leading-relaxed">{relic.effect}</p>

                    {/* Additional Info */}
                    <div className="flex flex-col items-center gap-1 text-xs">
                      {relic.duration && <p className="text-gold/70">Duration: {relic.duration}</p>}
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          relic.activation === "Army" ? "bg-red-600/20 text-red-400" : "bg-green-600/20 text-green-400"
                        }`}
                      >
                        {relic.activation} Activation
                      </span>
                      {relic.craftable && <p className="text-blue-400">✨ Craftable</p>}
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Continue Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 + relicInfos.length * 0.2 }}
          className="mt-12"
        >
          <button
            className="px-8 py-3 bg-gold/20 hover:bg-gold/30 border-2 border-gold text-gold font-semibold rounded-lg transition-all duration-200 hover:scale-105"
            onClick={() => {
              toggleModal(null);
            }}
          >
            Continue Exploring
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-8">
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

      {/* Horizontal Relic Carousel - Only show before opening */}
      {!hasClicked && (
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
      )}
    </div>
  );
};
