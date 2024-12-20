import useUIStore from "@/hooks/store/useUIStore";
import { LoadingStateKey } from "@/hooks/store/useWorldLoading";

export const WorldLoading = () => {
  const loadingStates = useUIStore((state) => state.loadingStates);

  const anyLoading = Object.values(loadingStates).some((isLoading) => isLoading);

  const getLoadingItems = () => {
    const items = [];
    if (loadingStates[LoadingStateKey.SelectedStructure]) items.push("Selected Structure");
    if (loadingStates[LoadingStateKey.Market]) items.push("Market");
    if (loadingStates[LoadingStateKey.PlayerStructuresOneKey] || loadingStates[LoadingStateKey.PlayerStructuresTwoKey])
      items.push("Player Structures");
    if (loadingStates[LoadingStateKey.Arrivals]) items.push("Arrivals");
    if (loadingStates[LoadingStateKey.Map]) items.push("Map");
    if (loadingStates[LoadingStateKey.Bank]) items.push("Bank");
    if (loadingStates[LoadingStateKey.World]) items.push("World");
    if (loadingStates[LoadingStateKey.Hyperstructure]) items.push("Hyperstructure");
    if (loadingStates[LoadingStateKey.SingleKey]) items.push("Single Key");
    if (loadingStates[LoadingStateKey.Config]) items.push("Config");
    if (loadingStates[LoadingStateKey.Events]) items.push("Events");
    return items.join(", ");
  };

  return (
    <div
      className={`
        z-1000
        fixed left-1/2 transform -translate-x-1/2
        bg-black/80 p-2 rounded-lg
        transition-all duration-200 ease-in-out
        origin-bottom scale-75 md:scale-100
        ${anyLoading ? "bottom-0 opacity-100" : "translate-y-full opacity-0"}
      `}
      id="world-loading"
    >
      {anyLoading && (
        <div className="flex flex-row items-center justify-center h-full p-2">
          <img src="/images/eternumloader.png" className="w-10" />
          <div className="ml-4">Loading: {getLoadingItems()}</div>
        </div>
      )}
    </div>
  );
};
