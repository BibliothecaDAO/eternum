import { useSyncHyperstructure } from "@/hooks/helpers/use-sync";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { Position } from "@/types/position";
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
} from "@bibliothecadao/eternum";
import { useDojo, useHyperstructures, useQuery } from "@bibliothecadao/react";
import { ContractAddress, MERCENARIES } from "@bibliothecadao/types";
import { Loader, MapPin, MessageCircle, Shield } from "lucide-react";
import { useMemo, useState } from "react";

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
              <HyperstructuresList
                hyperstructures={filteredHyperstructures}
                onNavigate={handleNavigateToHyperstructure}
                onChat={handleChatClick}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
};

// HyperstructuresList Component
interface HyperstructuresListProps {
  hyperstructures: any[];
  onNavigate: (hyperstructure: any) => void;
  onChat: (hyperstructure: any) => void;
}

const HyperstructuresList = ({ hyperstructures, onNavigate, onChat }: HyperstructuresListProps) => {
  if (hyperstructures.length === 0) {
    return (
      <div className="text-center py-8 text-gold/60">
        <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <div>No hyperstructures found</div>
        <div className="text-sm mt-1">Check back later or explore more of the world!</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <MapPin className="w-5 h-5 text-gold" />
        <h3 className="text-lg font-bold text-gold">Hyperstructures</h3>
        <span className="text-sm text-gold/60">({hyperstructures.length} found)</span>
      </div>
      <div className="text-xs text-gold/50 mb-4">Sorted by distance: closest to furthest</div>

      <div className="space-y-2">
        {hyperstructures.map((hyperstructure) => (
          <HyperstructureCard
            key={hyperstructure.entity_id}
            hyperstructure={hyperstructure}
            onNavigate={onNavigate}
            onChat={onChat}
          />
        ))}
      </div>
    </div>
  );
};

// HyperstructureCard Component
interface HyperstructureCardProps {
  hyperstructure: any;
  onNavigate: (hyperstructure: any) => void;
  onChat: (hyperstructure: any) => void;
}

const HyperstructureCard = ({ hyperstructure, onNavigate, onChat }: HyperstructureCardProps) => {
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
  } = hyperstructure;

  const displayName = addressName || displayAddress("0x0" + owner.toString(16) || "0x0");

  return (
    <div className="bg-gray-800/40 rounded-lg p-4 border border-gold/20 hover:border-gold/40 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-lg font-semibold text-gold truncate" title={structureName}>
              {structureName}
            </h4>
            <div
              className={`px-2 py-1 rounded text-xs whitespace-nowrap flex-shrink-0 ${
                isBanditOwned
                  ? "bg-red/30 border-red/50 border text-red-200"
                  : isAlly
                    ? "bg-green/30 border-green/50 border text-green-200"
                    : "bg-yellow/30 border-yellow/50 border text-yellow-200"
              }`}
            >
              {isBanditOwned ? "Bandits" : isAlly ? "Ally" : "Enemy"}
            </div>
          </div>
          <div className="text-sm text-gold/80 truncate" title={`Owner: ${displayName}`}>
            Owner: {displayName}
          </div>
          {playerGuild && (
            <div className="text-xs text-gold/60 truncate" title={`< ${playerGuild.name} >`}>
              {"< "}
              {playerGuild.name}
              {" >"}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <NavigationButton
            size="sm"
            showText={true}
            onClick={() => onNavigate(hyperstructure)}
            title="Navigate to hyperstructure"
          />
          {!isBanditOwned && (
            <button
              onClick={() => onChat(hyperstructure)}
              className="p-2 rounded bg-gold/20 hover:bg-gold/30 transition-colors"
              title="Chat with owner"
            >
              <MessageCircle className="w-4 h-4 text-gold" />
            </button>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-gold/70 mb-1">Position</div>
          <div className="text-gold">
            ({hyperstructurePosition.getNormalized().x}, {hyperstructurePosition.getNormalized().y})
          </div>
        </div>
        <div>
          <div className="text-gold/70 mb-1">Distance</div>
          <div className="text-gold">{distance.toFixed(1)} tiles</div>
        </div>
      </div>

      {/* Guards */}
      {guards.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gold/20">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-gold/70" />
            <span className="text-sm text-gold/70">Defense ({guards.length} armies)</span>
          </div>
          <CompactDefenseDisplay
            troops={guards.map((guard: any) => ({
              slot: guard.slot,
              troops: guard.troops,
            }))}
          />
        </div>
      )}
    </div>
  );
};
