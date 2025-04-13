import { useUIStore } from "@/hooks/store/use-ui-store";
import { LoadingStateKey } from "@/hooks/store/use-world-loading";

export const WorldLoading = () => {
  const loadingStates = useUIStore((state) => state.loadingStates);

  const anyLoading = Object.values(loadingStates).some((isLoading) => isLoading);

  const getLoadingItems = () => {
    const items = [];
    if (loadingStates[LoadingStateKey.Realm]) items.push("Summoning Realm"); // Realm
    if (loadingStates[LoadingStateKey.SpectatorRealm]) items.push("Summoning Spectator Realm"); // Spectator Realm
    if (loadingStates[LoadingStateKey.Market]) items.push("Gathering Merchants"); // Market
    if (loadingStates[LoadingStateKey.AllPlayerStructures]) items.push("Constructing Settlements"); // Player Structures
    if (loadingStates[LoadingStateKey.Map]) items.push("Charting Territories"); // Map
    if (loadingStates[LoadingStateKey.Bank]) items.push("Counting Gold"); // Bank
    if (loadingStates[LoadingStateKey.World]) items.push("Forging Eternum"); // World
    if (loadingStates[LoadingStateKey.Hyperstructure]) items.push("Awakening Ancient Powers"); // Hyperstructure
    if (loadingStates[LoadingStateKey.SingleKey]) items.push("Unlocking Secrets"); // Single Key
    if (loadingStates[LoadingStateKey.Config]) items.push("Consulting Scrolls"); // Config
    if (loadingStates[LoadingStateKey.Events]) items.push("Weaving Tales"); // Events
    if (loadingStates[LoadingStateKey.MarketHistory]) items.push("Counting Gold"); // Market History
    if (loadingStates[LoadingStateKey.Leaderboard]) items.push("Ranking Players"); // Leaderboard
    return items.join(", ");
  };

  return (
    <div
      className={`
        z-1000
        fixed left-1/2 transform -translate-x-1/2
         rounded-lg
        transition-all duration-200 ease-in-out
        origin-bottom scale-75 md:scale-100
        ${anyLoading ? "bottom-0 opacity-100" : "translate-y-full opacity-0"}
      `}
      id="world-loading"
    >
      {anyLoading && (
        <div className="flex flex-row items-center justify-center h-full p-2 bg-dark-wood panel-wood panel-wood-corners min-w-64">
          <img src="/images/logos/eternum-loader.png" className="w-10" />
          <div className="ml-4 text-xs">{getLoadingItems()}</div>
        </div>
      )}
    </div>
  );
};
