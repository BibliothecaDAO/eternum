import { useUIStore } from "@/hooks/store/use-ui-store";
import { LoadingStateKey } from "@/hooks/store/use-world-loading";

export const ChunkTransitionIndicator = () => {
  const isChunkTransitioning = useUIStore((state) => state.loadingStates[LoadingStateKey.ChunkTransition]);
  const isMapLoading = useUIStore((state) => state.loadingStates[LoadingStateKey.Map]);

  const visible = isChunkTransitioning && !isMapLoading;

  return (
    <div
      className="fixed inset-0 z-50 pointer-events-none transition-all duration-300 ease-in-out"
      style={{
        backdropFilter: visible ? "brightness(0.92) saturate(0.85)" : "brightness(1) saturate(1)",
        WebkitBackdropFilter: visible ? "brightness(0.92) saturate(0.85)" : "brightness(1) saturate(1)",
      }}
    />
  );
};
