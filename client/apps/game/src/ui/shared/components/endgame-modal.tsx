import { resetBootstrap } from "@/init/bootstrap";
import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { getActiveWorld } from "@/runtime/world";
import { GameReviewModal } from "@/ui/features/landing/components/game-review-modal";
import { isGameReviewDismissed, setGameReviewDismissed } from "@/ui/features/landing/lib/game-review-storage";
import { SignInPromptModal } from "@/ui/layouts/sign-in-prompt-modal";
import type { Chain } from "@contracts";
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

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

  const activeWorldProfile = getActiveWorld();
  const activeWorldName = activeWorldProfile?.name ?? null;
  const activeWorldChain = activeWorldProfile?.chain ?? null;
  const activeWorldAddress = activeWorldProfile?.worldAddress ?? null;

  const hasGameEnded = useMemo(() => {
    if (typeof gameEndAt !== "number") {
      return false;
    }

    return currentBlockTimestamp >= gameEndAt;
  }, [currentBlockTimestamp, gameEndAt]);

  const activeReviewKey = useMemo(() => {
    if (!activeWorldChain || !activeWorldAddress || typeof gameEndAt !== "number") {
      return null;
    }

    return `${activeWorldChain}:${activeWorldAddress}:${gameEndAt}`;
  }, [activeWorldAddress, activeWorldChain, gameEndAt]);

  const shouldShowReview = useMemo(() => {
    if (!hasGameEnded || !activeWorldChain || !activeWorldAddress || !activeReviewKey) {
      return false;
    }

    if (closedReviewKeys[activeReviewKey]) {
      return false;
    }

    return !isGameReviewDismissed(activeWorldChain, activeWorldAddress);
  }, [activeReviewKey, activeWorldAddress, activeWorldChain, closedReviewKeys, hasGameEnded]);

  const dismissReview = useCallback(() => {
    if (!activeWorldChain || !activeWorldAddress) {
      return;
    }

    if (activeReviewKey) {
      setClosedReviewKeys((prev) => ({ ...prev, [activeReviewKey]: true }));
    }

    setGameReviewDismissed(activeWorldChain, activeWorldAddress);
  }, [activeReviewKey, activeWorldAddress, activeWorldChain]);

  const handleClose = useCallback(() => {
    dismissReview();
  }, [dismissReview]);

  const handleReturnHome = useCallback(() => {
    dismissReview();
    resetBootstrap();
    navigate("/");
  }, [dismissReview, navigate]);

  const handleRequireSignIn = useCallback(() => {
    setModal(<SignInPromptModal />, true);
  }, [setModal]);

  if (!shouldShowReview || !activeWorldChain || !activeWorldName || !activeWorldAddress) {
    return null;
  }

  const reviewWorld: ReviewWorld = { name: activeWorldName, chain: activeWorldChain, worldAddress: activeWorldAddress };

  return (
    <GameReviewModal
      isOpen={shouldShowReview}
      world={reviewWorld}
      nextGame={null}
      onClose={handleClose}
      onReturnHome={handleReturnHome}
      onRegistrationComplete={() => undefined}
      onRequireSignIn={handleRequireSignIn}
    />
  );
};
