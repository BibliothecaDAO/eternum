import { useSyncHyperstructure } from "@/hooks/helpers/use-sync";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { sqlApi } from "@/services/api";
import { NavigationButton } from "@/ui/design-system/atoms/navigation-button";
import { RefreshButton } from "@/ui/design-system/atoms/refresh-button";
import { LoadingAnimation } from "@/ui/design-system/molecules/loading-animation";
import { CompactDefenseDisplay } from "@/ui/features/military/components/compact-defense-display";
import { useChatStore } from "@/ui/features/social";
import { displayAddress } from "@/ui/utils/utils";
import {
  getAddressName,
  getGuardsByStructure,
  getGuildFromPlayerAddress,
  getStructureName,
  MAP_DATA_REFRESH_INTERVAL,
  MapDataStore,
  Position,
} from "@bibliothecadao/eternum";
import { useDojo, useHyperstructures, useQuery } from "@bibliothecadao/react";
import { ContractAddress, MERCENARIES } from "@bibliothecadao/types";
import { Loader, MapPin, MessageCircle, Shield } from "lucide-react";
import { useMemo, useState } from "react";
import { HyperstructureCard } from "./hyperstructure-card";
import { HyperstructureList } from "./hyperstructure-list";
import { HyperstructureVPDisplay } from "./hyperstructure-vp-display";

