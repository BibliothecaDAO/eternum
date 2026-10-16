import { useUIStore } from "@/hooks/store/use-ui-store";
import { LoadingStateKey } from "@/hooks/store/use-world-loading";

const WORLD_LOADING_ITEMS = [
  { key: LoadingStateKey.Market, label: "Gathering Merchants" },
  { key: LoadingStateKey.AllPlayerStructures, label: "Constructing Settlements" },
  { key: LoadingStateKey.Hyperstructure, label: "Awakening Ancient Powers" },
  { key: LoadingStateKey.MarketHistory, label: "Counting Gold" },
  { key: LoadingStateKey.Leaderboard, label: "Ranking Players" },
] as const;

export const WorldLoading = () => {
  const loadingStates = useUIStore((state) => state.loadingStates);
  const loadingItems = WORLD_LOADING_ITEMS.filter(({ key }) => loadingStates[key]).map(({ label }) => label);
  const hasLoadingItems = loadingItems.length > 0;

  return (
    <div
      className={`
        z-1000
        fixed left-1/2 transform -translate-x-1/2
         rounded-lg
        transition-all duration-200 ease-in-out
        origin-bottom scale-75 md:scale-100
        ${hasLoadingItems ? "bottom-0 opacity-100" : "translate-y-full opacity-0"}
      `}
      id="world-loading"
    >
      {hasLoadingItems && (
        <div
          aria-live="polite"
          className="flex flex-row items-center justify-center h-full p-2 rounded-xl border border-gold/30 bg-[#1a1410]/95 min-w-64"
          role="status"
        >
          <img alt="" src="/images/logos/eternum-loader.png" className="w-10" />
          <div className="ml-4 text-xs">{loadingItems.join(", ")}</div>
        </div>
      )}
    </div>
  );
};
