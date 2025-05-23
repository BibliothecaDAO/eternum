import { useSyncHyperstructure } from "@/hooks/helpers/use-sync";
import { Position } from "@/types/position";
import { HintSection } from "@/ui/components/hints/hint-modal";
import { DisplayedAccess, HyperstructurePanel } from "@/ui/components/hyperstructures/hyperstructure-panel";
import { NavigateToPositionIcon } from "@/ui/components/military/army-chip";
import Button from "@/ui/elements/button";
import { HintModalButton } from "@/ui/elements/hint-modal-button";
import { LoadingAnimation } from "@/ui/elements/loading-animation";
import TextInput from "@/ui/elements/text-input";
import { ViewOnMapIcon } from "@/ui/elements/view-on-map-icon";
import { currencyIntlFormat } from "@/ui/utils/utils";
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

// Define filter options
type FilterOption = "all" | "mine" | "my-guild" | "public" | "completed" | "in-progress" | "initialized" | "favorites";

export const WorldStructuresMenu = ({ className }: { className?: string }) => {
  const {
    setup: { components },
    account: { account },
  } = useDojo();

  const { isSyncing } = useSyncHyperstructure();

  const [selectedEntity, setSelectedEntity] = useState<HyperstructureInfo | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<FilterOption>("all");

  // Favorites state with localStorage persistence
  const [favorites, setFavorites] = useState<number[]>(() => {
    const saved = localStorage.getItem("favoriteHyperstructures");
    return saved ? JSON.parse(saved) : [];
  });

  const hyperstructures = useHyperstructures();

  // Get list of hyperstructures with player contributions
  const myHyperstructureIds = useMemo(() => {
    const myStructures = LeaderboardManager.instance(components).getHyperstructuresWithSharesFromPlayer(
      ContractAddress(account.address),
    );
    return Array.isArray(myStructures) ? myStructures.map((h) => Number(h.entity_id)) : [];
  }, [components, account.address]);

  // Process hyperstructures data with favorites
  const hyperstructuresList = useMemo(() => {
    return hyperstructures
      .map((hyperstructure) => ({
        ...hyperstructure,
        isFavorite: favorites.includes(Number(hyperstructure.entity_id)),
      }))
      .sort((a, b) => Number(a.entity_id) - Number(b.entity_id));
  }, [hyperstructures, favorites]);

  const myGuild = useComponentValue(components.GuildMember, getEntityIdFromKeys([ContractAddress(account.address)]));

  // Toggle favorite functionality
  const toggleFavorite = useCallback((entityId: number, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent triggering the row click
    setFavorites((prev) => {
      const newFavorites = prev.includes(entityId) ? prev.filter((id) => id !== entityId) : [...prev, entityId];
      localStorage.setItem("favoriteHyperstructures", JSON.stringify(newFavorites));
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

  // Filter button component
  const FilterButton = ({ label, value }: { label: string; value: FilterOption }) => (
    <button
      className={clsx("px-2 py-1 text-xxs rounded-md transition-colors flex items-center gap-1 justify-center", {
        "bg-gold/20 text-gold": activeFilter === value,
        "hover:bg-gray-700/30": activeFilter !== value,
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
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 t" />
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
                {filteredHyperstructures.length > 0 ? (
                  <ul className="space-y-1">
                    {filteredHyperstructures.map((hyperstructure) => {
                      // Get progress for display and filtering
                      const progress = getHyperstructureProgress(hyperstructure.entity_id, components);

                      // Filter out based on progress if needed
                      if (
                        (activeFilter === "completed" && progress.percentage !== 100) ||
                        (activeFilter === "in-progress" && progress.percentage === 100)
                      ) {
                        return null;
                      }

                      return (
                        <li
                          className={clsx(
                            "p-3 hover:bg-crimson/10 rounded border panel-wood transition-all cursor-pointer",
                            "hover:translate-y-[-2px] hover:shadow-md",
                          )}
                          key={hyperstructure.entity_id}
                          onClick={() => setSelectedEntity(hyperstructure)}
                        >
                          <div className="flex flex-col space-y-3">
                            <div className="flex flex-row justify-between items-center">
                              <div className="flex flex-row items-center gap-2 flex-wrap">
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
                                <h5 className="font-semibold text-gold">{hyperstructure.name}</h5>
                                {hyperstructure?.access && <AccessBadge access={hyperstructure.access} />}
                                <div className="flex flex-row gap-1 ml-auto sm:ml-0">
                                  <ViewOnMapIcon
                                    className="my-auto hover:scale-110 transition-transform"
                                    position={
                                      new Position({
                                        x: hyperstructure.position.x || 0,
                                        y: hyperstructure.position.y || 0,
                                      })
                                    }
                                  />
                                  <NavigateToPositionIcon
                                    className="h-6 w-6 hover:scale-110 transition-transform"
                                    position={
                                      new Position({
                                        x: hyperstructure.position.x || 0,
                                        y: hyperstructure.position.y || 0,
                                      })
                                    }
                                  />
                                </div>
                              </div>
                              <ArrowRight className="w-4 h-4 fill-current text-gold/60" />
                            </div>

                            <HyperstructureContentRow hyperstructure={hyperstructure} progress={progress} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                    <div className="text-sm mb-2">No hyperstructures found</div>
                    <div className="text-xs">Try adjusting your filters or search</div>
                  </div>
                )}
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
  const latestCoOwnerChange = LeaderboardManager.instance(components).getCurrentCoOwners(entityId);
  // If no co-owner event and progress is 100%, co-owners need to be set
  const needsCoOwners = !latestCoOwnerChange && progress.percentage === 100;

  // Player's shares in this hyperstructure
  const playerShares =
    LeaderboardManager.instance(components).getPlayerShares(ContractAddress(account.address), entityId) || 0;

  // Owner and guild info
  const ownerName = hyperstructure.ownerName;
  const ownerAddress = hyperstructure.owner;
  const guildName = getGuildFromPlayerAddress(ownerAddress || 0n, components)?.name;

  // Progress bar color logic
  const progressBarColor = progress.percentage < 50 ? "bg-red" : progress.percentage < 100 ? "bg-yellow" : "bg-green";

  // Format shares as percentage
  const formattedShares = currencyIntlFormat(playerShares * 100, 0);

  return (
    <div className="">
      {/* Progress bar */}
      <div className="relative w-full h-1.5 rounded-full overflow-hidden">
        <div
          className={`absolute left-0 top-0 h-full ${progressBarColor} transition-all duration-500`}
          style={{ width: `${progress.percentage}%` }}
        />
      </div>

      <div className="flex justify-between text-xs">
        {/* Owner info */}
        <div className="flex items-center gap-2">
          <span className="text-gold/80">Owner:</span>
          <span className="font-medium">{guildName || ownerName || MERCENARIES}</span>
        </div>
        {/* Progress info */}
        <div className="flex items-center gap-2">
          <span className="text-gold/80">Progress:</span>
          <span className="font-medium">{progress.percentage.toFixed(2)}%</span>
          {needsCoOwners && <div className="text-xs text-red animate-pulse">Co-owners not set</div>}
        </div>
        {/* Shares info */}
        <div className="flex items-center gap-2">
          <span className="text-gold/80">Shares:</span>
          <span className="font-medium">{formattedShares}%</span>
          {playerShares > 0 && (
            <span className="text-xs text-green bg-green/10 px-1.5 py-0.5 rounded-sm">Contributing</span>
          )}
        </div>
      </div>
    </div>
  );
};
