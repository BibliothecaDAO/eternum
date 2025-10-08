import { Suspense, lazy, useEffect } from "react";

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
}

export const PlayOverlayManager = ({ backgroundImage }: PlayOverlayManagerProps) => {
  const showModal = useUIStore((state) => state.showModal);
  const modalContent = useUIStore((state) => state.modalContent);
  const toggleModal = useUIStore((state) => state.toggleModal);
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);
  const isLoadingScreenEnabled = useUIStore((state) => state.isLoadingScreenEnabled);

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
        <BlankOverlayContainer zIndex={120} open={showModal}>
          {modalContent}
        </BlankOverlayContainer>
      </Suspense>

      <Suspense fallback={null}>
        <BlankOverlayContainer zIndex={110} open={showBlankOverlay}>
          <Onboarding backgroundImage={backgroundImage} />
        </BlankOverlayContainer>
      </Suspense>

      <LoadingOroborus loading={isLoadingScreenEnabled} />
    </>
  );
};
