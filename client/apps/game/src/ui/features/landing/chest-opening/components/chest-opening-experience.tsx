import { useLootChestOpeningStore } from "@/hooks/store/use-loot-chest-opening-store";
import { useCallback, useEffect, useState } from "react";
import { useChestContent } from "../hooks/use-chest-content";
import { useChestOpeningFlow } from "../hooks/use-chest-opening-flow";
import { useOpenChest } from "../hooks/use-open-chest";
import { useOwnedChests } from "../hooks/use-owned-chests";
import { getMockRevealAssets, MOCK_CHEST_OPENING } from "../hooks/mock-data";
import { AssetRarity, getHighestRarity } from "../utils/cosmetics";
import { ChestSelectionModal } from "./chest-selection-modal";
import { getChestOpeningVideo, OpeningStage } from "./opening-stage";
import { PendingOverlay } from "./pending-overlay";
import { RevealStage } from "./reveal-stage";

interface ChestOpeningExperienceProps {
  /** Called when experience is closed */
  onClose?: () => void;
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
export function ChestOpeningExperience({ onClose }: ChestOpeningExperienceProps) {
  const { flowState, actions } = useChestOpeningFlow();
  const { openChest, isLoading: isOpeningChest } = useOpenChest();
  const { ownedChests, refetch: refetchChests } = useOwnedChests();
  const { chestOpenTimestamp, setShowLootChestOpening, chestAssets: storeAssets } = useLootChestOpeningStore();

  // Listen for CollectibleClaimed events
  const { chestContent, resetChestContent } = useChestContent(MOCK_CHEST_OPENING, chestOpenTimestamp);

  // Local state for revealed assets (from events or mock)
  const [revealedAssets, setRevealedAssets] = useState(storeAssets);

  // Track if reveal has been triggered to prevent double-triggering
  const [hasTriggeredReveal, setHasTriggeredReveal] = useState(false);

  // Determine highest rarity for video selection
  const chestRarity = revealedAssets.length > 0 ? getHighestRarity(revealedAssets) : AssetRarity.Common;

  // Get video URL based on selected chest's epoch and revealed rarity
  const videoSrc = getChestOpeningVideo(chestRarity, flowState.selectedChestEpoch);

  // Calculate remaining chests (after current one opens)
  const remainingChestsCount = Math.max(0, ownedChests.length - 1);

  // Handle chest selection and opening
  const handleChestSelect = useCallback(
    (chestId: string, epoch: typeof flowState.selectedChestEpoch) => {
      actions.selectChest(chestId, epoch);

      // Reset state for new open
      resetChestContent();
      setRevealedAssets([]);
      setHasTriggeredReveal(false);

      if (MOCK_CHEST_OPENING) {
        // Mock mode: simulate immediate pending
        actions.startPending();
        // Mock assets will be set when transitioning to opening
      } else {
        // Real mode: call blockchain
        openChest({
          tokenId: BigInt(chestId),
          onSuccess: () => {
            actions.startPending();
          },
          onError: (error) => {
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

  // Handle open another chest
  const handleOpenAnother = useCallback(() => {
    // Refetch chests list
    refetchChests();
    // Reset to selection state
    actions.reset();
    resetChestContent();
    setRevealedAssets([]);
    setHasTriggeredReveal(false);
  }, [actions, refetchChests, resetChestContent]);

  // Handle close
  const handleClose = useCallback(() => {
    actions.cancel();
    setShowLootChestOpening(false);
    onClose?.();
  }, [actions, setShowLootChestOpening, onClose]);

  // Open selection modal on mount
  useEffect(() => {
    if (flowState.state === "idle") {
      actions.openSelection();
    }
  }, [flowState.state, actions]);

  return (
    <>
      {/* Selection Modal */}
      <ChestSelectionModal
        isOpen={flowState.state === "selecting"}
        chests={ownedChests}
        onSelect={handleChestSelect}
        onClose={handleClose}
        isLoading={isOpeningChest}
        selectedChestId={flowState.selectedChestId}
      />

      {/* Pending Overlay */}
      <PendingOverlay
        active={flowState.state === "pending"}
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

      {/* Opening Video Stage */}
      <OpeningStage
        active={flowState.state === "opening"}
        videoSrc={videoSrc}
        onComplete={handleVideoComplete}
        onSkip={handleSkipVideo}
      />

      {/* Reveal Stage */}
      <RevealStage
        assets={revealedAssets}
        chestRarity={chestRarity}
        onComplete={handleRevealComplete}
        showContent={flowState.state === "reveal" || flowState.state === "done"}
        onClose={handleClose}
        onOpenAnother={handleOpenAnother}
        remainingChestsCount={remainingChestsCount}
        isDone={flowState.state === "done"}
      />
    </>
  );
}
