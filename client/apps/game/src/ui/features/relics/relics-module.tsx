import { sqlApi } from "@/services/api";
import { Position } from "@/types/position";
import { useDojo, useQuery } from "@bibliothecadao/react";
import { useQuery as useReactQuery } from "@tanstack/react-query";
import { Loader, RefreshCw } from "lucide-react";
import { useState } from "react";
import { ChestList } from "./chest-list";
import { RelicInventory } from "./relic-inventory";

export const RelicsModule = () => {
  const {
    account: { account },
  } = useDojo();

  const { hexPosition } = useQuery();
  const [activeTab, setActiveTab] = useState<"chests" | "inventory">("chests");
  const [refreshKey, setRefreshKey] = useState(0);

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
      return sqlApi.fetchChestsNearPosition(contractPosition, 30);
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
    setRefreshKey((prev) => prev + 1);
    if (activeTab === "chests") {
      refetchChests();
    } else {
      refetchRelics();
    }
  };

  const isLoading = activeTab === "chests" ? isLoadingChests : isLoadingRelics;

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gold">Relics & Chests</h1>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="p-2 rounded-lg bg-gold/10 hover:bg-gold/20 transition-colors disabled:opacity-50"
          title="Refresh data"
        >
          <RefreshCw className={`w-4 h-4 text-gold ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gold/20">
        <button
          onClick={() => setActiveTab("chests")}
          className={`px-4 py-2 font-semibold transition-colors ${
            activeTab === "chests" ? "text-gold border-b-2 border-gold" : "text-gold/60 hover:text-gold/80"
          }`}
        >
          Nearby Chests ({chests.length})
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
              <div className="text-gold/70">Loading {activeTab === "chests" ? "nearby chests" : "your relics"}...</div>
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
