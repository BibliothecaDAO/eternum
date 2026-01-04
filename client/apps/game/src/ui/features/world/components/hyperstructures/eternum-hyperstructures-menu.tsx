import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useSyncHyperstructure } from "@/hooks/helpers/use-sync";
import { Position } from "@bibliothecadao/eternum";

import Button from "@/ui/design-system/atoms/button";
import TextInput from "@/ui/design-system/atoms/text-input";
import { HintModalButton } from "@/ui/design-system/molecules/hint-modal-button";
import { LoadingAnimation } from "@/ui/design-system/molecules/loading-animation";
import { ViewOnMapIcon } from "@/ui/design-system/molecules/view-on-map-icon";
import { NavigateToPositionIcon } from "@/ui/features/military/components/army-chip";
import { HintSection } from "@/ui/features/progression/hints/hint-modal";
import { DisplayedAccess, HyperstructurePanel } from "@/ui/features/world";
import { currencyIntlFormat, getRealmCountPerHyperstructure } from "@/ui/utils/utils";
import {
  getEntityIdFromKeys,
  getGuildFromPlayerAddress,
  getHyperstructureProgress,
  LeaderboardManager,
} from "@bibliothecadao/eternum";
import { useDojo, useHyperstructures } from "@bibliothecadao/react";
import { ContractAddress, HyperstructureInfo, MERCENARIES } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import clsx from "clsx";
import { ArrowLeft, ArrowRight, Search, Star } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { HyperstructureCard } from "./hyperstructure-card";
import { HyperstructureList } from "./hyperstructure-list";

// Define filter options
type FilterOption = "all" | "mine" | "my-guild" | "public" | "completed" | "in-progress" | "initialized" | "favorites";

