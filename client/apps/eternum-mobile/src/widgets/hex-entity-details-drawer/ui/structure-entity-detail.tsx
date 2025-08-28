import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/ui/collapsible";
import { ResourceAmount } from "@/shared/ui/resource-amount";
import { ResourceIcon } from "@/shared/ui/resource-icon";
import {
  divideByPrecision,
  getAddressName,
  getBlockTimestamp,
  getGuardsByStructure,
  getGuildFromPlayerAddress,
  getHyperstructureProgress,
  getIsBlitz,
  getStructureArmyRelicEffects,
  getStructureName,
  getStructureRelicEffects,
  MAP_DATA_REFRESH_INTERVAL,
  MapDataStore,
  ResourceManager,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { getStructureFromToriiClient } from "@bibliothecadao/torii";
import { ContractAddress, ID, MERCENARIES, RelicEffectWithEndTick, StructureType } from "@bibliothecadao/types";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Loader, MessageCircle, RefreshCw, Shield } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";

interface MobileStructureEntityDetailProps {
  structureEntityId: ID;
  compact?: boolean;
  maxInventory?: number;
  showButtons?: boolean;
}

export const StructureEntityDetail = memo(
  ({
    structureEntityId,
    compact = false,
    maxInventory = Infinity,
    showButtons = false,
  }: MobileStructureEntityDetailProps) => {
    const {
      network: { toriiClient },
      account: { account },
      setup: { components },
    } = useDojo();

    const userAddress = ContractAddress(account.address);
    const [lastRefresh, setLastRefresh] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const {
      data: structureDetails,
      isLoading: isLoadingStructure,
      refetch: refetchStructure,
    } = useQuery({
      queryKey: ["structureDetails", String(structureEntityId), String(userAddress)],
      queryFn: async () => {
        if (!toriiClient || !structureEntityId || !components || !userAddress) return null;

        const { structure, resources, productionBoostBonus } = await getStructureFromToriiClient(
          toriiClient,
          structureEntityId,
        );
        const relicEffects: RelicEffectWithEndTick[] = [];
        const { currentArmiesTick } = getBlockTimestamp();
        if (structure) {
          relicEffects.push(...getStructureArmyRelicEffects(structure, currentArmiesTick));
        }
        if (productionBoostBonus) {
          relicEffects.push(...getStructureRelicEffects(productionBoostBonus, currentArmiesTick));
        }
        if (!structure)
          return {
            structure: null,
            resources: null,
            playerGuild: undefined,
            guards: [],
            isAlly: false,
            addressName: MERCENARIES,
            isMine: false,
            hyperstructureRealmCount: undefined,
          };

        const isMine = structure.owner === userAddress;
        const guild = getGuildFromPlayerAddress(ContractAddress(structure.owner), components);
        const guards = getGuardsByStructure(structure).filter((guard) => guard.troops.count > 0n);
        const userGuild = getGuildFromPlayerAddress(userAddress, components);
        const isAlly = isMine || (guild && userGuild && guild.entityId === userGuild.entityId) || false;
        const addressName = structure.owner ? getAddressName(structure.owner, components) : MERCENARIES;

        const hyperstructureRealmCount =
          structure.base.category === StructureType.Hyperstructure
            ? MapDataStore.getInstance(MAP_DATA_REFRESH_INTERVAL, {} as any).getHyperstructureRealmCount?.(
                structure.entity_id,
              )
            : undefined;

        return {
          structure,
          resources,
          playerGuild: guild,
          guards,
          isAlly,
          addressName,
          isMine,
          relicEffects,
          hyperstructureRealmCount,
        };
      },
      staleTime: 30000,
    });

    const handleRefresh = useCallback(async () => {
      const now = Date.now();
      if (now - lastRefresh < 10000) {
        return;
      }

      setIsRefreshing(true);
      setLastRefresh(now);

      try {
        await refetchStructure();
      } finally {
        setTimeout(() => setIsRefreshing(false), 1000);
      }
    }, [lastRefresh, refetchStructure]);

    const structure = structureDetails?.structure;
    const resources = structureDetails?.resources;
    const playerGuild = structureDetails?.playerGuild;
    const guards = structureDetails?.guards || [];
    const isAlly = structureDetails?.isAlly || false;
    const addressName = structureDetails?.addressName;
    const hyperstructureRealmCount = structureDetails?.hyperstructureRealmCount;

    const isHyperstructure = structure?.base.category === StructureType.Hyperstructure;

    const progress = useMemo(() => {
      return isHyperstructure ? getHyperstructureProgress(structure?.entity_id, components) : undefined;
    }, [isHyperstructure, structure?.entity_id, components]);

    const structureName = useMemo(() => {
      return structure ? getStructureName(structure, getIsBlitz()).name : undefined;
    }, [structure]);

    if (isLoadingStructure) {
      return (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-center">
              <Loader className="animate-spin h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      );
    }

    if (!structure || !structureDetails) return null;

    const { currentDefaultTick } = getBlockTimestamp();

    // Get resource balances using proper ResourceManager
    const resourceBalances = resources
      ? ResourceManager.getResourceBalancesWithProduction(resources, currentDefaultTick).filter(
          (resource) => resource.amount > 0,
        )
      : [];

    // Get active productions using proper ResourceManager
    const activeProductions = resources ? ResourceManager.getActiveProductions(resources) : [];

    const isBlitz = getIsBlitz();

    return (
      <Card>
        <CardHeader className={compact ? "pb-2" : "pb-3"}>
          <div className="flex items-center justify-between">
            <div className="flex flex-col flex-1">
              <CardTitle className={compact ? "text-base" : "text-lg"}>{structureName}</CardTitle>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge variant={isAlly ? "default" : "destructive"}>{isAlly ? "Ally" : "Enemy"}</Badge>
              {showButtons && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isRefreshing || Date.now() - lastRefresh < 10000}
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                </Button>
              )}
              {showButtons && addressName && (
                <Button variant="outline" size="sm">
                  <MessageCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1 mt-2">
            <div className="text-sm text-muted-foreground">
              Owner: {addressName || `0x${structure.owner.toString(16)}`}
            </div>
            {playerGuild && <div className="text-xs text-muted-foreground">Guild: {playerGuild.name}</div>}
          </div>
        </CardHeader>

        <CardContent className={`space-y-3 ${compact ? "pt-0" : ""}`}>
          {/* Hyperstructure VP Display */}
          {isHyperstructure && hyperstructureRealmCount !== undefined && (
            <div className="bg-blue-50 dark:bg-blue-950/20 rounded p-3 border border-blue-200 dark:border-blue-800">
              <div className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Hyperstructure VP/s: {hyperstructureRealmCount}
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400">
                {structure?.owner !== undefined && structure?.owner !== null && structure?.owner !== 0n
                  ? "Owned"
                  : "Unowned"}
              </div>
            </div>
          )}

          {/* Construction Progress for Hyperstructures */}
          {isHyperstructure && !getIsBlitz() && (
            <div className="bg-amber-50 dark:bg-amber-950/20 rounded p-3 border border-amber-200 dark:border-amber-800">
              <div className="flex justify-between items-center mb-2">
                <div className="text-sm font-medium text-amber-800 dark:text-amber-200">Construction Progress</div>
                <div className="text-xs font-semibold bg-amber-200 dark:bg-amber-800 px-2 py-1 rounded">
                  {progress?.percentage ?? 0}%
                </div>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${progress?.percentage ?? 0}%` }}
                />
              </div>
              {progress?.percentage !== 100 && (
                <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  {progress?.percentage === 0 ? "Construction not started" : "Construction in progress"}
                </div>
              )}
            </div>
          )}

          {/* Resource Production Section */}
          {activeProductions.length > 0 && (
            <div className="bg-cyan-50 dark:bg-cyan-950/20 rounded p-3 border border-cyan-200 dark:border-cyan-800">
              <div className="text-sm font-medium text-cyan-800 dark:text-cyan-200 mb-2">Active Productions</div>
              <div className="flex flex-wrap gap-2">
                {activeProductions.slice(0, 6).map(({ resourceId, productionRate }) => {
                  const ratePerSecond = Number(divideByPrecision(Number(productionRate), false));
                  return (
                    <div
                      key={resourceId}
                      className="flex items-center gap-1 bg-white dark:bg-gray-800 rounded px-2 py-1"
                    >
                      <ResourceIcon resourceId={resourceId} size={20} />
                      <span className="text-xs text-cyan-700 dark:text-cyan-300">+{ratePerSecond}/s</span>
                    </div>
                  );
                })}
                {activeProductions.length > 6 && (
                  <div className="text-xs text-muted-foreground bg-gray-100 dark:bg-gray-800 rounded px-2 py-1">
                    +{activeProductions.length - 6} more
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Defense Section */}
          {guards.length > 0 && (
            <Collapsible>
              <div className="bg-red-50 dark:bg-red-950/20 rounded p-3 border border-red-200 dark:border-red-800">
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-red-600 dark:text-red-400" />
                      <div className="text-sm font-medium text-red-800 dark:text-red-200">
                        Defense ({guards.length})
                      </div>
                    </div>
                    <ChevronDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                  </div>
                </CollapsibleTrigger>

                {/* Collapsed view - show summary */}
                <div className="mt-2 text-xs text-red-700 dark:text-red-300">
                  {guards.reduce((total, guard) => total + divideByPrecision(Number(guard.troops.count)), 0)} total
                  troops
                </div>

                <CollapsibleContent className="mt-3">
                  <div className="space-y-2">
                    {guards.map((guard, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <Shield className="h-3 w-3" />
                          <span>Slot {guard.slot}</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="font-medium">{divideByPrecision(Number(guard.troops.count))} troops</span>
                          {guard.troops.category && (
                            <span className="text-muted-foreground capitalize">
                              {guard.troops.category} {guard.troops.tier}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}

          {/* Resources Section */}
          {resourceBalances.length > 0 && (
            <Collapsible>
              <div className="bg-green-50 dark:bg-green-950/20 rounded p-3 border border-green-200 dark:border-green-800">
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-green-800 dark:text-green-200">
                      Resources ({resourceBalances.length})
                    </div>
                    <ChevronDown className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                </CollapsibleTrigger>

                {/* Collapsed view - show first few resources */}
                <div className="mt-2 flex flex-wrap gap-2">
                  {resourceBalances.slice(0, 4).map((resource) => (
                    <div
                      key={resource.resourceId}
                      className="flex items-center gap-1 bg-white dark:bg-gray-800 rounded px-2 py-1"
                    >
                      <ResourceAmount
                        resourceId={resource.resourceId}
                        amount={divideByPrecision(Number(resource.amount))}
                        size="sm"
                        showName={false}
                      />
                    </div>
                  ))}
                  {resourceBalances.length > 4 && (
                    <div className="text-xs text-muted-foreground bg-gray-100 dark:bg-gray-800 rounded px-2 py-1">
                      +{resourceBalances.length - 4} more
                    </div>
                  )}
                </div>

                <CollapsibleContent className="mt-3">
                  <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                    {resourceBalances.slice(0, maxInventory === Infinity ? undefined : maxInventory).map((resource) => (
                      <div
                        key={resource.resourceId}
                        className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded"
                      >
                        <ResourceAmount
                          resourceId={resource.resourceId}
                          amount={divideByPrecision(Number(resource.amount))}
                          size="sm"
                          showName={true}
                        />
                      </div>
                    ))}
                  </div>
                  {maxInventory !== Infinity && resourceBalances.length > maxInventory && (
                    <div className="text-xs text-muted-foreground mt-2 text-center">
                      +{resourceBalances.length - maxInventory} more items (showing first {maxInventory})
                    </div>
                  )}
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}

          {/* Active Relic Effects */}
          {structureDetails?.relicEffects && structureDetails.relicEffects.length > 0 && (
            <div className="bg-purple-50 dark:bg-purple-950/20 rounded p-3 border border-purple-200 dark:border-purple-800">
              <div className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-2">Active Relic Effects</div>
              <div className="space-y-1">
                {structureDetails.relicEffects.slice(0, 3).map((effect, index) => (
                  <div key={index} className="text-xs text-purple-600 dark:text-purple-400">
                    Relic Effect #{effect.id}
                  </div>
                ))}
                {structureDetails.relicEffects.length > 3 && (
                  <div className="text-xs text-muted-foreground">
                    +{structureDetails.relicEffects.length - 3} more effects
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Immunity Status */}
          <div className="bg-gray-50 dark:bg-gray-950/20 rounded p-3 border border-gray-200 dark:border-gray-800">
            <div className="text-sm font-medium text-gray-800 dark:text-gray-200">Immunity Status</div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Structure immunity information</div>
          </div>
        </CardContent>
      </Card>
    );
  },
);

StructureEntityDetail.displayName = "StructureEntityDetail";
