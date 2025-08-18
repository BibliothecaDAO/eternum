import { ReactComponent as ArrowLeft } from "@/assets/icons/common/arrow-left.svg";
import { sqlApi } from "@/services/api";
import { getIsBlitz, Position as PositionType } from "@bibliothecadao/eternum";

import { Button } from "@/ui/design-system/atoms";
import { ViewOnMapIcon } from "@/ui/design-system/molecules";
import { RealmResourcesIO } from "@/ui/features/economy/resources";
import { NavigateToPositionIcon } from "@/ui/features/military";
import { getRealmCountPerHyperstructure } from "@/ui/utils/utils";
import {
  configManager,
  getAddressName,
  getRealmNameById,
  getStructureTypeName,
  LeaderboardManager,
  toHexString,
  unpackValue,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { PlayerStructure } from "@bibliothecadao/torii";
import { ContractAddress, StructureType } from "@bibliothecadao/types";
import { getComponentValue, Has, runQuery } from "@dojoengine/recs";
import { MapPin } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export const PlayerId = ({
  selectedPlayer,
  selectedGuild,
  back,
}: {
  selectedPlayer: ContractAddress;
  selectedGuild?: ContractAddress;
  back?: () => void;
}) => {
  const {
    setup: { components },
  } = useDojo();

  const [playerStructures, setPlayerStructures] = useState<PlayerStructure[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const playerName = useMemo(() => {
    if (!selectedPlayer) return;

    const playerName = getAddressName(selectedPlayer, components);
    return playerName;
  }, [selectedPlayer]);

  const hyperstructuresPointsGivenPerSecondMap = useMemo(() => {
    const hyperstructureEntities = runQuery([Has(components.Hyperstructure)]);
    const hyperstructureConfig = configManager.getHyperstructureConfig();
    const hyps: Map<string, number> = new Map();
    hyperstructureEntities.forEach((e) => {
      const hyp = getComponentValue(components.Hyperstructure, e);
      if (hyp) {
        hyps.set(hyp.hyperstructure_id.toString(), hyperstructureConfig.pointsPerCycle * hyp.points_multiplier);
      }
    });
    return hyps;
  }, [selectedPlayer]);

  // Fetch player structures from API
  useEffect(() => {
    if (!selectedPlayer) return;

    const fetchStructures = async () => {
      setIsLoading(true);
      setError(null);
      setPlayerStructures([]); // Reset structures immediately when starting new fetch
      try {
        const structures = await sqlApi.fetchPlayerStructures(toHexString(selectedPlayer));
        setPlayerStructures(structures);
      } catch (err) {
        console.error("Failed to fetch player structures:", err);
        setError("Failed to load player structures");
      } finally {
        setIsLoading(false);
      }
    };

    fetchStructures();
  }, [selectedPlayer]);

  // getHyperstructureConfig
  // Count structure types
  const structureCounts = useMemo(() => {
    if (!playerStructures) return { realms: 0, mines: 0, hyperstructures: 0, banks: 0, villages: 0 };

    return playerStructures.reduce(
      (acc, structure) => {
        if (structure.category === StructureType.Realm) {
          acc.realms++;
        } else if (structure.category === StructureType.FragmentMine) {
          acc.mines++;
        } else if (structure.category === StructureType.Hyperstructure) {
          acc.hyperstructures++;
        } else if (structure.category === StructureType.Bank) {
          acc.banks++;
        } else if (structure.category === StructureType.Village) {
          acc.villages++;
        }

        return acc;
      },
      { realms: 0, mines: 0, hyperstructures: 0, banks: 0, villages: 0 },
    );
  }, [playerStructures]);

  // Get hyperstructure shareholder points breakdown
  const unregisteredShareholderPointsBreakdown = useMemo(() => {
    if (!selectedPlayer) return [];
    return LeaderboardManager.instance(
      components,
      getRealmCountPerHyperstructure(),
    ).getPlayerHyperstructurePointsBreakdown(selectedPlayer);
  }, [selectedPlayer, components]);

  const isBlitz = getIsBlitz();

  // Helper function to get structure name
  const getStructureName = (structure: PlayerStructure, isBlitz: boolean): string => {
    if (structure.category === StructureType.Realm && structure.realm_id) {
      const baseName = getRealmNameById(structure.realm_id);
      return structure.has_wonder ? `WONDER - ${baseName}` : baseName;
    }

    // For other structure types, use the type name with entity ID
    return `${getStructureTypeName(structure.category as StructureType, isBlitz)} ${structure.entity_id}`;
  };

  // Helper function to get resources for a specific structure
  const getStructureResources = (structure: PlayerStructure): number[] => {
    if (structure.category === StructureType.Realm || structure.category === StructureType.Village) {
      return unpackValue(BigInt(structure.resources_packed));
    }
    return [];
  };

  return (
    <div className="pointer-events-auto h-full flex flex-col">
      {!!selectedGuild && (
        <Button variant={"outline"} className={"mt-2 ml-2"} onClick={back}>
          <ArrowLeft className="w-2 mr-2" /> Back
        </Button>
      )}

      <div className="p-4 flex-1 flex flex-col overflow-hidden">
        {/* Player header */}
        <div className="flex flex-row gap-4 border-gold/20">
          <AvatarImage address={toHexString(selectedPlayer!)} />

          <div className="flex flex-col justify-between flex-1">
            <div className="flex items-center justify-between mb-2">
              <div className=" items-center gap-3 rounded-lg shadow-md flex-1">
                <h4 className=" truncate">{playerName || "No player selected"}</h4>
              </div>
            </div>
          </div>
        </div>

        {/* Structure counts */}
        {playerStructures && playerStructures.length > 0 && (
          <div className="grid grid-cols-2 gap-2 my-2">
            <div className="flex flex-col items-center p-2 rounded-md border border-gold/10">
              <span className="text-xl font-bold text-gold">{structureCounts.realms}</span>
              <span className="text-xs text-gold/80 h6">Realms</span>
            </div>
            <div className="flex flex-col items-center p-2 rounded-md border border-gold/10">
              <span className="text-xl font-bold text-gold">{structureCounts.villages}</span>
              <span className="text-xs text-gold/80 h6">Villages</span>
            </div>
            <div className="flex flex-col items-center p-2 rounded-md border border-gold/10">
              <span className="text-xl font-bold text-gold">{structureCounts.hyperstructures}</span>
              <span className="text-xs text-gold/80 h6">Hyperstructures</span>
            </div>
            <div className="flex flex-col items-center p-2 rounded-md border border-gold/10">
              <span className="text-xl font-bold text-gold">{structureCounts.mines}</span>
              <span className="text-xs text-gold/80 h6">Mines</span>
            </div>
            {structureCounts.banks > 0 && (
              <div className="flex flex-col items-center p-2 rounded-md border border-gold/10">
                <span className="text-xl font-bold text-gold">{structureCounts.banks}</span>
                <span className="text-xs text-gold/80 h6">Banks</span>
              </div>
            )}
          </div>
        )}

        {/* Hyperstructure Shareholder Points */}
        {unregisteredShareholderPointsBreakdown.length > 0 && (
          <div className="mb-4 py-3">
            <h5 className="text-sm font-semibold text-gold mb-3 px-1">Hyperstructure Shareholdings</h5>
            <div className="space-y-2">
              {unregisteredShareholderPointsBreakdown.map((breakdown) => {
                const hyperstructurePointsPerSecond =
                  hyperstructuresPointsGivenPerSecondMap.get(breakdown.hyperstructureId.toString()) ?? 0;
                const pointsPerSecond = (breakdown.shareholderPercentage * hyperstructurePointsPerSecond).toFixed(2);
                return (
                  <div
                    key={breakdown.hyperstructureId}
                    className="bg-gradient-to-r from-blue-500/10 to-transparent p-3 rounded-lg border border-blue-400/30 shadow-sm hover:shadow-md transition-all duration-300"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-medium text-blue-300/90">
                        Hyperstructure #{breakdown.hyperstructureId}
                      </span>
                      <span className="text-xs text-blue-300/80"></span>
                    </div>
                    <p className="text-sm text-gray-300 flex items-center">
                      <span role="img" aria-label="sparkle" className="mr-1.5 text-base">
                        ✨
                      </span>
                      <span>
                        Share:{" "}
                        <strong className="font-medium text-yellow-400">
                          {(breakdown.shareholderPercentage * 100).toFixed(1)}%
                        </strong>
                      </span>
                      <span className="mx-1.5 text-gray-400">|</span>
                      <span>
                        Yield: <strong className="font-medium text-lime-400">{pointsPerSecond}</strong> pts/sec
                      </span>
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gold/20 scrollbar-track-transparent">
          {isLoading && (
            <div className="flex items-center justify-center p-8">
              <div className="text-gold/70">Loading player structures...</div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center p-8">
              <div className="text-red-400">{error}</div>
            </div>
          )}

          {!isLoading && !error && (
            <div className="grid grid-cols-1 gap-3">
              {playerStructures &&
                playerStructures.map((structure) => {
                  const position = new PositionType({ x: structure.coord_x, y: structure.coord_y });
                  const structureName = getStructureName(structure, isBlitz);
                  const structureResources = getStructureResources(structure);

                  let structureSpecificElement: JSX.Element | null;
                  if (structure.category === StructureType.Realm || structure.category === StructureType.Village) {
                    structureSpecificElement = (
                      <div key={`resources-${structure.entity_id}`}>
                        <RealmResourcesIO
                          className="w-full font-normal"
                          titleClassName="font-normal text-sm"
                          resourcesProduced={structureResources}
                        />
                      </div>
                    );
                  } else {
                    structureSpecificElement = null;
                  }

                  return (
                    <div
                      key={structure.entity_id}
                      className="flex flex-col gap-2 border border-gold/20 p-3 rounded-md bg-brown/5 hover:bg-brown/10 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <h6 className="truncate flex-1">{structureName}</h6>
                        <div className="flex items-center gap-1">
                          <NavigateToPositionIcon className="w-5 h-5" position={position} />
                          <ViewOnMapIcon className="w-4 h-4" position={position} />
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-xs text-gold/70 mb-2">
                        <MapPin size={12} />
                        <span>
                          Position: {position.getNormalized().x}, {position.getNormalized().y}
                        </span>
                      </div>

                      {structureSpecificElement}
                    </div>
                  );
                })}

              {(!playerStructures || playerStructures.length === 0) && !isLoading && !error && (
                <div className="col-span-2 text-center p-4 text-gold/50 italic">
                  No properties found for this player
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const AvatarImage = ({ address }: { address: string }) => {
  const randomAvatarIndex = ((parseInt(address.slice(0, 8), 16) % 7) + 1).toString().padStart(2, "0");
  const imgSource = `./images/avatars/${randomAvatarIndex}.png`;

  return (
    <div className="w-24 h-24 rounded-md overflow-hidden border-2 border-gold/20 shadow-lg bg-brown/30">
      <img className="h-full w-full object-cover" src={imgSource} alt="Player avatar" />
    </div>
  );
};
