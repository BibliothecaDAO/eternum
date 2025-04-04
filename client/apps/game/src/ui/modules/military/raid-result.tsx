import { ResourceIcon } from "@/ui/elements/resource-icon";
import { getBlockTimestamp } from "@/utils/timestamp";
import { ClientComponents, getEntityIdFromKeys, ID, resources } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { useComponentValue } from "@dojoengine/react";
import { ComponentValue } from "@dojoengine/recs";
import { syncEvents } from "@dojoengine/state";
import { Subscription } from "@dojoengine/torii-wasm";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

export const RaidResult = ({
  raiderId,
  structureId,
  successRate = 50,
  stolenResources,
}: {
  raiderId: ID;
  structureId: ID;
  successRate?: number;
  stolenResources: {
    resourceId: number;
    amount: number;
  }[];
}) => {
  const {
    setup: {
      network: { toriiClient, contractComponents },
    },
  } = useDojo();

  const [initialStolenResources] = useState(stolenResources);

  const [raidTimestamp, setRaidTimestamp] = useState<number | null>(null);
  const [spinComplete, setSpinComplete] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [outcomeItems, setOutcomeItems] = useState<Array<{ type: string; emoji: string }>>([]);

  const spinTimeout = useRef<NodeJS.Timeout | null>(null);
  const confettiTimeout = useRef<NodeJS.Timeout | null>(null);

  const [latestRaidResult, setLatestRaidResult] = useState<ComponentValue<
    ClientComponents["events"]["ExplorerRaidEvent"]["schema"]
  > | null>(null);

  const raidResult = useComponentValue(
    contractComponents.events.ExplorerRaidEvent,
    getEntityIdFromKeys([BigInt(raiderId), BigInt(structureId)]),
  );

  // Generate random outcome items for the roulette animation
  const generateOutcomeItems = useCallback(
    (count: number) => {
      // Create a pool with a mix of success and failure items
      const successItems = [
        { type: "success", emoji: "💰" },
        { type: "success", emoji: "✅" },
        { type: "success", emoji: "🏆" },
        { type: "success", emoji: "👑" },
      ];

      const failureItems = [
        { type: "failure", emoji: "💀" },
        { type: "failure", emoji: "❌" },
        { type: "failure", emoji: "⚔️" },
        { type: "failure", emoji: "🔥" },
      ];

      // Weight the items based on success rate
      const itemPool = [
        ...Array(Math.round(successRate / 10))
          .fill(successItems)
          .flat(),
        ...Array(Math.round((100 - successRate) / 10))
          .fill(failureItems)
          .flat(),
      ];

      // Shuffle and take the requested number of items
      const shuffled = [...itemPool].sort(() => 0.5 - Math.random());
      return shuffled.slice(0, count);
    },
    [successRate],
  );

  useEffect(() => {
    setRaidTimestamp(getBlockTimestamp().currentBlockTimestamp);

    // Generate initial wheel items
    setOutcomeItems(generateOutcomeItems(20));
  }, [generateOutcomeItems]);

  useEffect(() => {
    if (raidResult && raidTimestamp) {
      if (raidResult.timestamp > raidTimestamp) {
        setLatestRaidResult(raidResult);
      }
    }
  }, [raidResult, raidTimestamp]);

  useEffect(() => {
    if (latestRaidResult) {
      // Finish spinning after 3 seconds
      spinTimeout.current = setTimeout(() => {
        setSpinComplete(true);

        // Show celebration effects after revealing the result
        confettiTimeout.current = setTimeout(() => {
          setShowCelebration(true);
        }, 500);
      }, 1000);
    }

    return () => {
      if (spinTimeout.current) clearTimeout(spinTimeout.current);
      if (confettiTimeout.current) clearTimeout(confettiTimeout.current);
    };
  }, [latestRaidResult]);

  useEffect(() => {
    let sub: Subscription | undefined;
    const syncRaidResult = async () => {
      sub = await syncEvents(
        toriiClient,
        contractComponents.events as any,
        [
          {
            Keys: {
              keys: [raiderId.toString(), structureId.toString()],
              pattern_matching: "FixedLen",
              models: ["s1_eternum-ExplorerRaidEvent"],
            },
          },
        ],
        // logging
        false,
        // historical
        false,
      );
    };
    if (raiderId && structureId) {
      syncRaidResult();
    }

    return () => {
      sub?.free();
    };
  }, [raiderId, structureId]);

  // Determine outcome text and styles
  const outcomeText = latestRaidResult?.success ? "Raid Successful!" : "Raid Failed!";
  const outcomeColor = latestRaidResult?.success ? "text-order-brilliance" : "text-order-giants";
  const outcomeBgColor = latestRaidResult?.success ? "bg-order-brilliance/20" : "bg-order-giants/20";
  const outcomeBorderColor = latestRaidResult?.success ? "border-order-brilliance/30" : "border-order-giants/30";
  const outcomeEmoji = latestRaidResult?.success ? "💰" : "💀";

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div className="text-center mb-4">
        <h3 className="text-xl font-bold text-gold">Raid Result</h3>
        <p className="text-sm text-gold/70">
          {latestRaidResult
            ? spinComplete
              ? `${outcomeText} ${latestRaidResult.success ? "Resources were captured!" : "Your troops were repelled!"}`
              : "Determining raid outcome..."
            : "Waiting for raid transaction..."}
        </p>
      </div>

      <div className="relative w-64 h-64 overflow-hidden rounded-2xl border-4 border-gold/30 bg-dark-brown/80 backdrop-blur-sm shadow-xl">
        {/* Spinning roulette container */}
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-dark-brown/60 to-dark-brown/90">
          <AnimatePresence>
            {!spinComplete && (
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
                {outcomeItems.map((item, index) => (
                  <div
                    key={`${item.emoji}-${index}`}
                    className={`p-4 rounded-lg shadow-inner flex items-center justify-center text-2xl
                      ${item.type === "success" ? "bg-order-brilliance/20" : "bg-order-giants/20"}`}
                  >
                    {item.emoji}
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Revealed result (shown after spin) */}
        {spinComplete && latestRaidResult && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{
              scale: 1,
              opacity: 1,
              transition: { type: "spring", stiffness: 300, damping: 15 },
            }}
            className="absolute inset-0 flex flex-col items-center justify-center p-4"
          >
            <div className="text-lg font-bold mb-2 text-gold">Raid Result:</div>
            <div
              className={`p-6 ${outcomeBgColor} rounded-xl shadow-inner flex flex-col items-center justify-center border-2 ${outcomeBorderColor}`}
            >
              <div className="text-5xl mb-2">{outcomeEmoji}</div>
              <div className={`text-2xl font-bold ${outcomeColor} mt-2`}>{outcomeText}</div>
            </div>
          </motion.div>
        )}

        {/* Celebration effects (only on success) */}
        {showCelebration && latestRaidResult?.success && (
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
            {Array.from({ length: 60 }).map((_, i) => {
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
                      "#5C7D11", // Green (for success)
                      "#7FB935", // Light green
                      "#3D5E0F", // Dark green
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
                  "radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(92,125,17,0.4) 70%, transparent 100%)",
                transform: "translate(-50%, -50%)",
                zIndex: 25,
              }}
            />
          </motion.div>
        )}

        {/* Failure effects (only on failure) */}
        {showCelebration && latestRaidResult && !latestRaidResult.success && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 pointer-events-none"
          >
            {/* Red flash */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{
                opacity: [0, 0.4, 0],
                transition: { duration: 1.5, ease: "easeOut", times: [0, 0.3, 1] },
              }}
              className="absolute inset-0 bg-red-800/40 z-10"
            />

            {/* Smoke particles */}
            {Array.from({ length: 20 }).map((_, i) => {
              const angle = Math.random() * Math.PI * 2;
              const distance = 20 + Math.random() * 30;

              return (
                <motion.div
                  key={i}
                  initial={{
                    x: "-50%",
                    y: "-50%",
                    left: "50%",
                    top: "50%",
                    scale: 0,
                    opacity: 0,
                  }}
                  animate={{
                    x: `calc(-50% + ${Math.cos(angle) * distance}px)`,
                    y: `calc(-50% + ${Math.sin(angle) * distance}px)`,
                    scale: [0, 2 + Math.random() * 2],
                    opacity: [0, 0.7, 0],
                    transition: {
                      duration: 2 + Math.random(),
                      ease: "easeOut",
                    },
                  }}
                  style={{
                    position: "absolute",
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    background:
                      "radial-gradient(circle, rgba(100,100,100,0.8) 0%, rgba(70,70,70,0.5) 50%, transparent 100%)",
                    filter: "blur(3px)",
                    zIndex: 20,
                  }}
                />
              );
            })}
          </motion.div>
        )}
      </div>

      {/* Additional result details */}
      {spinComplete && latestRaidResult && (
        <div className="mt-6 w-full max-w-md">
          <div className={`p-4 rounded-lg border ${outcomeBorderColor} text-center`}>
            <h4 className={`text-lg font-bold ${outcomeColor} mb-2`}>
              {latestRaidResult.success ? "Raid Successful" : "Raid Repelled"}
            </h4>

            {/* Show stolen resources only if raid was successful */}
            {latestRaidResult.success && initialStolenResources.length > 0 ? (
              <div className="mt-3 pt-3 border-t border-gold/10">
                <h5 className="text-md font-semibold text-gold mb-2">Stolen Resources:</h5>
                {initialStolenResources.map((resource, index) => (
                  <div key={index} className="flex justify-between items-center py-1">
                    <span className="flex items-center text-gold/80">
                      <ResourceIcon
                        resource={resources.find((r) => r.id === resource.resourceId)?.trait || ""}
                        size={"lg"}
                        className="mr-2"
                      />
                      Resource: {resources.find((r) => r.id === resource.resourceId)?.trait || ""}
                    </span>
                    <span className="text-order-brilliance font-medium">{resource.amount}</span>
                  </div>
                ))}
              </div>
            ) : (
              !latestRaidResult.success && (
                <div className="mt-3 pt-3 border-t border-gold/10">
                  <div className="flex flex-col items-center text-red-400">
                    <p>Your raid was unsuccessful. No resources were stolen.</p>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};
