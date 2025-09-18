import { useStore } from "@/shared/store";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { ResourceIcon } from "@/shared/ui/resource-icon";
import { Separator } from "@/shared/ui/separator";
import {
  Biome,
  configManager,
  divideByPrecision,
  getArmy,
  getBlockTimestamp,
  getEntityIdFromKeys,
  getRemainingCapacityInKg,
  RaidSimulator,
  StaminaManager,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import {
  CapacityConfig,
  ContractAddress,
  getDirectionBetweenAdjacentHexes,
  ID,
  RESOURCE_PRECISION,
  resources,
  STEALABLE_RESOURCES,
  StructureType,
  TroopTier,
  TroopType,
} from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import { getComponentValue } from "@dojoengine/recs";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AttackTarget, TargetType } from "../model/types";

// Function to order resources according to STEALABLE_RESOURCES order
function orderResourcesByPriority(resourceBalances: any[]): any[] {
  const orderedResources: any[] = [];

  STEALABLE_RESOURCES.forEach((resourceId) => {
    const resource = resourceBalances.find((r) => r.resourceId === resourceId);
    if (resource) {
      orderedResources.push(resource);
    }
  });

  return orderedResources;
}

enum RaidOutcome {
  Success = "Success",
  Failure = "Failure",
  Chance = "Chance",
}

interface RaidContainerProps {
  attackerEntityId: ID;
  targetHex: { x: number; y: number };
}

