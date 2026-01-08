import { Button } from "@/components/ui/button";
import { useChestContent } from "@/hooks/use-chest-content";
import { useIsMobile } from "@/hooks/use-mobile";
import { useOpenChest } from "@/hooks/use-open-chest";
import { useLootChestOpeningStore } from "@/stores/loot-chest-opening";
import { MergedNftData } from "@/types";
import { AssetRarity, ChestAsset, getHighestRarity } from "@/utils/cosmetics";
import { Package, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { env } from "../../../../env";
import { ChestSelectionModal } from "./chest-selection-modal";
import { ChestStageContainer, ChestStageContent } from "./chest-stage-container";
import { MOCK_CHEST_OPENING, getMockRevealAssets } from "./mock-data";
import { OpeningStage, getChestOpeningVideo } from "./opening-stage";
import { PendingOverlay } from "./pending-overlay";
import { RevealStage } from "./reveal-stage";
import { useChestOpeningFlow } from "./use-chest-opening-flow";

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
  const isMobile = useIsMobile();

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
    async (chestId: string, rarity: AssetRarity) => {
      // Update flow state
      actions.selectChest(chestId, rarity);

      if (MOCK_CHEST_OPENING) {
        // Mock mode: generate fake content
        actions.startPending();
        setTimeout(() => {
          setMockContent(getMockRevealAssets(3));
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
        <PendingOverlay
          active={true}
          title="Opening chest"
          subtitle="Waiting for confirmation"
        />
      )}

      {/* Opening Stage (Video) - Video rarity based on highest item rarity */}
      {flowState.state === "opening" && (
        <OpeningStage
          active={true}
          videoSrc={getChestOpeningVideo(getHighestRarity(displayContent), isMobile)}
          onComplete={handleVideoEnd}
          onSkip={handleSkip}
        />
      )}

      {/* Reveal Stage - Keep single instance for both reveal and done states */}
      {(flowState.state === "reveal" || flowState.state === "done") && displayContent.length > 0 && (
        <RevealStage assets={displayContent} onComplete={handleRevealComplete} showContent={showRevealContent} />
      )}

      {/* Done State - Action buttons overlay (on top of RevealStage) */}
      {flowState.state === "done" && (
        <div
          className="fixed bottom-8 left-1/2 -translate-x-1/2 flex gap-4 z-[60]"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <Button
            variant="outline"
            size="lg"
            onClick={handleClose}
            className="text-gold border-gold/50 hover:bg-gold/10 gap-2"
          >
            <X className="w-4 h-4" />
            Close
          </Button>

          {remainingChests.length > 0 && (
            <Button variant="cta" size="lg" onClick={handleOpenAnother} className="gap-2">
              {/* <RotateCcw className="w-1" /> */}
              Choose Next Chest ({remainingChests.length} available)
            </Button>
          )}
        </div>
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
