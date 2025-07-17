import { sqlApi } from "@/services/api";
import { Position } from "@/types/position";
import { RangeInput } from "@/ui/design-system/atoms";
import { RefreshButton } from "@/ui/design-system/atoms/refresh-button";
import { useDojo, useQuery } from "@bibliothecadao/react";
import { useQuery as useReactQuery } from "@tanstack/react-query";
import { Loader } from "lucide-react";
import { useEffect, useState } from "react";
import { ChestList } from "./chest-list";
import { RelicInventory } from "./relic-inventory";

export const RelicsModule = () => {
  const {
    account: { account },
  } = useDojo();

  const { hexPosition } = useQuery();
  const [activeTab, setActiveTab] = useState<"chests" | "inventory">("chests");
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchDistance, setSearchDistance] = useState(30);
  const [lastRefreshTime, setLastRefreshTime] = useState(0);
  const [remainingCooldown, setRemainingCooldown] = useState(0);

  const userAddress = account.address;

  const contractPosition = new Position({ x: hexPosition?.col || 0, y: hexPosition?.row || 0 }).getContract();

  // Query nearby chests
  const {
    data: chests = [],
    isLoading: isLoadingChests,
    refetch: refetchChests,
  } = useReactQuery({
    queryKey: ["nearbyChests", contractPosition.x, contractPosition.y, refreshKey],
    queryFn: async () => {
      console.log("fetching chests");
      return sqlApi.fetchChestsNearPosition(contractPosition, searchDistance);
    },
    enabled: true,
    staleTime: 30000, // 30 seconds
  });

  // Query player relics
  const {
    data: relicsData,
    isLoading: isLoadingRelics,
    refetch: refetchRelics,
  } = useReactQuery({
    queryKey: ["playerRelics", userAddress, refreshKey],
    queryFn: async () => {
      return sqlApi.fetchAllPlayerRelics(userAddress);
    },
    enabled: true,
    staleTime: 60000, // 1 minute
  });

  const handleRefresh = () => {
    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshTime;

    if (timeSinceLastRefresh < 10000) {
      // Still in cooldown
      return;
    }

    setLastRefreshTime(now);
    setRefreshKey((prev) => prev + 1);
    if (activeTab === "chests") {
      refetchChests();
    } else {
      refetchRelics();
    }
  };

  // Update cooldown timer
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastRefresh = now - lastRefreshTime;
      const remaining = Math.max(0, 10000 - timeSinceLastRefresh);
      setRemainingCooldown(Math.ceil(remaining / 1000));
    }, 100);

    return () => clearInterval(interval);
  }, [lastRefreshTime]);

  const isLoading = activeTab === "chests" ? isLoadingChests : isLoadingRelics;

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gold">Relics & Crates</h1>
        <div className="flex items-center gap-2">
          {remainingCooldown > 0 && (
            <span className="text-gold/60 text-sm">Refresh available in {remainingCooldown}s</span>
          )}
          <RefreshButton onClick={handleRefresh} isLoading={isLoading} disabled={remainingCooldown > 0} />
        </div>
      </div>

      {/* Distance Control - Only show for chests tab */}
      {activeTab === "chests" && (
        <div className="bg-dark-wood/50 p-4 rounded-lg space-y-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gold/80 text-sm">
              Adjust the search radius to find relic chests within a specific distance from your current position. You
              can only refresh every 10 seconds.
            </p>
          </div>
          <RangeInput
            title={`Search Distance (${searchDistance} tiles)`}
            fromTitle="10 tiles"
            toTitle="100 tiles"
            value={searchDistance}
            onChange={(value) => {
              setSearchDistance(value);
            }}
            min={10}
            max={100}
            step={5}
          />
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex border-b border-gold/20">
        <button
          onClick={() => setActiveTab("chests")}
          className={`px-4 py-2 font-semibold transition-colors ${
            activeTab === "chests" ? "text-gold border-b-2 border-gold" : "text-gold/60 hover:text-gold/80"
          }`}
        >
          Nearby Crates ({chests.length})
        </button>
        <button
          onClick={() => setActiveTab("inventory")}
          className={`px-4 py-2 font-semibold transition-colors ${
            activeTab === "inventory" ? "text-gold border-b-2 border-gold" : "text-gold/60 hover:text-gold/80"
          }`}
        >
          My Relics (
          {relicsData
            ? relicsData.structures.reduce((sum, s) => sum + s.relics.length, 0) +
              relicsData.armies.reduce((sum, a) => sum + a.relics.length, 0)
            : 0}
          )
        </button>
      </div>

      {/* Content */}
      <div className="min-h-[400px]">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader className="w-8 h-8 animate-spin mx-auto mb-2 text-gold" />
              <div className="text-gold/70">Loading {activeTab === "chests" ? "nearby crates" : "your relics"}...</div>
            </div>
          </div>
        ) : (
          <>
            {activeTab === "chests" && <ChestList chests={chests} />}
            {activeTab === "inventory" && relicsData && <RelicInventory relicsData={relicsData} />}
          </>
        )}
      </div>
    </div>
  );
};
