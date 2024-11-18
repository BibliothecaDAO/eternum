import useUIStore from "@/hooks/store/useUIStore";

export const BottomLeftNavigation = () => {
  const eventsLoadingState = useUIStore((state) => state.eventsLoadingState);

  return eventsLoadingState ? (
    <div className="flex flex-row mb-4 ml-4 items-center bg-hex bg-black/50 rounded-lg p-2">
      <img src="/images/eternum-logo_animated.png" className="invert w-10 h-10" />
      <div className="text-xs text-white/90 ml-2 animate-pulse">Game state is loading...</div>
    </div>
  ) : null;
};
