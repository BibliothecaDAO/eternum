import Button from "@/ui/elements/button";
import { ContractAddress, HexPosition, ResourcesIds, unpackValue } from "@bibliothecadao/eternum";
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
      <div className="text-xl font-bold mb-4 text-center">Resource Discovery</div>

      <div className="relative w-64 h-64 overflow-hidden rounded-2xl border-4 border-amber-700 bg-amber-900/30 backdrop-blur-sm shadow-xl">
        {/* Spinning roulette container */}
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-amber-800/40 to-amber-950/40">
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
                    className="p-2 bg-amber-800/50 rounded-lg shadow-inner flex items-center justify-center"
                  >
                    <ResourceIcon resource={resource} size="xl" className="" />
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Center marker */}
          <div className="absolute left-0 right-0 h-16 z-10 pointer-events-none flex items-center justify-center">
            <div className="w-full h-full bg-gradient-to-r from-amber-600/0 via-amber-400/80 to-amber-600/0 animate-pulse"></div>
            <div className="absolute left-0 w-4 h-16 bg-amber-300/80 -skew-x-12"></div>
            <div className="absolute right-0 w-4 h-16 bg-amber-300/80 skew-x-12"></div>
          </div>
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
            <div className="text-lg font-bold mb-2 text-amber-100">You minted:</div>
            <div className="p-6 bg-amber-800/70 rounded-xl shadow-inner flex flex-col items-center justify-center">
              <ResourceIcon
                resource={
                  Object.keys(ResourcesIds).find(
                    (key) => ResourcesIds[key as keyof typeof ResourcesIds] === revealedResource,
                  ) || "Wood"
                }
                size="xxl"
                className="mb-2"
              />
              <div className="text-xl font-bold text-amber-100 mt-2">
                {Object.keys(ResourcesIds).find(
                  (key) => ResourcesIds[key as keyof typeof ResourcesIds] === revealedResource,
                ) + " Village"}
              </div>
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
            >
              {/* Particles */}
              {Array.from({ length: 20 }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{
                    x: "50%",
                    y: "50%",
                    scale: 0,
                    opacity: 1,
                  }}
                  animate={{
                    x: `${Math.random() * 100}%`,
                    y: `${Math.random() * 100}%`,
                    scale: Math.random() * 0.5 + 0.5,
                    opacity: 0,
                    transition: {
                      duration: 1.5 + Math.random(),
                      ease: "easeOut",
                    },
                  }}
                  className="absolute w-3 h-3 rounded-full"
                  style={{
                    backgroundColor: ["#FFD700", "#FFA500", "#FF4500", "#FF8C00"][Math.floor(Math.random() * 4)],
                  }}
                />
              ))}

              {/* Light rays */}
              <div className="absolute inset-0 bg-gradient-radial from-amber-400/20 to-transparent animate-pulse"></div>
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
          className="mt-6 px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg shadow-lg"
        >
          Reveal Resource
        </motion.button>
      )}

      {/* Close and restart buttons */}
      <div className="flex gap-4 justify-center mt-8">
        <Button
          variant="primary"
          disabled={isSpinning}
          onClick={onRestart}
          className="px-8 py-4 text-base font-semibold"
        >
          Mint New Village
        </Button>
        <Button variant="outline" disabled={isSpinning} onClick={onClose} className="px-8 py-4 text-base">
          Close
        </Button>
      </div>
    </div>
  );
};
