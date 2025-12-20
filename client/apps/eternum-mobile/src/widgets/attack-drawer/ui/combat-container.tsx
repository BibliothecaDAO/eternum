import { useStore } from "@/shared/store";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { ResourceIcon } from "@/shared/ui/resource-icon";
import { Separator } from "@/shared/ui/separator";
import {
  Biome,
  CombatSimulator,
  configManager,
  divideByPrecision,
  getArmy,
  getBlockTimestamp,
  getEntityIdFromKeys,
  FELT_CENTER as getFeltCenterOffset,
  getGuardsByStructure,
  getRemainingCapacityInKg,
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

enum AttackerType {
  Structure,
  Army,
}

interface CombatContainerProps {
  attackerEntityId: ID;
  targetHex: { x: number; y: number };
}

export const CombatContainer = ({ attackerEntityId, targetHex }: CombatContainerProps) => {
  const {
    account: { account },
    setup: {
      systemCalls: { attack_explorer_vs_explorer, attack_explorer_vs_guard, attack_guard_vs_explorer },
      components,
      components: { Tile, Structure, ExplorerTroops },
    },
    network: { toriiClient },
  } = useDojo();

  const [loading, setLoading] = useState(false);
  const [selectedGuardSlot, setSelectedGuardSlot] = useState<number | null>(null);
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

  // Determine if the attacker is a structure or an explorer
  const attackerType = useMemo(() => {
    const structure = getComponentValue(Structure, getEntityIdFromKeys([BigInt(attackerEntityId)]));
    return structure ? AttackerType.Structure : AttackerType.Army;
  }, [attackerEntityId, Structure]);

  // Get all guards for the structure if the attacker is a structure
  const structureGuards = useMemo(() => {
    if (attackerType !== AttackerType.Structure) return [];
    const structure = getComponentValue(Structure, getEntityIdFromKeys([BigInt(attackerEntityId)]));
    return structure ? getGuardsByStructure(structure) : [];
  }, [attackerType, attackerEntityId, Structure]);

  const attackerStamina = useMemo(() => {
    const { currentArmiesTick } = getBlockTimestamp();

    if (attackerType === AttackerType.Structure) {
      if (selectedGuardSlot === null && structureGuards.length > 0) {
        setSelectedGuardSlot(structureGuards[0].slot);
        const guard = structureGuards[0];
        if (!guard.troops.stamina) return 0n;
        return StaminaManager.getStamina(guard.troops, currentArmiesTick).amount;
      } else if (selectedGuardSlot !== null) {
        const selectedGuard = structureGuards.find((guard) => guard.slot === selectedGuardSlot);
        if (selectedGuard && selectedGuard.troops.stamina) {
          return StaminaManager.getStamina(selectedGuard.troops, currentArmiesTick).amount;
        }
      }
      return 0n;
    }

    const army = getArmy(attackerEntityId, ContractAddress(account.address), components);
    return army ? StaminaManager.getStamina(army.troops, currentArmiesTick).amount : 0n;
  }, [attackerEntityId, attackerType, components, selectedGuardSlot, structureGuards, account.address]);

  // Get the current army states for display
  const attackerArmyData = useMemo(() => {
    if (attackerType === AttackerType.Structure) {
      if (selectedGuardSlot === null) return null;

      const selectedGuard = structureGuards.find((guard) => guard.slot === selectedGuardSlot);
      if (!selectedGuard) return null;

      return {
        troops: {
          count: selectedGuard.troops.count || 0n,
          category: selectedGuard.troops.category as TroopType,
          tier: selectedGuard.troops.tier as TroopTier,
          stamina: selectedGuard.troops.stamina || { amount: 0n, updated_tick: 0n },
          battle_cooldown_end: 0,
        },
      };
    } else {
      const army = getComponentValue(ExplorerTroops, getEntityIdFromKeys([BigInt(attackerEntityId)]));

      return {
        troops: {
          count: army?.troops.count || 0n,
          category: army?.troops.category as TroopType,
          tier: army?.troops.tier as TroopTier,
          stamina: army?.troops.stamina || { amount: 0n, updated_tick: 0n },
          battle_cooldown_end: army?.troops.battle_cooldown_end || 0,
        },
      };
    }
  }, [attackerEntityId, attackerType, selectedGuardSlot, structureGuards]);

  const targetArmyData = useMemo(() => {
    if (!target?.info[0]) return null;

    return {
      troops: {
        count: target.info[0].count || 0n,
        category: target.info[0].category as TroopType,
        tier: target.info[0].tier as TroopTier,
        stamina: target.info[0].stamina,
        battle_cooldown_end: target.info[0].battle_cooldown_end || 0,
      },
    };
  }, [target]);

  const totalDefenderTroopsRaw = useMemo(() => {
    if (!target?.info || target.info.length === 0) return 0;
    return target.info.reduce((total, troop) => total + Number(troop.count || 0n), 0);
  }, [target]);

  const totalDefenderTroops = useMemo(() => divideByPrecision(totalDefenderTroopsRaw), [totalDefenderTroopsRaw]);

  const isVillageWithoutTroops = useMemo(() => {
    return target?.structureCategory === StructureType.Village && !target?.info.length;
  }, [target]);

  const params = configManager.getCombatConfig();
  const combatSimulator = useMemo(() => new CombatSimulator(params), [params]);

  // Simulate battle outcome
  const battleSimulation = useMemo(() => {
    if (!attackerArmyData || !targetArmyData) return null;

    const attackerArmy = {
      entity_id: attackerEntityId,
      stamina: Number(attackerStamina),
      troopCount: Number(attackerArmyData.troops.count) / RESOURCE_PRECISION,
      troopType: attackerArmyData.troops.category as TroopType,
      tier: attackerArmyData.troops.tier as TroopTier,
      battle_cooldown_end: attackerArmyData.troops.battle_cooldown_end,
    };

    const defenderArmy = {
      entity_id: target?.id || 0,
      stamina: Number(targetArmyData.troops.stamina.amount),
      troopCount: Number(targetArmyData.troops.count) / RESOURCE_PRECISION,
      troopType: targetArmyData.troops.category as TroopType,
      tier: targetArmyData.troops.tier as TroopTier,
      battle_cooldown_end: targetArmyData.troops.battle_cooldown_end,
    };

    const now = Math.floor(Date.now() / 1000);
    const result = combatSimulator.simulateBattleWithParams(now, attackerArmy, defenderArmy, biome, [], []);

    const attackerTroopsLost = result.defenderDamage;
    const defenderTroopsLost = result.attackerDamage;

    const attackerTroopsLeft = attackerArmy.troopCount - attackerTroopsLost;
    const defenderTroopsLeft = defenderArmy.troopCount - defenderTroopsLost;

    let winner = null;
    if (attackerTroopsLeft <= 0 && defenderTroopsLeft > 0) {
      winner = defenderArmy.entity_id;
    } else if (defenderTroopsLeft <= 0 && attackerTroopsLeft > 0) {
      winner = attackerArmy.entity_id;
    }

    return {
      attackerTroopsLeft,
      defenderTroopsLeft,
      winner,
      attackerDamage: result.attackerDamage,
      defenderDamage: result.defenderDamage,
    };
  }, [attackerEntityId, target, attackerStamina, attackerArmyData, targetArmyData, biome, combatSimulator]);

  const remainingCapacity = useMemo(() => {
    const resource = getComponentValue(components.Resource, getEntityIdFromKeys([BigInt(attackerEntityId)]));
    const remainingCapacity = resource ? getRemainingCapacityInKg(resource) : 0;
    const remainingCapacityAfterRaid =
      remainingCapacity -
      (battleSimulation?.defenderDamage || 0) * configManager.getCapacityConfigKg(CapacityConfig.Army);
    return { beforeRaid: remainingCapacity, afterRaid: remainingCapacityAfterRaid };
  }, [battleSimulation, components.Resource, attackerEntityId]);

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
        let maxStealableAmount;
        if (resourceWeight === 0) {
          maxStealableAmount = availableAmount;
        } else {
          maxStealableAmount = Math.min(
            Math.floor(Number(capacityAfterRaid) / Number(resourceWeight)),
            availableAmount,
          );
        }
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
          // For structures, get guards and resources
          const structure = getComponentValue(Structure, getEntityIdFromKeys([BigInt(targetTile.occupier_id)]));
          if (structure) {
            const guards = getGuardsByStructure(structure).filter((guard) => guard.troops.count > 0n);
            setTarget({
              info: guards.map((guard) => ({
                ...guard.troops,
                stamina: StaminaManager.getStamina(guard.troops, currentArmiesTick),
              })),
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
          // For armies/explorers
          const explorer = getComponentValue(ExplorerTroops, getEntityIdFromKeys([BigInt(targetTile.occupier_id)]));
          if (explorer) {
            setTarget({
              info: [
                {
                  ...explorer.troops,
                  stamina: StaminaManager.getStamina(explorer.troops, currentArmiesTick),
                },
              ],
              id: targetTile?.occupier_id,
              targetType: TargetType.Army,
              structureCategory: null,
              hex: { x: targetTile.col, y: targetTile.row },
              addressOwner: null, // TODO: Get owner from API
            });

            // Get resources from the explorer
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
        }
      } catch (error) {
        console.error("Failed to fetch target:", error);
      } finally {
        setIsTargetLoading(false);
      }
    };

    getTarget();
  }, [targetTile, components, toriiClient]);

  const onAttack = async () => {
    console.log("Attack button clicked");
    console.log("selectedHex:", selectedHex);
    console.log("attackerType:", attackerType);
    console.log("selectedGuardSlot:", selectedGuardSlot);
    console.log("target:", target);

    if (!selectedHex) {
      console.error("Attack failed: No selected hex");
      alert("Attack failed: No selected hex. Please select your attacking unit first.");
      return;
    }

    try {
      setLoading(true);

      if (attackerType === AttackerType.Structure) {
        if (selectedGuardSlot === null) {
          console.error("Attack failed: No guard slot selected");
          alert("Attack failed: No guard slot selected. Please select a guard unit.");
          return;
        }
        console.log("Executing guard vs explorer attack");
        await onGuardVsExplorerAttack();
      } else if (target?.targetType === TargetType.Army) {
        console.log("Executing explorer vs explorer attack");
        await onExplorerVsExplorerAttack();
      } else {
        console.log("Executing explorer vs guard attack");
        await onExplorerVsGuardAttack();
      }

      console.log("Attack completed successfully");
      closeAttackDrawer();
    } catch (error) {
      console.error("Attack failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const onExplorerVsGuardAttack = async () => {
    if (!selectedHex) {
      console.error("Explorer vs Guard: No selected hex");
      return;
    }
    console.log("selectedHex:", selectedHex);
    console.log("targetHex:", targetHex);

    const FELT_CENTER = getFeltCenterOffset();
    // Convert selectedHex to match coordinate system of targetHex
    const normalizedSelectedHex = {
      col: selectedHex.col + FELT_CENTER,
      row: selectedHex.row + FELT_CENTER,
    };
    const normalizedTargetHex = {
      col: targetHex.x,
      row: targetHex.y,
    };

    console.log("normalizedSelectedHex:", normalizedSelectedHex);
    console.log("normalizedTargetHex:", normalizedTargetHex);

    const direction = getDirectionBetweenAdjacentHexes(normalizedSelectedHex, normalizedTargetHex);
    console.log("Explorer vs Guard direction:", direction);
    if (direction === null) {
      console.error("Explorer vs Guard: Invalid direction - hexes are not adjacent");
      console.error(
        "Distance between hexes:",
        Math.abs(normalizedSelectedHex.col - normalizedTargetHex.col) +
          Math.abs(normalizedSelectedHex.row - normalizedTargetHex.row),
      );
      return;
    }

    console.log("Explorer vs Guard attack params:", {
      explorer_id: attackerEntityId,
      structure_id: target?.id || 0,
      structure_direction: direction,
    });

    await attack_explorer_vs_guard({
      signer: account,
      explorer_id: attackerEntityId,
      structure_id: target?.id || 0,
      structure_direction: direction,
    });
  };

  const onExplorerVsExplorerAttack = async () => {
    if (!selectedHex) {
      console.error("Explorer vs Explorer: No selected hex");
      return;
    }

    const FELT_CENTER = getFeltCenterOffset();
    // Convert selectedHex to match coordinate system of targetHex
    const normalizedSelectedHex = {
      col: selectedHex.col + FELT_CENTER,
      row: selectedHex.row + FELT_CENTER,
    };
    const normalizedTargetHex = {
      col: targetHex.x,
      row: targetHex.y,
    };

    const direction = getDirectionBetweenAdjacentHexes(normalizedSelectedHex, normalizedTargetHex);
    console.log("Explorer vs Explorer direction:", direction);
    if (direction === null) {
      console.error("Explorer vs Explorer: Invalid direction");
      return;
    }

    console.log("Explorer vs Explorer attack params:", {
      aggressor_id: attackerEntityId,
      defender_id: target?.id || 0,
      defender_direction: direction,
      steal_resources: targetResources,
    });

    await attack_explorer_vs_explorer({
      signer: account,
      aggressor_id: attackerEntityId,
      defender_id: target?.id || 0,
      defender_direction: direction,
      steal_resources: targetResources,
    });
  };

  const onGuardVsExplorerAttack = async () => {
    if (!selectedHex || selectedGuardSlot === null) {
      console.error("Guard vs Explorer: Missing selectedHex or selectedGuardSlot");
      return;
    }

    const FELT_CENTER = getFeltCenterOffset();
    // Convert selectedHex to match coordinate system of targetHex
    const normalizedSelectedHex = {
      col: selectedHex.col + FELT_CENTER,
      row: selectedHex.row + FELT_CENTER,
    };
    const normalizedTargetHex = {
      col: targetHex.x,
      row: targetHex.y,
    };

    const direction = getDirectionBetweenAdjacentHexes(normalizedSelectedHex, normalizedTargetHex);
    console.log("Guard vs Explorer direction:", direction);
    if (direction === null) {
      console.error("Guard vs Explorer: Invalid direction");
      return;
    }

    console.log("Guard vs Explorer attack params:", {
      structure_id: attackerEntityId,
      structure_guard_slot: selectedGuardSlot,
      explorer_id: target?.id || 0,
      explorer_direction: direction,
    });

    await attack_guard_vs_explorer({
      signer: account,
      structure_id: attackerEntityId,
      structure_guard_slot: selectedGuardSlot,
      explorer_id: target?.id || 0,
      explorer_direction: direction,
    });
  };

  const isAttackerOnCooldown = useMemo(() => {
    if (!attackerArmyData) return false;
    const currentTime = Math.floor(Date.now() / 1000);
    return attackerArmyData.troops.battle_cooldown_end > currentTime;
  }, [attackerArmyData]);

  const buttonMessage = useMemo(() => {
    if (isVillageWithoutTroops) return "Villages cannot be claimed";
    if (isAttackerOnCooldown) return "On Battle Cooldown";
    if (attackerStamina < combatConfig.stamina_attack_req)
      return `Not Enough Stamina (${combatConfig.stamina_attack_req} Required)`;
    if (!attackerArmyData) return "No Troops Present";
    return "Attack!";
  }, [isVillageWithoutTroops, isAttackerOnCooldown, attackerStamina, attackerArmyData, combatConfig]);

  const canAttack = useMemo(() => {
    return (
      !isVillageWithoutTroops &&
      !isAttackerOnCooldown &&
      attackerStamina >= combatConfig.stamina_attack_req &&
      attackerArmyData
    );
  }, [isVillageWithoutTroops, isAttackerOnCooldown, attackerStamina, attackerArmyData, combatConfig]);

  if (isTargetLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading target...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Troop Selector for Structure */}
      {attackerType === AttackerType.Structure && structureGuards.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Select Attacking Troops</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2">
              {structureGuards.map((guard) => (
                <button
                  key={guard.slot}
                  onClick={() => setSelectedGuardSlot(guard.slot)}
                  className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
                    selectedGuardSlot === guard.slot
                      ? "border-primary bg-primary/10"
                      : "border-muted hover:border-muted-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ResourceIcon resourceId={Number(TroopType[guard.troops.category as TroopType])} size={20} />
                    <span className="font-medium">
                      {TroopType[guard.troops.category as TroopType]} T{guard.troops.tier} (Slot {guard.slot})
                    </span>
                  </div>
                  <Badge variant="secondary">{divideByPrecision(Number(guard.troops.count || 0))}</Badge>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Forces Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Attacker Forces */}
        <Card>
          <CardHeader>
            <CardTitle className="text-green-600">Your Forces</CardTitle>
          </CardHeader>
          <CardContent>
            {attackerArmyData ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span>Troops:</span>
                  <Badge variant="secondary">
                    {divideByPrecision(Number(attackerArmyData.troops.count))}{" "}
                    {TroopType[attackerArmyData.troops.category]} T{attackerArmyData.troops.tier}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Stamina:</span>
                  <Badge
                    variant={Number(attackerStamina) >= combatConfig.stamina_attack_req ? "default" : "destructive"}
                  >
                    {Number(attackerStamina)} / {combatConfig.stamina_attack_req}
                  </Badge>
                </div>
                {battleSimulation && (
                  <div className="flex items-center justify-between">
                    <span>Estimated Losses:</span>
                    <Badge variant="destructive">{Math.floor(battleSimulation.defenderDamage)}</Badge>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">No troops available</p>
            )}
          </CardContent>
        </Card>

        {/* Defender Forces */}
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Enemy Forces</CardTitle>
          </CardHeader>
          <CardContent>
            {target && targetArmyData ? (
              <div className="space-y-3">
                {totalDefenderTroopsRaw > 0 && (
                  <div className="flex items-center justify-between">
                    <span>Total Defenders:</span>
                    <Badge variant="default">{totalDefenderTroops.toLocaleString()}</Badge>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span>Troops:</span>
                  <Badge variant="secondary">
                    {divideByPrecision(Number(targetArmyData.troops.count))} {TroopType[targetArmyData.troops.category]}{" "}
                    T{targetArmyData.troops.tier}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Stamina:</span>
                  <Badge variant="default">{Number(targetArmyData.troops.stamina.amount)}</Badge>
                </div>
                {battleSimulation && (
                  <div className="flex items-center justify-between">
                    <span>Estimated Losses:</span>
                    <Badge variant="destructive">{Math.floor(battleSimulation.attackerDamage)}</Badge>
                  </div>
                )}
              </div>
            ) : !target ? (
              <p className="text-muted-foreground">No target found</p>
            ) : (
              <p className="text-green-600">No defending troops</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Battle Results */}
      {battleSimulation && (
        <Card>
          <CardHeader>
            <CardTitle>Battle Prediction</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span>Winner:</span>
                <Badge
                  variant={
                    battleSimulation.winner === attackerEntityId
                      ? "default"
                      : battleSimulation.winner === null
                        ? "secondary"
                        : "destructive"
                  }
                >
                  {battleSimulation.winner === attackerEntityId
                    ? "Victory"
                    : battleSimulation.winner === null
                      ? "Draw"
                      : "Defeat"}
                </Badge>
              </div>

              {battleSimulation.winner === attackerEntityId &&
                target?.targetType === TargetType.Army &&
                stealableResources.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-medium mb-2">Resources to Steal:</h4>
                      <div className="space-y-2">
                        {stealableResources.map((resource) => (
                          <div key={resource.resourceId} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <ResourceIcon resourceId={resource.resourceId} size={16} />
                              <span className="text-sm">
                                {resources.find((r) => r.id === resource.resourceId)?.trait || ""}
                              </span>
                            </div>
                            <Badge variant="outline">{resource.amount}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attack Button */}
      <Button onClick={onAttack} disabled={!canAttack || loading} className="w-full" size="lg">
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Attacking...
          </>
        ) : (
          buttonMessage
        )}
      </Button>

      {!canAttack && (
        <div className="text-sm text-muted-foreground text-center">
          {Number(attackerStamina) < combatConfig.stamina_attack_req &&
            `Insufficient stamina: ${Number(attackerStamina)} / ${combatConfig.stamina_attack_req} required`}
        </div>
      )}
    </div>
  );
};
