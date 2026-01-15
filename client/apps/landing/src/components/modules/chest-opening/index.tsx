import { Button } from "@/components/ui/button";
import { useChestContent } from "@/hooks/use-chest-content";
import { useOpenChest } from "@/hooks/use-open-chest";
import { useLootChestOpeningStore } from "@/stores/loot-chest-opening";
import { MergedNftData } from "@/types";
import { ChestAsset, getHighestRarity } from "@/utils/cosmetics";
import { Package } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { env } from "../../../../env";
import { ChestSelectionModal } from "./chest-selection-modal";
import { ChestStageContainer, ChestStageContent } from "./chest-stage-container";
import { MOCK_CHEST_OPENING, getMockRevealAssets } from "./mock-data";
import { OpeningStage, getChestOpeningVideo } from "./opening-stage";
import { PendingOverlay } from "./pending-overlay";
import { RevealStage } from "./reveal-stage";
import { ChestEpoch, useChestOpeningFlow } from "./use-chest-opening-flow";

// Re-export components for external use
export { FloatingOpenButton } from "./floating-open-button";
export { TiltCard } from "./tilt-card";
export type { ChestOpeningState } from "./use-chest-opening-flow";

interface ChestOpeningExperienceProps {
  ownedChests: MergedNftData[];
  onClose: () => void;
}

export function ChestOpeningExperience({ ownedChests, onClose }: ChestOpeningExperienceProps) {
  const { flowState, actions } = useChestOpeningFlow();
  const { openChest, isLoading: isOpenChestLoading } = useOpenChest();
  const { chestOpenTimestamp, setShowLootChestOpening } = useLootChestOpeningStore();

  // Track content visibility for animations
  const [showRevealContent, setShowRevealContent] = useState(false);

  // Get chest content (real or mocked)
  const { chestContent, resetChestContent } = useChestContent(
    MOCK_CHEST_OPENING || env.VITE_PUBLIC_CHEST_DEBUG_MODE,
    chestOpenTimestamp,
  );

  // Mock content for testing
  const [mockContent, setMockContent] = useState<ChestAsset[]>([]);

  // Use mock content when in mock mode
  const displayContent = MOCK_CHEST_OPENING ? mockContent : chestContent;

  // Calculate remaining chests after current selection
  const remainingChests = flowState.selectedChestId
    ? ownedChests.filter((c) => c.token_id !== flowState.selectedChestId)
    : ownedChests;

  // Watch for chest content to transition from pending to opening
  useEffect(() => {
    if (displayContent.length > 0 && flowState.state === "pending") {
      actions.startOpening();
    }
  }, [displayContent, flowState.state, actions]);

  // Handle chest selection
  const handleSelectChest = useCallback(
    async (chestId: string, epoch: ChestEpoch) => {
      // Update flow state
      actions.selectChest(chestId, epoch);

      if (MOCK_CHEST_OPENING) {
        // Mock mode: generate fake content with random item count (1-3)
        actions.startPending();
        setTimeout(() => {
          const randomCount = Math.floor(Math.random() * 3) + 1;
          setMockContent(getMockRevealAssets(randomCount));
        }, 1500);
      } else {
        // Real mode: call blockchain
        openChest({
          tokenId: BigInt(chestId),
          onSuccess: () => {
            actions.startPending();
            resetChestContent();
          },
          onError: (error) => {
            actions.setError(error);
          },
        });
      }
    },
    [actions, openChest, resetChestContent],
  );

  // Handle video end
  const handleVideoEnd = useCallback(() => {
    actions.startReveal();
    // Small delay before showing content for animation
    setTimeout(() => setShowRevealContent(true), 100);
  }, [actions]);

  // Handle skip
  const handleSkip = useCallback(() => {
    actions.startReveal();
    setShowRevealContent(true);
  }, [actions]);

  // Handle reveal complete
  const handleRevealComplete = useCallback(() => {
    actions.complete();
  }, [actions]);

  // Handle open another
  const handleOpenAnother = useCallback(() => {
    setShowRevealContent(false);
    setMockContent([]);
    resetChestContent();
    actions.reset();
  }, [actions, resetChestContent]);

  // Handle close
  const handleClose = useCallback(() => {
    setShowRevealContent(false);
    setMockContent([]);
    resetChestContent();
    actions.cancel();
    setShowLootChestOpening(false);
    onClose();
  }, [actions, resetChestContent, setShowLootChestOpening, onClose]);

  // Start in selecting state
  useEffect(() => {
    if (flowState.state === "idle") {
      actions.openSelection();
    }
  }, [flowState.state, actions]);

  return (
    <>
      {/* Selection Modal */}
      {flowState.state === "selecting" && (
        <ChestSelectionModal
          isOpen={true}
          chests={ownedChests}
          onSelect={handleSelectChest}
          onClose={handleClose}
          isLoading={isOpenChestLoading}
          selectedChestId={flowState.selectedChestId}
        />
      )}

      {/* Pending State - Waiting for blockchain confirmation */}
      {flowState.state === "pending" && (
        <PendingOverlay active={true} title="Opening chest" subtitle="Waiting for confirmation" />
      )}

      {/* Opening Stage (Video) - Video based on highest item rarity and chest epoch */}
      {flowState.state === "opening" && (
        <OpeningStage
          key={flowState.selectedChestId}
          active={true}
          videoSrc={getChestOpeningVideo(getHighestRarity(displayContent), flowState.selectedChestEpoch)}
          onComplete={handleVideoEnd}
          onSkip={handleSkip}
        />
      )}

      {/* Reveal Stage - Keep single instance for both reveal and done states */}
      {(flowState.state === "reveal" || flowState.state === "done") && displayContent.length > 0 && (
        <RevealStage
          assets={displayContent}
          chestRarity={getHighestRarity(displayContent)}
          onComplete={handleRevealComplete}
          showContent={showRevealContent}
          onClose={handleClose}
          onOpenAnother={handleOpenAnother}
          remainingChestsCount={remainingChests.length}
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
                <Button variant="cta" onClick={() => actions.openSelection()}>
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

// Legacy export for backwards compatibility
export { ChestOpeningExperience as ChestOpeningModal };
