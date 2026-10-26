import { env } from "@/../env";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import TwitterShareButton from "@/ui/design-system/molecules/twitter-share-button";
import { formatSocialText, twitterTemplates } from "@/ui/socials";
import { getGuildFromPlayerAddress } from "@bibliothecadao/eternum";
import { type PlayerNames, usePlayerName, usePlayerNames } from "@/hooks/use-player-profile";
import { useGame } from "@/hooks/context/game-context";
import { ContractAddress, formatCharge, ID, RESOURCE_PRECISION, resourceName } from "@bibliothecadao/types";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { useStoryEvents } from "@/hooks/store/use-story-events-store";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { AttackTarget } from "./types";
import { storyPayloadId } from "@/utils/native-id";

// Add the tweet formatting function
const getFormattedRaidTweet = ({
  names,
  accountAddress,
  targetAddress,
  stolenResources,
  store,
}: {
  names: PlayerNames;
  accountAddress: string;
  targetAddress: ContractAddress | null;
  stolenResources: Array<{ resourceId: number; amount: number }>;
  store: NativeFactStore;
}) => {
  const attackerGuild = getGuildFromPlayerAddress(ContractAddress(accountAddress), store)?.name;
  const defenderGuild = targetAddress ? getGuildFromPlayerAddress(ContractAddress(targetAddress), store)?.name : "";

  // Format the resources text
  const resourcesText = stolenResources
    .map((resource) => {
      return `${formatCharge(resource.amount)} ${resourceName(resource.resourceId)}`;
    })
    .join(", ");

  return formatSocialText(twitterTemplates.raid, {
    attackerNameText: `${names.text(accountAddress)} ${attackerGuild ? `from ${attackerGuild} tribe` : ""}`,
    defenderNameText: `${names.text(targetAddress ?? 0n)} ${defenderGuild ? `from ${defenderGuild}` : ""}`,
    raidResources: resourcesText,
    url: env.VITE_SOCIAL_LINK,
  });
};

/** The win's confetti, in the sheet's gold, ink and good. */
const CONFETTI = ["bg-hud-gold", "bg-hud-ink", "bg-hud-good"] as const;

