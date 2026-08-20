import { useUIStore } from "@/hooks/store/use-ui-store";
import { LoadingStateKey } from "@/hooks/store/use-world-loading";

export const ChunkTransitionIndicator = () => {
  const visible = useUIStore((state) => state.loadingStates[LoadingStateKey.ChunkTransition]);

  if (!visible) {
    return null;
  }

  return (
    <div aria-live="polite" className="fixed bottom-4 right-4 z-50 pointer-events-none" role="status">
      <div className="rounded-md border border-gold/20 bg-[#1a1410]/80 px-2 py-1 text-xs text-gold/80 shadow-sm">
        Updating terrain…
      </div>
    </div>
  );
};
