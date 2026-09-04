import { useUIStore } from "@/hooks/store/use-ui-store";
import { shouldShowTransitionLoadingOverlay } from "@/ui/layouts/loading-flow";
import { LoadingOroborus } from "@/ui/modules/loading-oroborus";
import { GameLoadingOverlay } from "@/ui/layouts/game-loading-overlay";

interface PlayOverlayManagerProps {
  backgroundImage: string;
  // When false, suppresses the loading overlay (which requires Dojo context)
  enableOnboarding?: boolean;
}

/** The loading overlays only: every in-game surface is a popover now (`SurfaceHost`). */
export const PlayOverlayManager = ({
  enableOnboarding = true,
  // backgroundImage is kept in the interface for caller compatibility but no longer used
}: PlayOverlayManagerProps) => {
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);
  const isLoadingScreenEnabled = useUIStore((state) => state.isLoadingScreenEnabled);
  const showTransitionLoadingOverlay = shouldShowTransitionLoadingOverlay(showBlankOverlay, isLoadingScreenEnabled);

  return (
    <>
      {enableOnboarding && showBlankOverlay ? <GameLoadingOverlay /> : null}
      <LoadingOroborus loading={showTransitionLoadingOverlay} />
    </>
  );
};
