import { useUIStore } from "@/hooks/store/use-ui-store";
import { shouldShowTransitionLoadingOverlay } from "@/ui/layouts/loading-flow";
import { LoadingOroborus } from "@/ui/modules/loading-oroborus";

interface PlayOverlayManagerProps {
  backgroundImage: string;
}

/** The loading overlays only: every in-game surface is a popover now (`SurfaceHost`). */
export const PlayOverlayManager = (
  {
    // backgroundImage is kept in the interface for caller compatibility but no longer used
  }: PlayOverlayManagerProps,
) => {
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);
  const isLoadingScreenEnabled = useUIStore((state) => state.isLoadingScreenEnabled);
  const showTransitionLoadingOverlay = shouldShowTransitionLoadingOverlay(showBlankOverlay, isLoadingScreenEnabled);

  return <LoadingOroborus loading={showTransitionLoadingOverlay} />;
};
