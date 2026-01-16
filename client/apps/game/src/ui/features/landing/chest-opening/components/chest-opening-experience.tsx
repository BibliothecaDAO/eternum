import { useLootChestOpeningStore } from "@/hooks/store/use-loot-chest-opening-store";
import Button from "@/ui/design-system/atoms/button";
import { Package } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getMockRevealAssets, MOCK_CHEST_OPENING } from "../hooks/mock-data";
import { useChestContent } from "../hooks/use-chest-content";
import { ChestEpoch, useChestOpeningFlow } from "../hooks/use-chest-opening-flow";
import { useOpenChest } from "../hooks/use-open-chest";
import { useOwnedChests } from "../hooks/use-owned-chests";
import { AssetRarity, getHighestRarity } from "../utils/cosmetics";
import { ChestStageContainer, ChestStageContent } from "./chest-stage-container";
import { getChestOpeningVideo, OpeningStage } from "./opening-stage";
import { PendingOverlay } from "./pending-overlay";
import { RevealStage } from "./reveal-stage";

interface ChestOpeningExperienceProps {
  /** Called when experience is closed */
  onClose?: () => void;
  /** Pre-selected chest ID to skip selection modal */
  initialChestId?: string;
  /** Pre-selected chest epoch */
  initialEpoch?: ChestEpoch;
}

/**
 * ChestOpeningExperience - Main orchestrator for the chest opening flow.
 *
 * Manages the complete user flow:
 * 1. Selection: User selects which chest to open
 * 2. Pending: Waiting for blockchain confirmation
 * 3. Opening: Playing the chest opening video
 * 4. Reveal: Showing the revealed items
 */