export const RaidResult = ({
  raiderId,
  target,
  successRate = 50,
  stolenResources,
  transactionHash,
}: {
  transactionHash: string | null;
  raiderId: ID;
  target: AttackTarget;
  successRate?: number;
  stolenResources: {
    resourceId: number;
    amount: number;
  }[];
}) => {
  const {
    account: { account },
    setup: { store },
  } = useGame();

  const [spinComplete, setSpinComplete] = useState(false);
  const [isSlowingDown, setIsSlowingDown] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [outcomeItems, setOutcomeItems] = useState<Array<{ type: string; emoji: string }>>([]);

  const spinTimeout = useRef<NodeJS.Timeout | null>(null);
  const confettiTimeout = useRef<NodeJS.Timeout | null>(null);

  const { data: raids } = useStoryEvents(30, "RaidEvent");
  const raidResult = transactionHash
    ? raids.find(
        (event) =>
          BigInt(event.tx_hash) === BigInt(transactionHash) &&
          storyPayloadId(event.storyPayload.explorer_id) === raiderId &&
          storyPayloadId(event.storyPayload.structure_id) === target.id,
      )?.storyPayload
    : undefined;
  const initialStolenResources =
    raidResult?.success === true
      ? (raidResult.requested_loot as Array<{ resource_type: string; amount: string }>).map((resource) => ({
          resourceId: Number(resource.resource_type),
          amount: Number(resource.amount) / RESOURCE_PRECISION,
        }))
      : stolenResources;
  useEffect(() => {
    if (raidResult) setIsSlowingDown(true);
  }, [raidResult]);

  const names = usePlayerNames();

  // Both names are asked as the sheet draws, so they have landed by the time Share is pressed; the shared line is
  // written then, from the live name reader: never a cached string.
  usePlayerName(account.address);
  usePlayerName(target.addressOwner);
  const shareLine = () =>
    getFormattedRaidTweet({
      names,
      accountAddress: account.address,
      targetAddress: target.addressOwner,
      stolenResources: initialStolenResources,
      store,
    });

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
      const shuffled = itemPool.toSorted(() => 0.5 - Math.random());
      return shuffled.slice(0, count);
    },
    [successRate],
  );

  useEffect(() => {
    // Generate initial wheel items
    setOutcomeItems(generateOutcomeItems(20));
  }, [generateOutcomeItems]);

  useEffect(() => {
    if (raidResult && isSlowingDown) {
      // Finish spinning after 2 seconds of slowing down
      spinTimeout.current = setTimeout(() => {
        setSpinComplete(true);

        // Show celebration effects after revealing the result
        confettiTimeout.current = setTimeout(() => {
          setShowCelebration(true);
        }, 500);
      }, 2000);
    }

    return () => {
      if (spinTimeout.current) clearTimeout(spinTimeout.current);
      if (confettiTimeout.current) clearTimeout(confettiTimeout.current);
    };
  }, [raidResult, isSlowingDown]);

  // Determine outcome text and styles
  const outcomeText = raidResult?.success === true ? "Raid Successful!" : "Raid Failed!";
  const outcomeColor = raidResult?.success === true ? "text-hud-good" : "text-hud-bad";
  const outcomeBgColor = raidResult?.success === true ? "bg-hud-chosen" : "bg-hud-well";
  const outcomeBorderColor = raidResult?.success === true ? "border-hud-good" : "border-hud-bad";
  const outcomeEmoji = raidResult?.success === true ? "💰" : "💀";

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div className="text-center mb-4">
        <h3 className="text-hud-display text-hud-accent">Raid Result</h3>
        <p className="text-hud-body text-hud-muted">
          {raidResult
            ? spinComplete
              ? `${outcomeText} ${raidResult.success ? "Resources were captured!" : "Your troops were repelled!"}`
              : "Determining raid outcome..."
            : "Waiting for raid transaction..."}
        </p>
      </div>

      <div className="relative w-64 h-64 overflow-hidden rounded-2xl border-4 border-hud-line bg-hud-well backdrop-blur-sm shadow-xl">
        {/* Spinning roulette container */}
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
          <AnimatePresence>
            {!spinComplete && (
              <div className="absolute w-full h-64 overflow-hidden">
                <motion.div
                  className="absolute flex flex-col items-center gap-4 w-full"
                  style={{
                    top: 0,
                    left: 0,
                    right: 0,
                  }}
                  animate={{
                    y: [0, -2000],
                    transition: {
                      y: {
                        duration: isSlowingDown ? 0.5 : 3,
                        ease: isSlowingDown ? "easeOut" : "linear",
                        repeat: isSlowingDown ? 0 : Infinity,
                        repeatType: "loop",
                      },
                    },
                  }}
                >
                  {/* Create a repeating pattern with enough items for seamless looping */}
                  {[...Array(60)].map((_, i) => {
                    const item = outcomeItems[i % outcomeItems.length];
                    return (
                      <div
                        key={`spin-item-${i}`}
                        className={`p-4 rounded-lg shadow-inner flex items-center justify-center text-hud-display
                          ${item?.type === "success" ? "bg-hud-chosen" : "bg-hud-well"}`}
                      >
                        {item?.emoji}
                      </div>
                    );
                  })}
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Revealed result (shown after spin) */}
        {spinComplete && raidResult && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{
              scale: 1,
              opacity: 1,
              transition: { type: "spring", stiffness: 300, damping: 15 },
            }}
            className="absolute inset-0 flex flex-col items-center justify-center p-4"
          >
            <div className="text-hud-title mb-2 text-hud-accent">Raid Result:</div>
            <div
              className={`p-6 ${outcomeBgColor} rounded-xl shadow-inner flex flex-col items-center justify-center border-2 ${outcomeBorderColor}`}
            >
              <div className="text-hud-display mb-2">{outcomeEmoji}</div>
              <div className={`text-hud-display ${outcomeColor} mt-2`}>{outcomeText}</div>
            </div>
          </motion.div>
        )}

        {/* Celebration effects (only on success) */}
        {showCelebration && raidResult?.success === true && (
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
                  className={CONFETTI[i % CONFETTI.length]}
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
                background: "radial-gradient(circle, var(--hud-good) 0%, transparent 70%)",
                transform: "translate(-50%, -50%)",
                zIndex: 25,
              }}
            />
          </motion.div>
        )}

        {/* Failure effects (only on failure) */}
        {showCelebration && raidResult && !raidResult.success === true && (
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
              className="absolute inset-0 bg-hud-bad z-10"
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
                    background: "radial-gradient(circle, var(--hud-neutral) 0%, transparent 100%)",
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
      {spinComplete && raidResult && (
        <div className="mt-6 w-full max-w-md">
          <div className={`p-4 rounded-lg border ${outcomeBorderColor} text-center`}>
            <h4 className={`text-hud-title ${outcomeColor} mb-2`}>
              {raidResult.success ? "Raid Successful" : "Raid Repelled"}
            </h4>

            {/* Show stolen resources only if raid was successful */}
            {raidResult.success === true && initialStolenResources.length > 0 ? (
              <div className="mt-3 pt-3 border-t border-hud-divider">
                <h5 className="text-md text-hud-strong text-hud-accent mb-2">Stolen Resources:</h5>
                {initialStolenResources.map((resource, index) => (
                  <div key={index} className="flex justify-between items-center py-1">
                    <span className="flex items-center text-hud-accent">
                      <ResourceIcon resource={resource.resourceId} size={"lg"} className="mr-2" />
                      Resource: {resourceName(resource.resourceId)}
                    </span>
                    <span className="text-hud-good">{formatCharge(resource.amount)}</span>
                  </div>
                ))}
              </div>
            ) : (
              !raidResult.success === true && (
                <div className="mt-3 pt-3 border-t border-hud-divider">
                  <div className="flex flex-col items-center text-hud-bad">
                    <p>Raid failed. Nothing stolen.</p>
                  </div>
                </div>
              )
            )}

            {/* Add Twitter Share Button */}
            {raidResult.success === true && (
              <div className="mt-4 pt-4 border-t border-hud-divider">
                <TwitterShareButton text={shareLine} callToActionText="Share your Raid" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
