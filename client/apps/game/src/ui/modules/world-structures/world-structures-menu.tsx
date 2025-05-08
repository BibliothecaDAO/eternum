import { useSyncHyperstructure } from "@/hooks/helpers/use-sync";
import { Position } from "@/types/position";
import { HintSection } from "@/ui/components/hints/hint-modal";
import { DisplayedAccess, HyperstructurePanel } from "@/ui/components/hyperstructures/hyperstructure-panel";
import { NavigateToPositionIcon } from "@/ui/components/military/army-chip";
import Button from "@/ui/elements/button";
import { HintModalButton } from "@/ui/elements/hint-modal-button";
import { LoadingAnimation } from "@/ui/elements/loading-animation";
import { ViewOnMapIcon } from "@/ui/elements/view-on-map-icon";
import { currencyIntlFormat } from "@/ui/utils/utils";
import { getGuildFromPlayerAddress, getHyperstructureProgress, LeaderboardManager } from "@bibliothecadao/eternum";
import { useDojo, useHyperstructures } from "@bibliothecadao/react";
import { ContractAddress, HyperstructureInfo, MERCENARIES } from "@bibliothecadao/types";
import clsx from "clsx";
import { ArrowLeft, ArrowRight, Filter, Search } from "lucide-react";
import { useMemo, useState } from "react";

// Define filter options
type FilterOption = "all" | "mine" | "completed" | "in-progress";

export const WorldStructuresMenu = ({ className }: { className?: string }) => {
  const {
    setup: { components },
    account: { account },
  } = useDojo();

  const { isSyncing } = useSyncHyperstructure();

  const [selectedEntity, setSelectedEntity] = useState<HyperstructureInfo | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<FilterOption>("all");

  const hyperstructures = useHyperstructures();

  // Get list of hyperstructures with player contributions
  const myHyperstructureIds = useMemo(() => {
    const myStructures = LeaderboardManager.instance(components).getHyperstructuresWithSharesFromPlayer(
      ContractAddress(account.address),
    );
    return Array.isArray(myStructures) ? myStructures.map((h) => Number(h.entity_id)) : [];
  }, [components, account.address]);

  // Process hyperstructures data
  const hyperstructuresList = useMemo(
    () => hyperstructures.sort((a, b) => Number(a.entity_id) - Number(b.entity_id)),
    [hyperstructures],
  );

  // Calculate counts for each filter category
  const filterCounts = useMemo(() => {
    const completedStructures = hyperstructuresList.filter(
      (entity) => getHyperstructureProgress(entity.entity_id, components).percentage === 100,
    );

    return {
      all: hyperstructuresList.length,
      mine: myHyperstructureIds.length,
      completed: completedStructures.length,
      "in-progress": hyperstructuresList.length - completedStructures.length,
    };
  }, [hyperstructuresList, myHyperstructureIds, components]);

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
      default:
        // "all" - no additional filtering
        break;
    }

    return filtered;
  }, [hyperstructuresList, searchTerm, activeFilter, myHyperstructureIds]);

  // Filter button component
  const FilterButton = ({ label, value }: { label: string; value: FilterOption }) => (
    <button
      className={clsx("px-3 py-1 text-xxs rounded-md transition-colors flex items-center gap-1.5", {
        "bg-gold/20 text-gold": activeFilter === value,
        "hover:bg-gray-700/30": activeFilter !== value,
      })}
      onClick={() => setActiveFilter(value)}
    >
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
              <div className="mb-4 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gold w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search hyperstructures..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full py-2 pl-10 pr-3 bg-black/30 border border-gray-700 rounded-md text-gold text-sm focus:outline-none focus:ring-1 focus:ring-gold text-gold"
                  />
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                  <Filter className="h-4 w-4 text-gold/80 mr-1" />
                  <FilterButton label="All" value="all" />
                  <FilterButton label="My Contributions" value="mine" />
                  <FilterButton label="Completed" value="completed" />
                  <FilterButton label="In Progress" value="in-progress" />
                </div>
              </div>

              {/* Hyperstructures list */}
              <div className="overflow-y-auto flex-grow">
                {filteredHyperstructures.length > 0 ? (
                  <ul className="space-y-3">
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
    Public: "text-green border border-green bg-green/10",
    Private: "text-red border border-red bg-red/10",
    "Tribe Only": "text-gold border border-gold bg-gold/10",
  };

  const accessStyle = accessStyles[displayAccess as keyof typeof accessStyles] || "";

  return <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${accessStyle}`}>{displayAccess}</span>;
};

const HyperstructureContentRow = ({
  hyperstructure,
  progress,
}: {
  hyperstructure: HyperstructureInfo;
  progress: { percentage: number };
}) => {
  const {
    setup: { components },
    account: { account },
  } = useDojo();

  const idNumber = Number(hyperstructure.entity_id);
  const latestChangeEvent = LeaderboardManager.instance(components).getCurrentCoOwners(idNumber);
  const needTosetCoOwners = !latestChangeEvent && progress.percentage === 100;
  const shares =
    LeaderboardManager.instance(components).getPlayerShares(ContractAddress(account.address), idNumber) || 0;

  // Get owner information
  const ownerName = hyperstructure.ownerName;
  const address = hyperstructure.owner;
  const guildName = getGuildFromPlayerAddress(address || 0n, components)?.name;

  // Calculate progress bar color
  const progressBarColor =
    progress.percentage < 50 ? "bg-red-500" : progress.percentage < 100 ? "bg-yellow-500" : "bg-green-500";

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div className="relative w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`absolute left-0 top-0 h-full ${progressBarColor} transition-all duration-500`}
          style={{ width: `${progress.percentage}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-gold/80">Owner:</span>
          <span className="font-medium">{guildName || ownerName || MERCENARIES}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gold/80">Progress:</span>
          <span className="font-medium">{progress.percentage}%</span>
          {needTosetCoOwners && <div className="text-xs text-red animate-pulse">Co-owners not set</div>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gold/80">Shares:</span>
          <span className="font-medium">{currencyIntlFormat(shares * 100, 0)}%</span>
          {shares > 0 && <span className="text-xs text-green bg-green/10 px-1.5 py-0.5 rounded-sm">Contributing</span>}
        </div>
      </div>
    </div>
  );
};