export const BlitzHyperstructuresMenu = () => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const { isSyncing } = useSyncHyperstructure();

  const { hexPosition } = useQuery();
  const [activeTab, setActiveTab] = useState<"all" | "bandits">("all");
  const [, setRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const userAddress = ContractAddress(account.address);
  const userPosition = hexPosition ? new Position({ x: hexPosition.col, y: hexPosition.row }) : null;

  const hyperstructures = useHyperstructures();
  const setNavigationTarget = useUIStore((state) => state.setNavigationTarget);
  const openChat = useChatStore((state) => state.actions.openChat);
  const addTab = useChatStore((state) => state.actions.addTab);
  const getUserIdByUsername = useChatStore((state) => state.actions.getUserIdByUsername);

  const processedHyperstructures = useMemo(() => {
    return hyperstructures.map((hyperstructure) => {
      const { structure, owner } = hyperstructure;
      const isMine = owner === userAddress;
      const guild = getGuildFromPlayerAddress(ContractAddress(owner), components);
      const userGuild = getGuildFromPlayerAddress(userAddress, components);
      const isAlly = isMine || (guild && userGuild && guild.entityId === userGuild.entityId) || false;
      const addressName = owner ? getAddressName(owner, components) : MERCENARIES;
      const isBanditOwned = !owner || owner === 0n || addressName === MERCENARIES;

      // Get guards/defense info
      const guards = getGuardsByStructure(structure).filter((guard) => guard.troops.count > 0n);

      // Calculate distance from user position
      const hyperstructurePosition = new Position({ x: structure.base.coord_x, y: structure.base.coord_y });
      const distance = userPosition
        ? (() => {
            const userNormalized = userPosition.getNormalized();
            const hyperstructureNormalized = hyperstructurePosition.getNormalized();
            return Math.sqrt(
              Math.pow(userNormalized.x - hyperstructureNormalized.x, 2) +
                Math.pow(userNormalized.y - hyperstructureNormalized.y, 2),
            );
          })()
        : 0;

      const structureName = getStructureName(structure, false).name;

      // Get hyperstructure realm count
      const hyperstructureRealmCount = MapDataStore.getInstance(
        MAP_DATA_REFRESH_INTERVAL,
        sqlApi,
      ).getHyperstructureRealmCount(structure.entity_id);

      return {
        ...hyperstructure,
        addressName,
        isMine,
        isAlly,
        isBanditOwned,
        guards,
        distance,
        structureName,
        playerGuild: guild,
        hyperstructurePosition,
        hyperstructureRealmCount,
      };
    });
  }, [hyperstructures, userAddress, userPosition, components]);

  const filteredHyperstructures = useMemo(() => {
    const filtered =
      activeTab === "bandits" ? processedHyperstructures.filter((h) => h.isBanditOwned) : processedHyperstructures;

    // Sort by distance (closest first)
    return filtered.sort((a, b) => a.distance - b.distance);
  }, [processedHyperstructures, activeTab]);

  const handleRefresh = async () => {
    setIsLoading(true);
    setRefreshKey((prev) => prev + 1);
    // Simulate loading time
    setTimeout(() => setIsLoading(false), 1000);
  };

  const handleNavigateToHyperstructure = (hyperstructure: any) => {
    const coords = new Position({
      x: hyperstructure.structure.base.coord_x,
      y: hyperstructure.structure.base.coord_y,
    }).getNormalized();
    setNavigationTarget({
      col: coords.x,
      row: coords.y,
    });
  };

  const handleChatClick = (hyperstructure: any) => {
    if (hyperstructure.isMine) {
      openChat();
    } else if (hyperstructure.addressName && hyperstructure.addressName !== MERCENARIES) {
      const userId = getUserIdByUsername(hyperstructure.addressName);
      if (userId) {
        addTab({
          type: "direct",
          name: hyperstructure.addressName,
          recipientId: userId,
        });
      }
    }
  };

  const banditOwnedCount = processedHyperstructures.filter((h) => h.isBanditOwned).length;

  const listHeader = (
    <div className="flex items-center gap-2 mb-4">
      <MapPin className="w-5 h-5 text-gold" />
      <h3 className="text-lg font-bold text-gold">Hyperstructures</h3>
      <span className="text-sm text-gold/60">({filteredHyperstructures.length} found)</span>
    </div>
  );

  const listDescription = (
    <div className="text-xs text-gold/50 mb-4">Sorted by distance: closest to furthest</div>
  );

  const emptyState = (
    <div className="text-center py-8 text-gold/60">
      <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
      <div>No hyperstructures found</div>
      <div className="text-sm mt-1">Check back later or explore more of the world!</div>
    </div>
  );

  const renderHyperstructureCard = (hyperstructure: (typeof processedHyperstructures)[number]) => {
    const {
      structureName,
      addressName,
      isAlly,
      isBanditOwned,
      guards,
      distance,
      hyperstructurePosition,
      playerGuild,
      owner,
      hyperstructureRealmCount,
    } = hyperstructure;

    const displayName = addressName || displayAddress("0x0" + owner.toString(16) || "0x0");
    const relationTone = isBanditOwned ? "bandits" : isAlly ? "ally" : "enemy";
    const relationLabel = isBanditOwned ? "Bandits" : isAlly ? "Ally" : "Enemy";

    return (
      <HyperstructureCard
        key={hyperstructure.entity_id}
        title={structureName}
        relationBadge={{ label: relationLabel, tone: relationTone }}
        ownerName={displayName}
        ownerTitle={`Owner: ${displayName}`}
        guildName={playerGuild?.name}
        actions={
          <>
            <NavigationButton
              size="sm"
              showText={true}
              onClick={() => handleNavigateToHyperstructure(hyperstructure)}
              title="Navigate to hyperstructure"
            />
            {!isBanditOwned && (
              <button
                onClick={() => handleChatClick(hyperstructure)}
                className="p-2 rounded bg-gold/20 hover:bg-gold/30 transition-colors flex items-center justify-center"
                title="Chat with owner"
              >
                <MessageCircle className="w-4 h-4 text-gold" />
              </button>
            )}
          </>
        }
      >
        {hyperstructureRealmCount !== undefined && (
          <HyperstructureVPDisplay
            realmCount={hyperstructureRealmCount}
            isOwned={owner !== undefined && owner !== null && owner !== 0n}
            className="mb-2"
          />
        )}

        <div className="flex items-center justify-between mb-3 text-sm bg-brown/20 rounded p-2">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-gold/70">Position:</span>
              <span className="text-gold ml-1">
                ({hyperstructurePosition.getNormalized().x}, {hyperstructurePosition.getNormalized().y})
              </span>
            </div>
            <div>
              <span className="text-gold/70">Distance:</span>
              <span className="text-gold ml-1">{distance.toFixed(1)} tiles</span>
            </div>
          </div>
        </div>

        {guards.length > 0 && (
          <div className="border-t border-gold/20 pt-3">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-gold/70" />
              <span className="text-sm text-gold/70 font-medium">Defense ({guards.length} armies)</span>
            </div>
            <CompactDefenseDisplay
              troops={guards.map((guard: any) => ({
                slot: guard.slot,
                troops: guard.troops,
              }))}
            />
          </div>
        )}
      </HyperstructureCard>
    );
  };

  return (
    <div className="p-4 space-y-4">
      {isSyncing ? (
        <LoadingAnimation />
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gold">Hyperstructures</h1>
            <RefreshButton onClick={handleRefresh} isLoading={isLoading} />
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-gold/20">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-4 py-2 font-semibold transition-colors ${
                activeTab === "all" ? "text-gold border-b-2 border-gold" : "text-gold/60 hover:text-gold/80"
              }`}
            >
              All Hyperstructures ({processedHyperstructures.length})
            </button>
            <button
              onClick={() => setActiveTab("bandits")}
              className={`px-4 py-2 font-semibold transition-colors ${
                activeTab === "bandits" ? "text-gold border-b-2 border-gold" : "text-gold/60 hover:text-gold/80"
              }`}
            >
              Bandit-Owned ({banditOwnedCount})
            </button>
          </div>

          {/* Content */}
          <div className="min-h-[400px]">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <Loader className="w-8 h-8 animate-spin mx-auto mb-2 text-gold" />
                  <div className="text-gold/70">Loading hyperstructures...</div>
                </div>
              </div>
            ) : (
              <HyperstructureList
                items={filteredHyperstructures}
                header={listHeader}
                description={listDescription}
                emptyState={emptyState}
                renderItem={(hyperstructure) => renderHyperstructureCard(hyperstructure)}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
};
