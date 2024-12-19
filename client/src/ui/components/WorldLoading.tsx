import useUIStore from "@/hooks/store/useUIStore";

export const WorldLoading = () => {
  const isSelectedStructureLoading = useUIStore((state) => state.isSelectedStructureLoading);
  const isMarketLoading = useUIStore((state) => state.isMarketLoading);
  const isPlayerStructuresLoading = useUIStore((state) => state.isPlayerStructuresLoading);
  const isArrivalsLoading = useUIStore((state) => state.isArrivalsLoading);
  const isMapLoading = useUIStore((state) => state.isMapLoading);
  const isBankLoading = useUIStore((state) => state.isBankLoading);
  const isWorldLoading = useUIStore((state) => state.isWorldLoading);
  const isHyperstructureLoading = useUIStore((state) => state.isHyperstructureLoading);
  const isSingleKeyLoading = useUIStore((state) => state.isSingleKeyLoading);
  const isConfigLoading = useUIStore((state) => state.isConfigLoading);

  const anyLoading =
    isSelectedStructureLoading ||
    isMarketLoading ||
    isPlayerStructuresLoading ||
    isArrivalsLoading ||
    isMapLoading ||
    isBankLoading ||
    isWorldLoading ||
    isHyperstructureLoading ||
    isSingleKeyLoading ||
    isConfigLoading;

  console.log({ isArrivalsLoading });

  const getLoadingItems = () => {
    const items = [];
    if (isSelectedStructureLoading) items.push("Structure");
    if (isMarketLoading) items.push("Market");
    if (isPlayerStructuresLoading) items.push("Player Structures");
    if (isArrivalsLoading) items.push("Arrivals");
    if (isMapLoading) items.push("Map");
    if (isBankLoading) items.push("Bank");
    if (isWorldLoading) items.push("World");
    if (isHyperstructureLoading) items.push("Hyperstructure");
    if (isSingleKeyLoading) items.push("Single Key");
    if (isConfigLoading) items.push("Config");
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