export function ChestOpeningExperience({ onClose, initialChestId, initialEpoch }: ChestOpeningExperienceProps) {
  const { flowState, actions } = useChestOpeningFlow();
  const { openChest, isLoading: isOpeningChest } = useOpenChest();
  const { ownedChests, refetch: refetchChests } = useOwnedChests();
  const { chestOpenTimestamp, setShowLootChestOpening, chestAssets: storeAssets } = useLootChestOpeningStore();

  // Listen for CollectibleClaimed events
  const { chestContent, resetChestContent } = useChestContent(MOCK_CHEST_OPENING, chestOpenTimestamp);

  useEffect(() => {
    console.log({
      flowState,
      actions,
      openChest,
      isOpeningChest,
      ownedChests,
      refetchChests,
      chestOpenTimestamp,
      setShowLootChestOpening,
      storeAssets,
      chestContent,
      resetChestContent,
    });
  }, [
    flowState,
    actions,
    openChest,
    isOpeningChest,
    ownedChests,
    refetchChests,
    chestOpenTimestamp,
    setShowLootChestOpening,
    storeAssets,
    chestContent,
    resetChestContent,
  ]);

  // Local state for revealed assets (from events or mock)
  const [revealedAssets, setRevealedAssets] = useState(storeAssets);

  // Track if reveal has been triggered to prevent double-triggering
  const [hasTriggeredReveal, setHasTriggeredReveal] = useState(false);

  // Track if we've already started opening to prevent multiple calls
  const hasStartedOpening = useRef(false);

  // Determine highest rarity for video selection
  const chestRarity = revealedAssets.length > 0 ? getHighestRarity(revealedAssets) : AssetRarity.Common;

  // Get video URL based on selected chest's epoch and revealed rarity
  const videoSrc = getChestOpeningVideo(chestRarity, flowState.selectedChestEpoch);

  // Calculate remaining chests (after current one opens)
  const remainingChestsCount = Math.max(0, ownedChests.length - 1);

  // Handle chest selection and opening
  const handleChestSelect = useCallback(
    (chestId: string, epoch: typeof flowState.selectedChestEpoch) => {
      console.log("handleChestSelect called with:", { chestId, epoch });
      actions.selectChest(chestId, epoch);

      // Reset state for new open
      resetChestContent();
      setRevealedAssets([]);
      setHasTriggeredReveal(false);

      // Immediately show pending state while transaction processes
      actions.startPending();

      console.log("MOCK_CHEST_OPENING:", MOCK_CHEST_OPENING);
      if (MOCK_CHEST_OPENING) {
        // Mock mode: assets will be generated in the pending effect
        console.log("Mock mode: pending started");
      } else {
        // Real mode: call blockchain
        console.log("Real mode: calling openChest with tokenId:", chestId);
        openChest({
          tokenId: BigInt(chestId),
          onSuccess: () => {
            console.log("openChest onSuccess called");
            // State is already "pending", transaction complete - wait for events
          },
          onError: (error) => {
            console.log("openChest onError called:", error);
            actions.setError(error);
          },
        });
      }
    },
    [actions, openChest, resetChestContent],
  );

  // When chest content is received from events (or mock), transition to opening
  useEffect(() => {
    if (flowState.state === "pending" && !hasTriggeredReveal) {
      if (MOCK_CHEST_OPENING) {
        // Mock mode: generate random assets and transition
        const mockAssets = getMockRevealAssets(3);
        setRevealedAssets(mockAssets);
        setHasTriggeredReveal(true);
        // The mock delay in startPending will trigger transition to "opening"
      } else if (chestContent.length > 0) {
        // Real mode: use assets from events
        setRevealedAssets(chestContent);
        setHasTriggeredReveal(true);
        actions.startOpening();
      }
    }
  }, [flowState.state, chestContent, hasTriggeredReveal, actions]);

  // Handle video completion -> reveal
  const handleVideoComplete = useCallback(() => {
    actions.startReveal();
  }, [actions]);

  // Handle reveal completion -> done
  const handleRevealComplete = useCallback(() => {
    actions.complete();
  }, [actions]);

  // Handle skip video -> go directly to reveal
  const handleSkipVideo = useCallback(() => {
    actions.startReveal();
  }, [actions]);

  // Handle close
  const handleClose = useCallback(() => {
    actions.cancel();
    setShowLootChestOpening(false);
    onClose?.();
  }, [actions, setShowLootChestOpening, onClose]);

  // Handle open another chest - close experience and return to ChestGallery
  const handleOpenAnother = useCallback(() => {
    refetchChests();
    handleClose();
  }, [refetchChests, handleClose]);

  // On mount: start opening the pre-selected chest directly
  useEffect(() => {
    console.log("ChestOpeningExperience mount effect:", {
      flowState: flowState.state,
      initialChestId,
      initialEpoch,
      hasStartedOpening: hasStartedOpening.current,
    });
    if (flowState.state === "idle" && initialChestId && !hasStartedOpening.current) {
      hasStartedOpening.current = true;
      console.log("Calling handleChestSelect with:", initialChestId, initialEpoch);
      handleChestSelect(initialChestId, initialEpoch ?? "eternum-rewards-s1");
    }
  }, [flowState.state, initialChestId, initialEpoch, handleChestSelect]);

  return (
    <>
      {/* Pending Overlay - only render when pending */}
      {flowState.state === "pending" && (
        <PendingOverlay
          active={true}
          title="Opening chest"
          subtitle="Waiting for confirmation..."
          error={flowState.error}
          onClose={handleClose}
          onRetry={() => {
            // Reset and try again
            actions.reset();
            resetChestContent();
            setRevealedAssets([]);
            setHasTriggeredReveal(false);
          }}
        />
      )}

      {/* Opening Video Stage - only render when opening */}
      {flowState.state === "opening" && (
        <OpeningStage active={true} videoSrc={videoSrc} onComplete={handleVideoComplete} onSkip={handleSkipVideo} />
      )}

      {/* Reveal Stage - only render when reveal/done and has assets */}
      {(flowState.state === "reveal" || flowState.state === "done") && revealedAssets.length > 0 && (
        <RevealStage
          assets={revealedAssets}
          chestRarity={chestRarity}
          onComplete={handleRevealComplete}
          showContent={true}
          onClose={handleClose}
          onOpenAnother={handleOpenAnother}
          remainingChestsCount={remainingChestsCount}
          isDone={flowState.state === "done"}
        />
      )}

      {/* Error State */}
      {flowState.error && (
        <ChestStageContainer>
          <ChestStageContent>
            <div className="text-center space-y-4">
              <Package className="w-16 h-16 text-red-500 mx-auto" />
              <h2 className="text-2xl font-bold text-red-500">Failed to Open Chest</h2>
              <p className="text-white/60 max-w-sm">{flowState.error.message}</p>
              <div className="flex gap-4 justify-center mt-6">
                <Button variant="outline" onClick={handleClose}>
                  Close
                </Button>
                <Button variant="primary" onClick={handleClose}>
                  Try Again
                </Button>
              </div>
            </div>
          </ChestStageContent>
        </ChestStageContainer>
      )}
    </>
  );
}
