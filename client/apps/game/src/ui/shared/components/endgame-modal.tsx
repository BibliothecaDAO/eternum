import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { resetBootstrap } from "@/init/bootstrap";
import { getActiveWorld } from "@/runtime/world";
import { GameIsOverModal } from "@/ui/features/landing/components/game-is-over-modal";
import { GameReviewModal } from "@/ui/features/landing/components/game-review-modal";
import { isGameReviewDismissed, setGameReviewDismissed } from "@/ui/features/landing/lib/game-review-storage";
import { SignInPromptModal } from "@/ui/layouts/sign-in-prompt-modal";
import type { Chain } from "@contracts";
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

// Set to true to preview the in-game end-game flow without waiting for the timer.
const DEBUG_FORCE_SHOW_ENDGAME_WINDOW = true;

interface ReviewWorld {
  name: string;
  chain: Chain;
  worldAddress?: string;
}

export const EndgameModal = () => {
  const navigate = useNavigate();
  const setModal = useUIStore((state) => state.setModal);
  const gameEndAt = useUIStore((state) => state.gameEndAt);
  const { currentBlockTimestamp } = useBlockTimestamp();

  const [closedReviewKeys, setClosedReviewKeys] = useState<Record<string, true>>({});
  const [reviewOpenKey, setReviewOpenKey] = useState<string | null>(null);

  const activeWorldProfile = getActiveWorld();
  const activeWorldName = activeWorldProfile?.name ?? null;
  const activeWorldChain = activeWorldProfile?.chain ?? null;
  const activeWorldAddress = activeWorldProfile?.worldAddress ?? null;

  const hasGameEnded = useMemo(() => {
    if (DEBUG_FORCE_SHOW_ENDGAME_WINDOW) {
      return true;
    }

    return typeof gameEndAt === "number" && currentBlockTimestamp >= gameEndAt;
  }, [currentBlockTimestamp, gameEndAt]);

  const activeReviewKey = useMemo(() => {
    if (!activeWorldChain || !activeWorldAddress) {
      return null;
    }

    if (typeof gameEndAt !== "number") {
      if (DEBUG_FORCE_SHOW_ENDGAME_WINDOW) {
        return `${activeWorldChain}:${activeWorldAddress}:debug`;
      }
      return null;
    }

    return `${activeWorldChain}:${activeWorldAddress}:${gameEndAt}`;
  }, [activeWorldAddress, activeWorldChain, gameEndAt]);

  const shouldShowEndgameFlow = useMemo(() => {
    if (!hasGameEnded || !activeWorldChain || !activeWorldAddress || !activeReviewKey) {
      return false;
    }

    if (closedReviewKeys[activeReviewKey]) {
      return false;
    }

    if (DEBUG_FORCE_SHOW_ENDGAME_WINDOW) {
      return true;
    }

    return !isGameReviewDismissed(activeWorldChain, activeWorldAddress);
  }, [activeReviewKey, activeWorldAddress, activeWorldChain, closedReviewKeys, hasGameEnded]);

  const isReviewOpen = Boolean(activeReviewKey && reviewOpenKey === activeReviewKey);

  const dismissReview = useCallback(() => {
    if (!activeWorldChain || !activeWorldAddress) {
      return;
    }

    if (activeReviewKey) {
      setClosedReviewKeys((prev) => ({ ...prev, [activeReviewKey]: true }));
    }

    setReviewOpenKey((currentKey) => (currentKey === activeReviewKey ? null : currentKey));

    if (!DEBUG_FORCE_SHOW_ENDGAME_WINDOW) {
      setGameReviewDismissed(activeWorldChain, activeWorldAddress);
    }
  }, [activeReviewKey, activeWorldAddress, activeWorldChain]);

  const handleCloseReview = useCallback(() => {
    dismissReview();
  }, [dismissReview]);

  const handleReturnHomeFromReview = useCallback(() => {
    dismissReview();
    resetBootstrap();
    navigate("/");
  }, [dismissReview, navigate]);

  const handleOpenReview = useCallback(() => {
    if (!activeReviewKey) {
      return;
    }

    setReviewOpenKey(activeReviewKey);
  }, [activeReviewKey]);

  const handleGoHomeFromPrompt = useCallback(() => {
    dismissReview();
    resetBootstrap();
    navigate("/");
  }, [dismissReview, navigate]);

  const handleRequireSignIn = useCallback(() => {
    setModal(<SignInPromptModal />, true);
  }, [setModal]);

  if (!shouldShowEndgameFlow || !activeWorldChain || !activeWorldName || !activeWorldAddress) {
    return null;
  }

  const reviewWorld: ReviewWorld = { name: activeWorldName, chain: activeWorldChain, worldAddress: activeWorldAddress };

  return (
    <>
      <GameIsOverModal
        isOpen={!isReviewOpen}
        worldName={activeWorldName}
        title="Game Is Finished"
        description={`${activeWorldName} has ended. You can watch the full game review or go back home.`}
        reviewLabel="Watch review"
        closeLabel="Go back home"
        onReview={handleOpenReview}
        onClose={handleGoHomeFromPrompt}
      />

      <GameReviewModal
        isOpen={isReviewOpen}
        world={reviewWorld}
        nextGame={null}
        showUpcomingGamesStep={true}
        onClose={handleCloseReview}
        onReturnHome={handleReturnHomeFromReview}
        onRegistrationComplete={() => undefined}
        onRequireSignIn={handleRequireSignIn}
      />
    </>
  );
};
