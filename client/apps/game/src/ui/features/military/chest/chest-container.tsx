import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { useDojo } from "@bibliothecadao/react";
import { ClientComponents, ID, resources, world } from "@bibliothecadao/types";
import { ComponentValue, defineComponentSystem, isComponentUpdate } from "@dojoengine/recs";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { soundSelector, useUiSounds } from "@/hooks/helpers/use-ui-sound";

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
        // const result = await systemCalls.open_chest({
        //   signer: account,
        //   explorer_id: explorerEntityId,
        //   chest_coord: {
        //     x: chestHex.x,
        //     y: chestHex.y,
        //   },
        // });
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
      <div className="flex flex-col items-center justify-center p-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="flex flex-col items-center"
        >
          <div className="text-gold text-2xl mb-4">🎉 Chest Opened!</div>
          <img src="/images/relic-chest/chest-opened.png" alt="Open Chest" className="w-48 h-48 mb-4" />
          <p className="text-gold mb-4">Relics discovered!</p>

          {/* Display found relics */}
          {chestResult.relics && chestResult.relics.length > 0 && (
            <div className="mt-4 p-4 bg-dark-brown/50 rounded-lg border border-gold/20">
              <h5 className="text-md font-semibold text-gold mb-2">Found Relics:</h5>
              <div className="flex flex-wrap gap-2">
                {chestResult.relics.map((relicId, index) => {
                  const resource = resources.find((r) => r.id === relicId);
                  return (
                    <div key={index} className="flex items-center bg-gold/10 rounded px-2 py-1">
                      <ResourceIcon resource={resource?.trait || ""} size={"sm"} className="mr-1" />
                      <span className="text-gold text-sm">{resource?.trait || `Relic ${relicId}`}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <p className="text-gold/70 text-sm mt-4 text-center">
            The relics have been added to your explorer's inventory.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-8">
      <div className="text-gold text-xl mb-4">📦 Relic Chest</div>
      <p className="text-gold/80 mb-6 text-center max-w-md">
        This chest contains valuable relics that can enhance your structures and armies. Click on the chest to open it!
      </p>

      <div className="mb-6">
        <p className="text-gold/60 text-sm">Explorer: #{explorerEntityId}</p>
        <p className="text-gold/60 text-sm">
          Chest Location: ({chestHex.x}, {chestHex.y})
        </p>
      </div>

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
    </div>
  );
};
