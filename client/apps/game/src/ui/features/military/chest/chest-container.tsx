import { useUISound } from "@/audio";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { Position } from "@bibliothecadao/eternum";

import { getRecipientTypeColor, getRelicTypeColor } from "@/ui/design-system/molecules/relic-colors";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { getCrateName, getTileAt, DEFAULT_COORD_ALT } from "@bibliothecadao/eternum";
import { useComponentSystem, useDojo } from "@bibliothecadao/react";
import { getRelicInfo, ID, RelicInfo, RELICS, ResourcesIds } from "@bibliothecadao/types";
import { getComponentValue, isComponentUpdate } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { AnimatePresence, motion, useMotionValue } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  const playHoverSound = useUISound("ui.hover");

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
  const handlePositionChange = useCallback(
    (latest: number) => {
      if (latest < -totalWidth) {
        x.set(latest + totalWidth);
      } else if (latest > 0) {
        x.set(latest - totalWidth);
      }
    },
    [totalWidth, x],
  );

  useEffect(() => {
    const unsubscribe = x.on("change", handlePositionChange);
    return unsubscribe;
  }, [x, handlePositionChange]);

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
                  if (!isDragging) {
                    // Only play sound if not dragging
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
                      className={`px-2 py-1 rounded text-xs font-semibold ${getRelicTypeColor(hoveredRelicInfo.type)}`}
                    >
                      {hoveredRelicInfo.type}
                    </span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${getRelicTypeColor(hoveredRelicInfo.type)}`}
                    >
                      {hoveredRelicInfo.recipientType}
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
                  <p className=" text-sm mb-2">{hoveredRelicInfo.effect}</p>
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

// Crack overlay component for progressive chest damage
const CrackOverlay = ({ intensity }: { intensity: number }) => {
  if (intensity === 0) return null;

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 200 200">
      <defs>
        <filter id="roughPaper">
          <feTurbulence type="turbulence" baseFrequency="0.04" numOctaves="5" result="turbulence" />
          <feColorMatrix in="turbulence" type="saturate" values="0" />
        </filter>
      </defs>
      {intensity >= 1 && (
        <path
          d="M 80 50 Q 85 80 90 100 Q 88 120 85 140"
          stroke="#4a3f36"
          strokeWidth="2"
          fill="none"
          filter="url(#roughPaper)"
          opacity={0.7}
        />
      )}
      {intensity >= 2 && (
        <path
          d="M 120 60 Q 115 85 118 110 Q 122 130 125 150"
          stroke="#4a3f36"
          strokeWidth="3"
          fill="none"
          filter="url(#roughPaper)"
          opacity={0.8}
        />
      )}
      {intensity >= 3 && (
        <path
          d="M 60 90 Q 80 92 100 95 Q 120 93 140 90"
          stroke="#4a3f36"
          strokeWidth="2.5"
          fill="none"
          filter="url(#roughPaper)"
          opacity={0.9}
        />
      )}
    </svg>
  );
};

// Light beam effect component
const LightBeams = ({ intensity }: { intensity: number }) => {
  if (intensity < 3) return null;

  return (
    <motion.div className="absolute inset-0 pointer-events-none overflow-hidden">
      {[...Array(Math.min(intensity - 2, 3))].map((_, i) => (
        <motion.div
          key={i}
          className="absolute h-48 w-1 bg-gradient-to-t from-transparent via-gold to-transparent"
          style={{
            left: `${30 + i * 25}%`,
            top: "50%",
            transformOrigin: "bottom",
          }}
          initial={{ scaleY: 0, opacity: 0 }}
          animate={{
            scaleY: [0, 1, 0.8],
            opacity: [0, 0.6, 0.4],
            rotate: [-45 + i * 30, -45 + i * 30, -45 + i * 30],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            delay: i * 0.2,
          }}
        />
      ))}
    </motion.div>
  );
};

// Sparkle particle component
const SparkleParticle = ({ delay }: { delay: number }) => {
  const randomX = Math.random() * 100 - 50;
  const randomY = Math.random() * 100 - 50;

  return (
    <motion.div
      className="absolute w-1 h-1 bg-gold rounded-full"
      style={{
        left: "50%",
        top: "50%",
      }}
      initial={{ x: 0, y: 0, opacity: 1 }}
      animate={{
        x: randomX,
        y: randomY,
        opacity: [1, 1, 0],
        scale: [0, 1.5, 0],
      }}
      transition={{
        duration: 1,
        delay,
        ease: "easeOut",
      }}
    />
  );
};

// Number particle for click feedback
const NumberParticle = ({ number }: { number: number }) => {
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        left: "50%",
        top: "30%",
      }}
      initial={{ x: "-50%", y: 0, opacity: 1, scale: 0 }}
      animate={{
        y: -60,
        opacity: [1, 1, 0],
        scale: [0, 1.5, 1],
      }}
      transition={{
        duration: 1,
        ease: "easeOut",
      }}
    >
      <div className="text-2xl font-bold text-gold drop-shadow-lg">+{number}</div>
    </motion.div>
  );
};

export const ChestContainer = ({
  explorerEntityId,
  chestHex,
}: {
  explorerEntityId: ID;
  chestHex: { x: number; y: number };
}) => {
  const {
    setup: { components },
  } = useDojo();

  const [isShaking, setIsShaking] = useState(false);
  const [hasClicked, setHasClicked] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [chestResult, setChestResult] = useState<number[] | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [sparkles, setSparkles] = useState<number[]>([]);
  const [isOpening, setIsOpening] = useState(false);
  const [revealedCards, setRevealedCards] = useState<number[]>([]);
  const [numberParticles, setNumberParticles] = useState<{ id: number; number: number }[]>([]);

  const shakeTimeout = useRef<NodeJS.Timeout | null>(null);
  const CLICKS_TO_OPEN = 5;

  const chestName = useMemo(() => {
    const tile = getTileAt(components, DEFAULT_COORD_ALT, chestHex.x, chestHex.y);
    if (!tile) return "Unknown Crate";
    return getCrateName(tile.occupier_id);
  }, [chestHex.x, chestHex.y]);

  const chestPositionNormalized = new Position({ x: chestHex.x, y: chestHex.y }).getNormalized();

  // Sound effects
  const playChestSound = useUISound("relic.chest");
  const playChestOpenSound = useUISound("relic.chest");

  const toggleModal = useUIStore((state) => state.toggleModal);

  const {
    setup: {
      systemCalls,
      network: { contractComponents },
    },
    account: { account },
  } = useDojo();

  // Event listener for OpenRelicChestEvent
  useComponentSystem(
    contractComponents.events.OpenRelicChestEvent,
    (update: any) => {
      if (!isComponentUpdate(update, contractComponents.events.OpenRelicChestEvent)) return;

      const [currentState] = update.value;

      if (
        currentState?.explorer_id === explorerEntityId &&
        currentState?.chest_coord?.x === chestHex.x &&
        currentState?.chest_coord?.y === chestHex.y
      ) {
        const relics = currentState.relics.map((relic: any) => relic.value);
        setChestResult(relics);

        if (isOpening) {
          setTimeout(() => {
            setShowResult(true);
            playChestOpenSound();

            relics.forEach((_, index) => {
              setTimeout(() => {
                setRevealedCards((prev) => [...prev, index]);
              }, index * 600);
            });
          }, 500);
        } else {
          setShowResult(true);
          playChestOpenSound();
          setRevealedCards(relics.map((_, i) => i));
        }
      }
    },
    [explorerEntityId, chestHex.x, chestHex.y, isOpening, playChestOpenSound],
  );

  const handleChestClick = async () => {
    if (!account || isOpening || showResult) return;

    // Increment click count
    const newClickCount = clickCount + 1;
    setClickCount(newClickCount);

    // Play chest sound (variations will be handled by AudioManager)
    playChestSound();

    // Generate sparkles on each click
    const newSparkles = [...Array(5 + newClickCount * 2)].map((_, i) => Date.now() + i);
    setSparkles(newSparkles);

    // Show number particle
    const particleId = Date.now();
    setNumberParticles((prev) => [...prev, { id: particleId, number: newClickCount }]);
    setTimeout(() => {
      setNumberParticles((prev) => prev.filter((p) => p.id !== particleId));
    }, 1000);

    // Progressive shake intensity based on clicks
    const shakeIntensity = Math.min(newClickCount * 2, 10);
    setIsShaking(true);

    // Clear any existing timeout
    if (shakeTimeout.current) {
      clearTimeout(shakeTimeout.current);
    }

    // Stop shaking after animation completes
    shakeTimeout.current = setTimeout(() => {
      setIsShaking(false);
    }, 500);

    // Check if we've reached the opening threshold
    if (newClickCount >= CLICKS_TO_OPEN) {
      setIsOpening(true);

      // Dramatic pause before opening
      setTimeout(() => {
        openChest();
      }, 1000);
    }

    // Trigger transaction on first click
    if (!hasClicked) {
      setHasClicked(true);
      try {
        await systemCalls.open_chest({
          signer: account,
          explorer_id: explorerEntityId,
          chest_coord: {
            x: chestHex.x,
            y: chestHex.y,
          },
        });
      } catch (error) {
        console.error("Failed to open chest:", error);
      }
    }
  };

  const openChest = () => {
    // This will be called when the chest animation completes
    // The actual result display will be triggered by the event listener
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (shakeTimeout.current) {
        clearTimeout(shakeTimeout.current);
      }
    };
  }, []);

  // Show result when event arrives - integrated into main view
  const relicInfos =
    showResult && chestResult
      ? (chestResult.map((id) => getRelicInfo(id as ResourcesIds)).filter(Boolean) as RelicInfo[])
      : [];

  return (
    <div className="flex flex-col items-center justify-center p-8 min-h-[80vh]">
      {/* Chest Name Header - Always visible */}
      <AnimatePresence mode="wait">
        {!showResult && (
          <motion.div
            key="chest-header"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="text-center mb-8"
          >
            <motion.h2
              className="text-gold text-2xl font-bold mb-2 bg-gradient-to-r from-gold via-yellow-400 to-gold bg-clip-text text-transparent"
              animate={{
                backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              {chestName}
            </motion.h2>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="h-px bg-gradient-to-r from-transparent via-gold to-transparent"
            />
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="text-gold/70 text-sm mt-2"
            >
              Located at ({chestPositionNormalized.x}, {chestPositionNormalized.y})
            </motion.p>
          </motion.div>
        )}

        {showResult && (
          <motion.div
            key="result-header"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="text-center mb-6"
          >
            <div className="text-gold text-3xl mb-2 font-bold">🎉 Crate Opened!</div>
            <motion.h2
              className="text-gold text-xl font-bold mb-2 bg-gradient-to-r from-gold via-yellow-400 to-gold bg-clip-text text-transparent"
              animate={{
                backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              {chestName}
            </motion.h2>
            <p className="text-gold text-lg">
              {relicInfos.length} {relicInfos.length === 1 ? "Relic" : "Relics"} Discovered!
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area - Chest or Cards */}
      <div className="relative w-full max-w-5xl">
        <AnimatePresence mode="wait">
          {/* Chest Image with Click Animation */}
          {!showResult && (
            <motion.div
              key="chest"
              className="cursor-pointer relative mx-auto w-fit"
              onClick={handleChestClick}
              initial={{ opacity: 1 }}
              exit={{
                opacity: 0,
                scale: 1.5,
                filter: "brightness(3)",
                transition: { duration: 0.5 },
              }}
              animate={
                isShaking
                  ? {
                      x: [-2 * (clickCount / 2), 2 * (clickCount / 2), -2 * (clickCount / 2), 2 * (clickCount / 2), 0],
                      y: [-1 * (clickCount / 2), 1 * (clickCount / 2), -1 * (clickCount / 2), 1 * (clickCount / 2), 0],
                      rotate: [-1 * clickCount, 1 * clickCount, -1 * clickCount, 1 * clickCount, 0],
                    }
                  : isOpening
                    ? {
                        scale: [1, 1.1, 1.2],
                        filter: ["brightness(1)", "brightness(1.5)", "brightness(2)"],
                      }
                    : {}
              }
              transition={{
                duration: isOpening ? 1 : 0.5,
                ease: "easeInOut",
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {/* Enhanced glowing aura that intensifies with clicks */}
              <motion.div
                className="absolute inset-0 rounded-full bg-gradient-radial from-gold/20 via-gold/10 to-transparent blur-xl"
                animate={{
                  scale: [1 + clickCount * 0.1, 1.2 + clickCount * 0.1, 1 + clickCount * 0.1],
                  opacity: [0.3 + clickCount * 0.1, 0.6 + clickCount * 0.1, 0.3 + clickCount * 0.1],
                }}
                transition={{
                  duration: 2 - clickCount * 0.2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />

              {/* Light beams escaping from chest */}
              <LightBeams intensity={clickCount} />

              {/* Floating particles around chest */}
              <motion.div
                className="absolute inset-0 pointer-events-none"
                initial={false}
                animate={{
                  rotate: 360,
                }}
                transition={{
                  duration: 20 - clickCount * 2,
                  repeat: Infinity,
                  ease: "linear",
                }}
              >
                {[...Array(6 + clickCount)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-2 h-2 bg-gold rounded-full"
                    style={{
                      left: `${50 + (30 + clickCount * 3) * Math.cos((i * (360 / (6 + clickCount)) * Math.PI) / 180)}%`,
                      top: `${50 + (30 + clickCount * 3) * Math.sin((i * (360 / (6 + clickCount)) * Math.PI) / 180)}%`,
                    }}
                    animate={{
                      scale: [0.5, 1 + clickCount * 0.2, 0.5],
                      opacity: [0.2, 0.8, 0.2],
                    }}
                    transition={{
                      duration: 2 - clickCount * 0.2,
                      repeat: Infinity,
                      delay: i * (0.3 / (1 + clickCount * 0.2)),
                      ease: "easeInOut",
                    }}
                  />
                ))}
              </motion.div>

              {/* Sparkle particles on click */}
              {sparkles.map((sparkle, i) => (
                <SparkleParticle key={sparkle} delay={i * 0.05} />
              ))}

              {/* Number particles for click feedback */}
              {numberParticles.map((particle) => (
                <NumberParticle key={particle.id} number={particle.number} />
              ))}

              {/* Chest with crack overlay */}
              <div className="relative">
                <img
                  src="/images/relic-chest/chest-closed.png"
                  alt="Closed Crate"
                  className="w-48 h-48 mb-4 relative z-10"
                />
                <CrackOverlay intensity={clickCount} />
              </div>

              {/* Opening flash effect */}
              {isOpening && (
                <motion.div
                  className="absolute inset-0 bg-white rounded-full"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 3, opacity: [0, 0.8, 0] }}
                  transition={{ duration: 0.6 }}
                />
              )}
            </motion.div>
          )}

          {/* Relics Display - Animates up from where chest was */}
          {showResult && (
            <motion.div
              key="relics"
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                type: "spring",
                stiffness: 100,
                damping: 20,
                delay: 0.3,
              }}
              className="w-full"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {relicInfos.map((relic, index) => {
                  const isRevealed = revealedCards.includes(index);
                  const isRare = relic.level === 2;

                  return (
                    <motion.div
                      key={relic.id}
                      className="relative"
                      initial={{ y: 50, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      {/* Card Back (Hidden State) */}
                      <AnimatePresence>
                        {!isRevealed && (
                          <motion.div
                            className="absolute inset-0 bg-dark-brown/95 backdrop-blur-md rounded-xl border-2 border-gold/40 shadow-2xl flex items-center justify-center h-[380px]"
                            initial={{ rotateY: 0 }}
                            exit={{ rotateY: 90 }}
                            transition={{ duration: 0.3 }}
                            style={{ backfaceVisibility: "hidden" }}
                          >
                            {/* Mystery glow effect */}
                            <motion.div
                              className="absolute inset-0 rounded-xl"
                              animate={{
                                background: [
                                  "radial-gradient(circle at center, transparent 0%, transparent 100%)",
                                  "radial-gradient(circle at center, rgba(255,215,0,0.1) 0%, transparent 70%)",
                                  "radial-gradient(circle at center, transparent 0%, transparent 100%)",
                                ],
                              }}
                              transition={{ duration: 2, repeat: Infinity }}
                            />
                            <div className="text-6xl opacity-50">?</div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Card Front (Revealed State) */}
                      <motion.div
                        initial={{ rotateY: -90, scale: 0.8 }}
                        animate={isRevealed ? { rotateY: 0, scale: 1 } : { rotateY: -90, scale: 0.8 }}
                        transition={{
                          duration: 0.6,
                          type: "spring",
                          stiffness: 100,
                        }}
                        style={{ backfaceVisibility: "hidden" }}
                      >
                        {/* Extra effects for rare items */}
                        {isRevealed && isRare && (
                          <motion.div
                            className="absolute inset-0 pointer-events-none"
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1.5, opacity: 0 }}
                            transition={{ duration: 1, ease: "easeOut" }}
                          >
                            <div className="absolute inset-0 rounded-xl bg-gradient-radial from-purple-600/60 via-purple-600/30 to-transparent" />
                          </motion.div>
                        )}

                        <motion.div
                          className={`relative bg-dark-brown/90 backdrop-blur-md rounded-xl border-2 p-6 shadow-2xl overflow-hidden ${
                            isRare ? "border-purple-500/80" : "border-gold/60"
                          }`}
                          animate={
                            isRevealed && isRare
                              ? {
                                  boxShadow: [
                                    "0 0 20px rgba(168, 85, 247, 0.3)",
                                    "0 0 40px rgba(168, 85, 247, 0.6)",
                                    "0 0 20px rgba(168, 85, 247, 0.3)",
                                  ],
                                }
                              : {}
                          }
                          transition={{ duration: 2, repeat: Infinity }}
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
                                  isRevealed && relic.level === 2
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
                                className={`px-3 py-1 rounded-full text-xs font-semibold ${getRelicTypeColor(relic.type)}`}
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
                            <p className=" text-sm text-center mb-3 leading-relaxed">{relic.effect}</p>

                            {/* Additional Info */}
                            <div className="flex flex-col items-center gap-1 text-xs">
                              {relic.duration && <p className="text-gold/70">Duration: {relic.duration}</p>}
                              <span
                                className={`px-2 py-1 rounded text-xs font-semibold ${getRecipientTypeColor(
                                  relic.recipientType,
                                )}`}
                              >
                                {relic.recipientType} Activation
                              </span>
                              {relic.craftable && <p className="text-blue-400">✨ Craftable</p>}
                            </div>
                          </div>
                        </motion.div>
                      </motion.div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Click Progress Bar - Only show when chest is visible */}
        {!showResult && (
          <motion.div
            className="mt-4 w-48 mx-auto"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gold/60">Clicks</span>
              <span className="text-xs text-gold">
                {clickCount} / {CLICKS_TO_OPEN}
              </span>
            </div>
            <div className="h-2 bg-dark-brown/50 rounded-full overflow-hidden border border-gold/30">
              <motion.div
                className="h-full bg-gradient-to-r from-gold/60 via-gold to-gold/60"
                animate={{
                  width: `${(clickCount / CLICKS_TO_OPEN) * 100}%`,
                  boxShadow: clickCount >= CLICKS_TO_OPEN ? "0 0 10px rgba(255, 215, 0, 0.8)" : "none",
                }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
              />
            </div>
          </motion.div>
        )}
      </div>

      {hasClicked && !isOpening && clickCount < CLICKS_TO_OPEN && (
        <motion.div className="text-center mt-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <p className="text-gold/70 text-sm">Keep clicking! The crate is weakening...</p>
        </motion.div>
      )}

      {isOpening && (
        <motion.div className="text-center mt-4" initial={{ scale: 0 }} animate={{ scale: 1 }}>
          <p className="text-gold text-lg font-bold animate-pulse">The crate is opening!</p>
        </motion.div>
      )}

      {!hasClicked && (
        <motion.p
          className="text-gold/60 text-xs mt-4 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          Click the crate {CLICKS_TO_OPEN} times to break it open!
        </motion.p>
      )}

      {/* Horizontal Relic Carousel - Show until chest opens */}
      {!showResult && (
        <div className="w-full mt-8">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            <h3 className="text-center text-gold text-lg font-semibold mb-4">Possible Relics in This Crate</h3>
            <RelicCarousel foundRelics={[]} />
          </motion.div>
        </div>
      )}

      {/* Continue Button - Show after results */}
      {showResult && (
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
      )}
    </div>
  );
};
