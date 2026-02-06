import type { PointerEvent } from "react";
import { useCallback, useEffect } from "react";

import { useUIStore } from "@/hooks/store/use-ui-store";
import { LoadingOroborus } from "@/ui/modules/loading-oroborus";
import { BlankOverlayContainer } from "@/ui/shared/containers/blank-overlay-container";
import { GameLoadingOverlay } from "@/ui/layouts/game-loading-overlay";

interface PlayOverlayManagerProps {
  backgroundImage: string;
  // When false, suppresses the loading overlay (which requires Dojo context)
  enableOnboarding?: boolean;
}

export const PlayOverlayManager = ({
  enableOnboarding = true,
  // backgroundImage is kept in the interface for caller compatibility but no longer used
}: PlayOverlayManagerProps) => {
  const showModal = useUIStore((state) => state.showModal);
  const modalContent = useUIStore((state) => state.modalContent);
  const toggleModal = useUIStore((state) => state.toggleModal);
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);
  const isLoadingScreenEnabled = useUIStore((state) => state.isLoadingScreenEnabled);

  const handleModalOverlayPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        toggleModal(null);
      }
    },
    [toggleModal],
  );

  useEffect(() => {
    if (!showModal) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        event.preventDefault();
        toggleModal(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showModal, toggleModal]);

  return (
    <>
      <BlankOverlayContainer zIndex={120} open={showModal} onPointerDown={handleModalOverlayPointerDown}>
        {modalContent}
      </BlankOverlayContainer>

      {(() => {
        console.log(
          "[PlayOverlayManager] render - enableOnboarding:",
          enableOnboarding,
          "showBlankOverlay:",
          showBlankOverlay,
          "isLoadingScreenEnabled:",
          isLoadingScreenEnabled,
        );
        return enableOnboarding && showBlankOverlay ? <GameLoadingOverlay /> : null;
      })()}

      <LoadingOroborus loading={isLoadingScreenEnabled} />
    </>
  );
};