export const EternumHyperstructuresMenu = ({ className }: { className?: string }) => {
  const {
    setup: { components },
    account: { account },
  } = useDojo();
  const mode = useGameModeConfig();

  const { isSyncing } = useSyncHyperstructure();

  const [selectedEntity, setSelectedEntity] = useState<HyperstructureInfo | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<FilterOption>("all");

  // Favorites state with localStorage persistence
  const [favorites, setFavorites] = useState<number[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    try {
      const saved = window.localStorage.getItem("favoriteHyperstructures");
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.warn("Failed to read favorite hyperstructures from storage", error);
      return [];
    }
  });

  const hyperstructures = useHyperstructures();

  // Get list of hyperstructures with player contributions
  const myHyperstructureIds = useMemo(() => {
    const myStructures = LeaderboardManager.instance(
      components,
      getRealmCountPerHyperstructure(),
    ).getHyperstructuresWithSharesFromPlayer(ContractAddress(account.address));
    return Array.isArray(myStructures) ? myStructures.map((h) => Number(h.entity_id)) : [];
  }, [components, account.address]);

  // Process hyperstructures data with favorites
  const hyperstructuresList = useMemo(() => {
    return hyperstructures
      .map((hyperstructure) => ({
        ...hyperstructure,
        name: mode.structure.getName(hyperstructure.structure).name,
        isFavorite: favorites.includes(Number(hyperstructure.entity_id)),
      }))
      .sort((a, b) => Number(a.entity_id) - Number(b.entity_id));
  }, [hyperstructures, favorites, mode]);

  const myGuild = useComponentValue(components.GuildMember, getEntityIdFromKeys([ContractAddress(account.address)]));

  // Toggle favorite functionality
  const toggleFavorite = useCallback((entityId: number, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent triggering the row click
    setFavorites((prev) => {
      const newFavorites = prev.includes(entityId) ? prev.filter((id) => id !== entityId) : [...prev, entityId];
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem("favoriteHyperstructures", JSON.stringify(newFavorites));
        } catch (error) {
          console.warn("Failed to persist favorite hyperstructures", error);
        }
      }
      return newFavorites;
    });
  }, []);

  // Calculate counts for each filter category
  const filterCounts = useMemo(() => {
    const completedStructures = hyperstructuresList.filter(
      (entity) => getHyperstructureProgress(entity.entity_id, components).percentage === 100,
    );
    const initializedStructures = hyperstructuresList.filter(
      (entity) => getHyperstructureProgress(entity.entity_id, components).initialized,
    );
    const myGuildStructures = hyperstructuresList.filter((entity) => {
      const ownerGuild = getGuildFromPlayerAddress(entity.owner || 0n, components);
      return myGuild?.guild_id && ownerGuild?.entityId === myGuild.guild_id;
    });
    const publicStructures = hyperstructuresList.filter((entity) => entity.access === "Public");

    return {
      all: hyperstructuresList.length,
      mine: myHyperstructureIds.length,
      "my-guild": myGuildStructures.length,
      public: publicStructures.length,
      completed: completedStructures.length,
      "in-progress": hyperstructuresList.length - completedStructures.length,
      initialized: initializedStructures.length,
      favorites: favorites.length,
    };
  }, [hyperstructuresList, myHyperstructureIds, components, favorites, myGuild]);

  // Filter and search the hyperstructures list
  const filteredHyperstructures = useMemo(() => {
    let filtered = hyperstructuresList;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter((entity) => entity.name?.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    // Apply category filter
    switch (activeFilter) {
      case "mine":
        filtered = filtered.filter((entity) => myHyperstructureIds.includes(Number(entity.entity_id)));
        break;
      case "my-guild":
        filtered = filtered.filter((entity) => {
          const ownerGuild = getGuildFromPlayerAddress(entity.owner || 0n, components);
          return myGuild?.guild_id && ownerGuild?.entityId === myGuild.guild_id;
        });
        break;
      case "public":
        filtered = filtered.filter((entity) => entity.access === "Public");
        break;
      case "completed":
        // We'll check progress in the component so we don't need hook in filter
        filtered = filtered.filter(
          (entity) => getHyperstructureProgress(entity.entity_id, components).percentage === 100,
        );
        break;
      case "in-progress":
        // We'll check progress in the component so we don't need hook in filter
        filtered = filtered.filter(
          (entity) => getHyperstructureProgress(entity.entity_id, components).percentage !== 100,
        );
        break;
      case "initialized":
        filtered = filtered.filter((entity) => getHyperstructureProgress(entity.entity_id, components).initialized);
        break;
      case "favorites":
        filtered = filtered.filter((entity) => favorites.includes(Number(entity.entity_id)));
        break;
      default:
        // "all" - no additional filtering
        break;
    }

    return filtered;
  }, [hyperstructuresList, searchTerm, activeFilter, myHyperstructureIds, components, favorites, myGuild]);

  const visibleHyperstructures = useMemo(() => {
    return filteredHyperstructures
      .map((hyperstructure) => ({
        hyperstructure,
        progress: getHyperstructureProgress(hyperstructure.entity_id, components),
      }))
      .filter(({ progress }) => {
        if (activeFilter === "completed") {
          return progress.percentage === 100;
        }
        if (activeFilter === "in-progress") {
          return progress.percentage !== 100;
        }
        return true;
      });
  }, [filteredHyperstructures, activeFilter, components]);

  // Filter button component
  const FilterButton = ({ label, value }: { label: string; value: FilterOption }) => (
    <button
      className={clsx("px-2 py-1 text-xxs rounded-md transition-colors flex items-center gap-1 justify-center", {
        "bg-gold/20 text-gold": activeFilter === value,
        "hover:bg-gold/30": activeFilter !== value,
      })}
      onClick={() => setActiveFilter(value)}
    >
      {value === "favorites" && <Star className="w-3 h-3" />}
      <span>{label}</span>
      <span className={clsx("rounded-full px-1 py-0.5 text-[10px] font-medium bg-gold/30 text-gold", {})}>
        {filterCounts[value]}
      </span>
    </button>
  );

  return (
    <div className={clsx("relative flex flex-col h-full", className)}>
      {isSyncing ? (
        <LoadingAnimation />
      ) : (
        <>
          <HintModalButton className="absolute top-2 right-2 z-10" section={HintSection.WorldStructures} />
          {selectedEntity ? (
            <div className="flex flex-col h-full p-3">
              <Button
                className="mb-4 self-start flex items-center gap-1"
                variant="default"
                size="xs"
                onClick={() => setSelectedEntity(null)}
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Hyperstructures</span>
              </Button>
              <HyperstructurePanel
                entity={hyperstructuresList.find((entity) => entity.entity_id === selectedEntity?.entity_id)}
              />
            </div>
          ) : (
            <div className="flex flex-col h-full p-3">
              <h2 className="text-xl font-bold text-gold mb-4">World Hyperstructures</h2>

              {/* Search and filter bar */}
              <div className="mb-1 space-y-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2" />
                  <TextInput
                    placeholder="Search hyperstructures..."
                    value={searchTerm}
                    onChange={(value) => setSearchTerm(value)}
                    className="pr-3 pl-10"
                  />
                </div>

                <div className="grid grid-cols-3 gap-1">
                  <FilterButton label="All" value="all" />
                  <FilterButton label="My Shares" value="mine" />
                  <FilterButton label="My Guild" value="my-guild" />
                  <FilterButton label="Public" value="public" />
                  <FilterButton label="Completed" value="completed" />
                  <FilterButton label="In Progress" value="in-progress" />
                  <FilterButton label="Initialized" value="initialized" />
                  <FilterButton label="Favorites" value="favorites" />
                </div>
              </div>

              {/* Hyperstructures list */}
              <div className="overflow-y-auto flex-grow">
                <HyperstructureList
                  items={visibleHyperstructures}
                  emptyState={
                    <div className="flex flex-col items-center justify-center h-40">
                      <div className="text-sm mb-2">No hyperstructures found</div>
                      <div className="text-xs">Try adjusting your filters or search</div>
                    </div>
                  }
                  itemsWrapperClassName="space-y-1"
                  renderItem={(item) => {
                    const { hyperstructure, progress } = item;
                    const position = new Position({
                      x: hyperstructure.position.x || 0,
                      y: hyperstructure.position.y || 0,
                    });

                    const titlePrefix = (
                      <button
                        className="p-1 hover:scale-110 transition-transform"
                        type="button"
                        onClick={(e) => toggleFavorite(Number(hyperstructure.entity_id), e)}
                      >
                        <Star
                          className={
                            hyperstructure.isFavorite
                              ? "h-4 w-4 fill-gold text-gold"
                              : "h-4 w-4 text-gold/50 hover:text-gold"
                          }
                        />
                      </button>
                    );

                    const titleSuffix = (
                      <div className="flex items-center gap-1">
                        {hyperstructure?.access && <AccessBadge access={hyperstructure.access} />}
                        <div className="flex items-center gap-1 ml-1" onClick={(event) => event.stopPropagation()}>
                          <ViewOnMapIcon className="my-auto hover:scale-110 transition-transform" position={position} />
                          <NavigateToPositionIcon
                            className="h-6 w-6 hover:scale-110 transition-transform"
                            position={position}
                          />
                        </div>
                      </div>
                    );

                    const actions = (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedEntity(hyperstructure);
                        }}
                        className="w-6 h-6 flex items-center justify-center"
                        title="Open details"
                      >
                        <ArrowRight className="w-6 h-6 fill-current text-gold bg-gold/20 rounded-full p-1 hover:bg-gold/30 hover:text-gold/80 hover:scale-110 transition-all duration-200" />
                      </button>
                    );

                    return (
                      <HyperstructureCard
                        key={hyperstructure.entity_id}
                        title={hyperstructure.name}
                        titlePrefix={titlePrefix}
                        titleSuffix={titleSuffix}
                        actions={actions}
                        className="panel-wood hover:bg-crimson/10"
                        onClick={() => setSelectedEntity(hyperstructure)}
                      >
                        <div className="flex flex-col space-y-3">
                          <HyperstructureContentRow hyperstructure={hyperstructure} progress={progress} />
                        </div>
                      </HyperstructureCard>
                    );
                  }}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const AccessBadge = ({ access }: { access: string }) => {
  const displayAccess = DisplayedAccess[access as keyof typeof DisplayedAccess];
  const accessStyles = {
    Public: "text-green border border-green/50 bg-green/10",
    Private: "text-red border border-red/50 bg-red/10",
    "Tribe Only": "text-gold border border-gold/50 bg-gold/10",
  };

  const accessStyle = accessStyles[displayAccess as keyof typeof accessStyles] || "";

  return <span className={`text-xxs px-1 uppercase ${accessStyle}`}>{displayAccess}</span>;
};

const HyperstructureContentRow = ({
  hyperstructure,
  progress,
}: {
  hyperstructure: HyperstructureInfo;
  progress: { percentage: number };
}) => {
  // Hooks
  const {
    setup: { components },
    account: { account },
  } = useDojo();

  // Entity ID as number
  const entityId = Number(hyperstructure.entity_id);

  // Get latest co-owner change event
  const latestCoOwnerChange = LeaderboardManager.instance(
    components,
    getRealmCountPerHyperstructure(),
  ).getCurrentCoOwners(entityId);
  // If no co-owner event and progress is 100%, co-owners need to be set
  const needsCoOwners = !latestCoOwnerChange && progress.percentage === 100;

  // Player's shares in this hyperstructure
  const playerShares =
    LeaderboardManager.instance(components, getRealmCountPerHyperstructure()).getPlayerShares(
      ContractAddress(account.address),
      entityId,
    ) || 0;

  // Owner and guild info
  const ownerName = hyperstructure.ownerName;
  const ownerAddress = hyperstructure.owner;
  const guildName = getGuildFromPlayerAddress(ownerAddress || 0n, components)?.name;

  // Progress bar color logic
  const progressBarColor =
    progress.percentage < 50 ? "bg-gold" : progress.percentage < 100 ? "bg-amber-500" : "bg-green/90";

  // Format shares as percentage
  const formattedShares = currencyIntlFormat(playerShares * 100, 0);

  return (
    <div className="">
      {/* Progress section */}
      <div className="mb-2">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-gold/80">Progress</span>
          <span className="text-xs font-medium text-gold">{progress.percentage.toFixed(1)}%</span>
        </div>
        <div className="relative w-full h-3 bg-gray-800 border border-gold/30 rounded overflow-hidden">
          <div
            className={`absolute left-0 top-0 h-full ${progressBarColor} transition-all duration-500`}
            style={{ width: `${progress.percentage}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-medium text-white drop-shadow-md">
              {`${progress.percentage.toFixed(0)}%`}
            </span>
          </div>
        </div>
      </div>

      <div className="flex justify-between text-xs">
        {/* Owner info */}
        <div className="flex items-center gap-2">
          <span className="text-gold/80">Owner:</span>
          <span className="font-medium">{guildName || ownerName || MERCENARIES}</span>
        </div>
        {/* Status info */}
        <div className="flex items-center gap-2">
          {needsCoOwners && <div className="text-xs text-red animate-pulse">Co-owners not set</div>}
        </div>
        {/* Shares info */}
        <div className="flex items-center gap-2">
          <span className="text-gold/80">My Shares:</span>
          <span className="font-medium">{formattedShares}%</span>
          {playerShares > 0 && (
            <span className="text-xs text-green bg-green/10 px-1.5 py-0.5 rounded-sm">Contributing</span>
          )}
        </div>
      </div>
    </div>
  );
};
