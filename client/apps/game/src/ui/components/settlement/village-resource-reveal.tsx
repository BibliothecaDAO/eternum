import Button from "@/ui/elements/button";
import { ContractAddress, HexPosition, ResourcesIds, } from "@bibliothecadao/types";
import {
  unpackValue
} from "@bibliothecadao/eternum"
import { useDojo } from "@bibliothecadao/react";
import { useComponentValue } from "@dojoengine/react";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ResourceIcon } from "../../elements/resource-icon";

// Define common resource types for the roulette
const COMMON_RESOURCES = ["Wood", "Stone", "Coal", "Copper", "Obsidian", "Silver", "Ironwood", "ColdIron", "Gold"];

// Define rare resources for the roulette
const RARE_RESOURCES = [
  "Hartwood",
  "Diamonds",
  "Sapphire",
  "Ruby",
  "DeepCrystal",
  "Ignium",
  "EtherealSilica",
  "TrueIce",
  "TwilightQuartz",
  "AlchemicalSilver",
  "Adamantine",
  "Mithral",
  "Dragonhide",
];

export const VillageResourceReveal = ({
  villageCoords,
  onRestart,
  onClose,
}: {
  villageCoords: HexPosition;
  onRestart: () => void;
  onClose: () => void;
}) => {
  const {
    setup: {
      account: { account },
      components: { Tile, Structure },
    },
  } = useDojo();

  const [isSpinning, setIsSpinning] = useState(false);
  const [spinComplete, setSpinComplete] = useState(false);
  const [rouletteResources, setRouletteResources] = useState<string[]>([]);
  const [showCelebration, setShowCelebration] = useState(false);
  const spinTimeout = useRef<NodeJS.Timeout | null>(null);
  const confettiTimeout = useRef<NodeJS.Timeout | null>(null);

  const tile = useComponentValue(Tile, getEntityIdFromKeys([BigInt(villageCoords.col), BigInt(villageCoords.row)]));

  // Check if player is owner in case someone else settles at same time
  const revealedResource = useMemo(() => {
    if (!tile?.occupier_id) return null;
    const structure = getComponentValue(Structure, getEntityIdFromKeys([BigInt(tile.occupier_id)]));
    if (!structure || structure.owner !== ContractAddress(account.address)) return null;
    return unpackValue(structure?.resources_packed)?.[0];
  }, [tile?.occupier_id, account.address]);

  // Generate random resources for the roulette
  const generateRandomResources = useCallback(() => {
    // Create a pool with more common resources and fewer rare ones
    const resourcePool = [...COMMON_RESOURCES, ...COMMON_RESOURCES, ...RARE_RESOURCES];

    // Shuffle and take 20 random resources
    const shuffled = [...resourcePool].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 20);

    // Add the revealed resource at the end (this will be where it stops)
    if (revealedResource) {
      selected.push(
        Object.keys(ResourcesIds).find((key) => ResourcesIds[key as keyof typeof ResourcesIds] === revealedResource) ||
        "Wood",
      );
    }

    return selected;
  }, [revealedResource]);

  const startSpin = useCallback(() => {
    if (isSpinning || spinComplete) return;

    setIsSpinning(true);
    setSpinComplete(false);
    setShowCelebration(false);

    // Generate random resources for the roulette
    setRouletteResources(generateRandomResources());

    // Set timeout to stop spinning after 3 seconds
    spinTimeout.current = setTimeout(() => {
      setIsSpinning(false);
      setSpinComplete(true);

      // Show celebration effects after revealing the resource
      confettiTimeout.current = setTimeout(() => {
        setShowCelebration(true);
      }, 500);
    }, 3000);
  }, [isSpinning, spinComplete, generateRandomResources]);

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (spinTimeout.current) clearTimeout(spinTimeout.current);
      if (confettiTimeout.current) clearTimeout(confettiTimeout.current);
    };
  }, []);

  // Auto-start spin when resource is revealed and spin hasn't happened yet
  useEffect(() => {
    if (revealedResource && !isSpinning && !spinComplete) {
      startSpin();
    }
  }, [revealedResource, isSpinning, spinComplete, startSpin]);

  return (
    <div className="flex flex-col items-center justify-center w-full h-full relative">
      <h4 className="mb-8">Resource Discovery</h4>

      <div className="relative w-64 h-64 overflow-hidden rounded-2xl panel-wood border-gold/5 bg-brown/5 backdrop-blur-sm shadow-xl">
        {/* Spinning roulette container */}
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-dark-brown/60 to-dark-brown/90">
          <AnimatePresence>
            {isSpinning && (
              <motion.div
                initial={{ y: "-100%" }}
                animate={{
                  y: "100%",
                  transition: {
                    duration: 3,
                    ease: [0.2, 0.8, 0.8, 0.2],
                  },
                }}
                exit={{ opacity: 0 }}
                className="absolute flex flex-col items-center gap-4"
              >
                {rouletteResources.map((resource, index) => (
                  <div
                    key={`${resource}-${index}`}
                    className="p-2 bg-dark-brown/80 rounded-lg shadow-inner flex items-center justify-center"
                  >
                    <ResourceIcon resource={resource} size="xl" className="" />
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Revealed resource (shown after spin) */}
        {spinComplete && revealedResource && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{
              scale: 1,
              opacity: 1,
              transition: { type: "spring", stiffness: 300, damping: 15 },
            }}
            className="absolute inset-0 flex flex-col items-center justify-center p-4"
          >
            <h6>You minted:</h6>
            <div className="p-6 bg-dark-brown/80 rounded-xl shadow-inner flex flex-col items-center justify-center">
              <ResourceIcon
                resource={
                  Object.keys(ResourcesIds).find(
                    (key) => ResourcesIds[key as keyof typeof ResourcesIds] === revealedResource,
                  ) || "Wood"
                }
                size="xxl"
                className="mb-2"
              />
              <h5>
                {Object.keys(ResourcesIds).find(
                  (key) => ResourcesIds[key as keyof typeof ResourcesIds] === revealedResource,
                ) + " Village"}
              </h5>
            </div>
          </motion.div>
        )}

        {/* Celebration effects */}
        {showCelebration && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 pointer-events-none"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                overflow: "visible",
              }}
            >
              {/* Confetti particles */}
              {Array.from({ length: 80 }).map((_, i) => {
                // Calculate even distribution from center
                const angle = Math.random() * Math.PI * 2; // Random angle in radians
                const distance = 30 + Math.random() * 40; // Distance from center (30-70%)

                return (
                  <motion.div
                    key={i}
                    initial={{
                      x: "-50%",
                      y: "-50%",
                      left: "50%",
                      top: "50%",
                      scale: 0,
                      opacity: 1,
                      rotate: 0,
                    }}
                    animate={{
                      x: `calc(-50% + ${Math.cos(angle) * distance}px)`,
                      y: `calc(-50% + ${Math.sin(angle) * distance}px)`,
                      scale: Math.random() * 2 + 1.5,
                      opacity: [1, 0.8, 0],
                      rotate: Math.random() * 720 - 360,
                      transition: {
                        duration: 2.5 + Math.random() * 1.5,
                        ease: "easeOut",
                      },
                    }}
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: "50%",
                      width: `${Math.random() * 16 + 8}px`,
                      height: `${Math.random() * 16 + 8}px`,
                      borderRadius: Math.random() > 0.3 ? "50%" : `${Math.random() * 5}px`,
                      backgroundColor: [
                        "#D4AF37", // Gold
                        "#C5A028", // Darker gold
                        "#E6BE44", // Lighter gold
                        "#F8F4E3", // Off-white
                        "#8B7355", // Brown
                        "#A67C52", // Light brown
                        "#5C4033", // Dark brown
                      ][Math.floor(Math.random() * 7)],
                      boxShadow: "0 0 12px 4px rgba(212, 175, 55, 0.5)",
                      zIndex: 30,
                    }}
                  />
                );
              })}

              {/* Burst effect at center */}
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{
                  scale: [0, 1.5],
                  opacity: [0, 0.8, 0],
                  transition: { duration: 1, ease: "easeOut" },
                }}
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  width: "80px",
                  height: "80px",
                  borderRadius: "50%",
                  background:
                    "radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(212,175,55,0.4) 70%, transparent 100%)",
                  transform: "translate(-50%, -50%)",
                  zIndex: 25,
                }}
              />

              {/* Shooting stars */}
              {Array.from({ length: 12 }).map((_, i) => {
                // Randomize direction of shooting stars
                const originX = Math.random() > 0.5 ? -10 : 110;
                const originY = Math.random() > 0.5 ? -10 : 110;
                const destX = Math.random() * 100;
                const destY = Math.random() * 100;

                return (
                  <motion.div
                    key={`star-${i}`}
                    initial={{
                      x: originX,
                      y: originY,
                      opacity: 0,
                    }}
                    animate={{
                      x: destX,
                      y: destY,
                      opacity: [0, 1, 1, 0],
                      transition: {
                        duration: 1 + Math.random(),
                        delay: Math.random() * 2,
                        ease: "linear",
                      },
                    }}
                    style={{
                      position: "absolute",
                      width: "4px",
                      height: "30px",
                      background: "linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(212,175,55,1) 100%)",
                      borderRadius: "50%",
                      boxShadow: "0 0 15px 5px rgba(212, 175, 55, 0.7)",
                      transform: `rotate(${Math.random() * 360}deg)`,
                      zIndex: 20,
                    }}
                  />
                );
              })}

              {/* Light flash */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{
                  opacity: [0, 0.8, 0],
                  transition: { duration: 1.2, ease: "easeOut" },
                }}
                className="absolute inset-0 bg-gold/40 z-10"
              />

              {/* Radial glow */}
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{
                  opacity: [0, 0.7, 0.5, 0.7, 0.3, 0],
                  scale: 2,
                  transition: {
                    duration: 3,
                    times: [0, 0.2, 0.4, 0.6, 0.8, 1],
                    repeat: 1,
                    repeatType: "reverse",
                  },
                }}
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  width: "200%",
                  height: "200%",
                  borderRadius: "50%",
                  background:
                    "radial-gradient(circle, rgba(212,175,55,0.8) 0%, rgba(166,124,82,0.4) 40%, transparent 70%)",
                  transform: "translate(-50%, -50%)",
                  zIndex: 10,
                }}
              />
            </motion.div>
          </>
        )}
      </div>

      {/* Start button (only visible if not spinning and not complete) */}
      {!isSpinning && !spinComplete && revealedResource && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={startSpin}
          className="mt-6 px-6 py-3 bg-gold hover:bg-gold/80 text-dark-brown font-bold rounded-lg shadow-lg"
        >
          Reveal Resource
        </motion.button>
      )}

      {/* Close and restart buttons */}
      <div className="flex gap-4 justify-center mt-8">
        <Button variant="gold" disabled={isSpinning} onClick={onRestart} className="px-8 py-4 text-base font-semibold">
          Mint New Village
        </Button>
        <Button variant="outline" disabled={isSpinning} onClick={onClose} className="px-8 py-4 text-base">
          Continue to your Village
        </Button>
      </div>
    </div>
  );
};