export const RaidContainer = ({ attackerEntityId, targetHex }: RaidContainerProps) => {
  const {
    account: { account },
    setup: {
      systemCalls: { raid_explorer_vs_guard },
      components,
      components: { Tile, Structure },
    },
  } = useDojo();

  const [loading, setLoading] = useState(false);
  const [target, setTarget] = useState<AttackTarget | null>(null);
  const [targetResources, setTargetResources] = useState<Array<{ resourceId: number; amount: number }>>([]);
  const [isTargetLoading, setIsTargetLoading] = useState(false);

  const selectedHex = useStore((state) => state.selectedHex);
  const closeAttackDrawer = useStore((state) => state.closeAttackDrawer);

  const targetTile = useComponentValue(Tile, getEntityIdFromKeys([BigInt(targetHex.x), BigInt(targetHex.y)]));

  const combatConfig = useMemo(() => {
    return configManager.getCombatConfig();
  }, []);

  const biome = useMemo(() => {
    return Biome.getBiome(targetHex.x, targetHex.y);
  }, [targetHex]);

  // Get the current army states for display
  const attackerArmyData = useMemo(() => {
    const army = getArmy(attackerEntityId, ContractAddress(account.address), components);
    const { currentArmiesTick } = getBlockTimestamp();

    return {
      capacity: army?.totalCapacity,
      troops: {
        count: Number(army?.troops.count || 0),
        category: army?.troops.category as TroopType,
        tier: army?.troops.tier as TroopTier,
        stamina: army ? StaminaManager.getStamina(army?.troops, currentArmiesTick) : { amount: 0n, updated_tick: 0n },
        battle_cooldown_end: army?.troops.battle_cooldown_end || 0,
      },
    };
  }, [attackerEntityId, account.address, components]);

  const params = configManager.getCombatConfig();
  const raidSimulator = useMemo(() => new RaidSimulator(params), [params]);

  // Simulate raid outcome
  const raidSimulation = useMemo(() => {
    if (!attackerArmyData || !target?.info.length) return null;

    // Convert game armies to simulator armies
    const attackerArmy = {
      entity_id: attackerEntityId,
      stamina: Number(attackerArmyData.troops.stamina.amount),
      troopCount: divideByPrecision(Number(attackerArmyData.troops.count)),
      troopType: attackerArmyData.troops.category as TroopType,
      tier: attackerArmyData.troops.tier as TroopTier,
      battle_cooldown_end: attackerArmyData.troops.battle_cooldown_end,
    };

    // Convert all defender troops into simulator armies
    const defenders = target.info.map((troop) => ({
      entity_id: target?.id || 0,
      stamina: Number(troop.stamina.amount || 0),
      troopCount: divideByPrecision(Number(troop.count)),
      troopType: troop.category as TroopType,
      tier: troop.tier as TroopTier,
      battle_cooldown_end: troop.battle_cooldown_end || 0,
    }));

    const result = raidSimulator.simulateRaid(attackerArmy, defenders, biome, [], []);

    // Calculate total defender troops for percentages
    const totalDefenderTroops = defenders.reduce((total, troop) => total + troop.troopCount, 0);

    return {
      ...result,
      attackerTroopsLeft: attackerArmy.troopCount - result.raiderDamageTaken,
      defenderTroopsLeft: defenders.map((troop) => troop.troopCount - result.defenderDamageTaken),
      newAttackerStamina: Math.max(
        Number(attackerArmyData.troops.stamina.amount) - Number(combatConfig.stamina_attack_req),
        0,
      ),
      totalDefenderTroops,
    };
  }, [attackerEntityId, target, attackerArmyData, biome, combatConfig, raidSimulator]);

  const remainingCapacity = useMemo(() => {
    const resource = getComponentValue(components.Resource, getEntityIdFromKeys([BigInt(attackerEntityId)]));
    const remainingCapacity = resource ? getRemainingCapacityInKg(resource) : 0;
    const remainingCapacityAfterRaid =
      remainingCapacity -
      (raidSimulation?.raiderDamageTaken || 0) * configManager.getCapacityConfigKg(CapacityConfig.Army);
    return { beforeRaid: remainingCapacity, afterRaid: remainingCapacityAfterRaid };
  }, [raidSimulation, components.Resource, attackerEntityId]);

  const stealableResources = useMemo(() => {
    let capacityAfterRaid = remainingCapacity.afterRaid;
    const stealableResources: Array<{ resourceId: number; amount: number }> = [];

    if (capacityAfterRaid <= 0) {
      return stealableResources;
    }

    targetResources.forEach((resource) => {
      const availableAmount = divideByPrecision(resource.amount);
      const resourceWeight = configManager.getResourceWeightKg(resource.resourceId);
      if (capacityAfterRaid > 0) {
        const maxStealableAmount = Math.min(
          Math.floor(Number(capacityAfterRaid) / Number(resourceWeight)),
          availableAmount,
        );
        if (maxStealableAmount > 0) {
          stealableResources.push({
            ...resource,
            amount: maxStealableAmount,
          });
        }
        capacityAfterRaid -= maxStealableAmount * Number(resourceWeight);
      } else {
        return;
      }
    });
    return stealableResources;
  }, [targetResources, remainingCapacity]);

  // Fetch target data
  useEffect(() => {
    if (!targetTile?.occupier_id) return;

    const getTarget = async () => {
      setIsTargetLoading(true);
      const { currentArmiesTick } = getBlockTimestamp();
      const isStructure = targetTile?.occupier_is_structure;

      try {
        if (isStructure) {
          const structure = getComponentValue(Structure, getEntityIdFromKeys([BigInt(targetTile.occupier_id)]));
          if (structure) {
            // For raids, we only care about structures
            setTarget({
              info: [], // Structures don't have troop info for raid display
              id: targetTile?.occupier_id,
              targetType: TargetType.Structure,
              structureCategory: structure.category,
              hex: { x: targetTile.col, y: targetTile.row },
              addressOwner: structure.owner,
            });

            // Get resources from the structure
            const resource = getComponentValue(
              components.Resource,
              getEntityIdFromKeys([BigInt(targetTile.occupier_id)]),
            );
            if (resource) {
              const resourceBalances = Object.entries(resource)
                .filter(([key, value]) => key !== "__typename" && typeof value === "bigint" && value > 0n)
                .map(([key, value]) => ({
                  resourceId: parseInt(key),
                  amount: Number(value as bigint),
                }));
              setTargetResources(orderResourcesByPriority(resourceBalances));
            }
          }
        } else {
          // Raids can only target structures
          setTarget({
            info: [],
            id: targetTile?.occupier_id,
            targetType: TargetType.Army,
            structureCategory: null,
            hex: { x: targetTile.col, y: targetTile.row },
            addressOwner: null,
          });
        }
      } catch (error) {
        console.error("Failed to fetch target:", error);
      } finally {
        setIsTargetLoading(false);
      }
    };

    getTarget();
  }, [targetTile, components]);

  const onRaid = async () => {
    if (!selectedHex || stealableResources.length === 0) return;

    try {
      setLoading(true);
      await onExplorerVsStructureRaid();
      closeAttackDrawer();
    } catch (error) {
      console.error("Raid failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const onExplorerVsStructureRaid = async () => {
    if (!selectedHex || stealableResources.length === 0) return;
    const direction = getDirectionBetweenAdjacentHexes(selectedHex, { col: targetHex.x, row: targetHex.y });
    if (direction === null) return;

    // Convert resources to the format expected by the contract
    const resources = stealableResources
      .filter((r) => r.amount > 0)
      .map((r) => ({ ...r, amount: r.amount * RESOURCE_PRECISION }));

    await raid_explorer_vs_guard({
      signer: account,
      explorer_id: attackerEntityId,
      structure_id: target?.id || 0,
      structure_direction: direction,
      steal_resources: resources,
    });
  };

  const buttonMessage = useMemo(() => {
    if (attackerArmyData?.troops.stamina.amount < combatConfig.stamina_attack_req)
      return `Not Enough Stamina (${combatConfig.stamina_attack_req} Required)`;
    if (!attackerArmyData) return "No Troops Present";
    if (target?.targetType !== TargetType.Structure) return "Only structures can be raided";
    if (stealableResources.length === 0) return "No resources available to raid";
    return "Raid!";
  }, [attackerArmyData, combatConfig, target, stealableResources]);

  const canRaid = useMemo(() => {
    return (
      attackerArmyData?.troops.stamina.amount >= combatConfig.stamina_attack_req &&
      attackerArmyData &&
      target?.targetType === TargetType.Structure &&
      stealableResources.some((r) => r.resourceId > 0 && r.amount > 0) &&
      (raidSimulation?.successChance ?? 0) > 0
    );
  }, [attackerArmyData, combatConfig, target, stealableResources, raidSimulation?.successChance]);

  if (isTargetLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading target...</span>
      </div>
    );
  }

  if (target?.targetType !== TargetType.Structure) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">⚠️ Unable to Raid</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <div className="text-4xl mb-4">🛡️</div>
            <div className="text-lg font-bold text-destructive mb-2">Target cannot be raided!</div>
            <p className="text-muted-foreground">
              You can only raid structures owned by other players that contain resources.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Raider Forces */}
      <Card>
        <CardHeader>
          <CardTitle className="text-green-600">Your Raiding Force</CardTitle>
        </CardHeader>
        <CardContent>
          {attackerArmyData ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span>Troops:</span>
                <Badge variant="secondary">
                  {divideByPrecision(attackerArmyData.troops.count)} {TroopType[attackerArmyData.troops.category]} T
                  {attackerArmyData.troops.tier}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Stamina:</span>
                <Badge
                  variant={
                    Number(attackerArmyData.troops.stamina.amount) >= combatConfig.stamina_attack_req
                      ? "default"
                      : "destructive"
                  }
                >
                  {Number(attackerArmyData.troops.stamina.amount)} / {combatConfig.stamina_attack_req}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Carrying Capacity:</span>
                <Badge variant="outline">{remainingCapacity.beforeRaid} kg</Badge>
              </div>
              {raidSimulation && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span>Estimated Losses:</span>
                    <Badge variant="destructive">{Math.floor(raidSimulation.raiderDamageTaken)}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Success Chance:</span>
                    <Badge
                      variant={
                        raidSimulation.successChance >= 80
                          ? "default"
                          : raidSimulation.successChance >= 50
                            ? "secondary"
                            : "destructive"
                      }
                    >
                      {raidSimulation.successChance.toFixed(1)}%
                    </Badge>
                  </div>
                </>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">No troops available</p>
          )}
        </CardContent>
      </Card>

      {/* Target Structure */}
      <Card>
        <CardHeader>
          <CardTitle className="text-red-600">Target Structure</CardTitle>
        </CardHeader>
        <CardContent>
          {target ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span>Type:</span>
                <Badge variant="outline">
                  {target.structureCategory ? StructureType[target.structureCategory] : "Unknown"}
                </Badge>
              </div>
              {target.info.length > 0 ? (
                <div className="flex items-center justify-between">
                  <span>Guards:</span>
                  <Badge variant="destructive">
                    {target.info.length} Guard{target.info.length !== 1 ? "s" : ""}
                  </Badge>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span>Guards:</span>
                  <Badge variant="default">Undefended</Badge>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">No target structure found</p>
          )}
        </CardContent>
      </Card>

      {/* Available Resources */}
      {stealableResources.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>💰 Available Loot</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stealableResources.map((resource) => (
                <div key={resource.resourceId} className="flex items-center justify-between p-2 border rounded-md">
                  <div className="flex items-center gap-2">
                    <ResourceIcon resourceId={resource.resourceId} size={20} />
                    <span className="text-sm">{resources.find((r) => r.id === resource.resourceId)?.trait || ""}</span>
                  </div>
                  <Badge variant="outline">{resource.amount}</Badge>
                </div>
              ))}
            </div>
            <Separator className="my-3" />
            <div className="flex items-center justify-between text-sm">
              <span>Capacity After Raid:</span>
              <span>{remainingCapacity.afterRaid} kg</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Raid Prediction */}
      {raidSimulation && (
        <Card>
          <CardHeader>
            <CardTitle>📜 Raid Prediction</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span>Outcome:</span>
                <Badge
                  variant={
                    raidSimulation.outcomeType === RaidOutcome.Success
                      ? "default"
                      : raidSimulation.outcomeType === RaidOutcome.Failure
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {raidSimulation.outcomeType === RaidOutcome.Success
                    ? "Guaranteed Success"
                    : raidSimulation.outcomeType === RaidOutcome.Failure
                      ? "Guaranteed Failure"
                      : "Chance-based"}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-2 border rounded-md">
                  <div className="text-xs text-muted-foreground mb-1">Your Casualties</div>
                  <div className="text-lg font-bold text-destructive">
                    {Math.floor(raidSimulation.raiderDamageTaken)}
                  </div>
                </div>
                <div className="text-center p-2 border rounded-md">
                  <div className="text-xs text-muted-foreground mb-1">Defender Casualties</div>
                  <div className="text-lg font-bold text-destructive">
                    {Math.floor(raidSimulation.defenderDamageTaken)}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Raid Button */}
      <Button onClick={onRaid} disabled={!canRaid || loading} className="w-full" size="lg">
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Raiding...
          </>
        ) : (
          buttonMessage
        )}
      </Button>

      {!canRaid && (
        <div className="text-sm text-muted-foreground text-center space-y-1">
          {Number(attackerArmyData?.troops.stamina.amount) < combatConfig.stamina_attack_req && (
            <div>⚡ Wait for stamina to recharge ({combatConfig.stamina_attack_req} required)</div>
          )}
          {!attackerArmyData && <div>⚔️ You need troops to raid</div>}
          {stealableResources.length === 0 && target?.targetType === TargetType.Structure && (
            <div>💰 This structure has no resources to raid</div>
          )}
          {(raidSimulation?.successChance ?? 0) === 0 && <div>❌ Your chance of success is 0%</div>}
        </div>
      )}

      {/* Help Text */}
      <div className="text-xs text-muted-foreground text-center">
        Raids allow you to steal resources from enemy structures. Success chance depends on your troops, terrain
        advantages, and defender forces.
      </div>
    </div>
  );
};
