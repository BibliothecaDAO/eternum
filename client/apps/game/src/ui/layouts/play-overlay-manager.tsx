import { Suspense, lazy, useCallback, useEffect } from "react";
import type { PointerEvent } from "react";

import { useUIStore } from "@/hooks/store/use-ui-store";
import { LoadingOroborus } from "@/ui/modules/loading-oroborus";

const BlankOverlayContainer = lazy(() =>
  import("@/ui/shared/containers/blank-overlay-container").then((module) => ({
    default: module.BlankOverlayContainer,
  })),
);

const Onboarding = lazy(() =>
  import("@/ui/layouts/onboarding/index").then((module) => ({ default: module.Onboarding })),
);

interface PlayOverlayManagerProps {
  backgroundImage: string;
  // When false, suppresses the Onboarding overlay (which requires Dojo context)
  enableOnboarding?: boolean;
}

export const PlayOverlayManager = ({ backgroundImage, enableOnboarding = true }: PlayOverlayManagerProps) => {
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
      <Suspense fallback={null}>
        <BlankOverlayContainer zIndex={120} open={showModal} onPointerDown={handleModalOverlayPointerDown}>
          {modalContent}
        </BlankOverlayContainer>
      </Suspense>

      {enableOnboarding ? (
        <Suspense fallback={null}>
          <BlankOverlayContainer zIndex={110} open={showBlankOverlay}>
            <Onboarding backgroundImage={backgroundImage} />
          </BlankOverlayContainer>
        </Suspense>
      ) : null}

      <LoadingOroborus loading={isLoadingScreenEnabled} />
    </>
  );
};
