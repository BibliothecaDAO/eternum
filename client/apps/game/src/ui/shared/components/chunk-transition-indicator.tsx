import { useUIStore } from "@/hooks/store/use-ui-store";
import { LoadingStateKey } from "@/hooks/store/use-world-loading";

export const ChunkTransitionIndicator = () => {
  const isChunkTransitioning = useUIStore((state) => state.loadingStates[LoadingStateKey.ChunkTransition]);
  const isMapLoading = useUIStore((state) => state.loadingStates[LoadingStateKey.Map]);

  // Don't show during initial map load — WorldLoading handles that
  const visible = isChunkTransitioning && !isMapLoading;

  return (
    <div
      className={`
        fixed inset-0 z-50 pointer-events-none
        transition-opacity duration-150 ease-in-out
        ${visible ? "opacity-100" : "opacity-0"}
      `}
    >
      <div className="absolute inset-0 bg-black/5" />
      <div className="absolute top-4 right-4">
        <div className="w-5 h-5 border-2 border-gold/40 border-t-gold/80 rounded-full animate-spin" />
      </div>
    </div>
  );
};
