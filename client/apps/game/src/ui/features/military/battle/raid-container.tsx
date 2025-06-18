import { useUIStore } from "@/hooks/store/use-ui-store";
import Button from "@/ui/design-system/atoms/button";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { BiomeInfoPanel } from "@/ui/features";
import { formatStringNumber } from "@/ui/utils/utils";
import { getBlockTimestamp } from "@/utils/timestamp";
import {
  Biome,
  CombatSimulator,
  configManager,
  divideByPrecision,
  getArmy,
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
  TroopTier,
  TroopType,
} from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { useMemo, useState } from "react";
import { AttackTarget, TargetType } from "./attack-container";
import { formatTypeAndBonuses } from "./combat-utils";
import { RaidResult } from "./raid-result";

enum RaidOutcome {
  Success = "Success",
  Failure = "Failure",
  Chance = "Chance",
}

export const RaidContainer = ({
  attackerEntityId,
  target,
  targetResources,
}: {
  attackerEntityId: ID;
  target: AttackTarget;
  targetResources: Array<{ resourceId: number; amount: number }>;
}) => {
  const {
    account: { account },
    setup: {
      systemCalls: { raid_explorer_vs_guard },
      components,
    },
  } = useDojo();

  const [loading, setLoading] = useState(false);
  const [showRaidResult, setShowRaidResult] = useState(false);

  const updateSelectedEntityId = useUIStore((state) => state.updateEntityActionSelectedEntityId);
  const selectedHex = useUIStore((state) => state.selectedHex);

  const combatConfig = useMemo(() => {
    return configManager.getCombatConfig();
  }, []);

  const biome = useMemo(() => {
    return Biome.getBiome(target.hex.x, target.hex.y);
  }, [target]);

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
      },
    };
  }, [attackerEntityId]);

  const params = configManager.getCombatConfig();
  const combatSimulator = useMemo(() => new CombatSimulator(params), [params]);
  const raidSimulator = useMemo(() => new RaidSimulator(params), [params]);

  // Simulate raid outcome
  const raidSimulation = useMemo(() => {
    if (!attackerArmyData) return null;

    // Convert game armies to simulator armies
    const attackerArmy = {
      entity_id: attackerEntityId,
      stamina: Number(attackerArmyData.troops.stamina.amount),
      troopCount: divideByPrecision(Number(attackerArmyData.troops.count)),
      troopType: attackerArmyData.troops.category as TroopType,
      tier: attackerArmyData.troops.tier as TroopTier,
    };

    // Convert all defender troops into simulator armies
    const defenders = target.info.map((troop) => ({
      entity_id: target?.id || 0,
      stamina: Number(troop.stamina.amount || 0),
      troopCount: divideByPrecision(Number(troop.count)),
      troopType: troop.category as TroopType,
      tier: troop.tier as TroopTier,
    }));

    // Use the raid simulator to predict the outcome
    const result = raidSimulator.simulateRaid(attackerArmy, defenders, biome);

    // Calculate total defender troops for percentages
    const totalDefenderTroops = defenders.reduce((total, troop) => total + troop.troopCount, 0);

    return {
      ...result,
      attackerTroopsLeft: attackerArmy.troopCount - result.raiderDamageTaken,
      defenderTroopsLeft: defenders.map((troop) => troop.troopCount - result.defenderDamageTaken),
      newAttackerStamina: Math.max(
        Number(attackerArmyData.troops.stamina.amount) - Number(combatConfig.stamina_attack_max),
        0,
      ),
      newDefendersStamina: defenders.map((troop) => troop.stamina - result.defenderDamageTaken),
      totalDefenderTroops,
    };
  }, [attackerEntityId, target, account, components, attackerArmyData, biome, combatConfig, raidSimulator]);

  const remainingCapacity = useMemo(() => {
    // you can use getcomponentvalue because it's your own entity so synced
    const resource = getComponentValue(components.Resource, getEntityIdFromKeys([BigInt(attackerEntityId)]));
    const remainingCapacity = resource ? getRemainingCapacityInKg(resource) : 0;
    const remainingCapacityAfterRaid =
      remainingCapacity -
      (raidSimulation?.raiderDamageTaken || 0) * configManager.getCapacityConfigKg(CapacityConfig.Army);
    return { beforeRaid: remainingCapacity, afterRaid: remainingCapacityAfterRaid };
  }, [raidSimulation]);

  const stealableResources = useMemo(() => {
    let capacityAfterRaid = remainingCapacity.afterRaid;
    const stealableResources: Array<{ resourceId: number; amount: number }> = [];

    // If no capacity, return empty array immediately
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
        return; // Exit the forEach loop if no more capacity
      }
    });
    return stealableResources;
  }, [targetResources, remainingCapacity]);

  const onRaid = async () => {
    if (!selectedHex) return;
    setShowRaidResult(true);
    await onExplorerVsStructureRaid();
    // Close modal after raid
    updateSelectedEntityId(null);
  };

  const onExplorerVsStructureRaid = async () => {
    if (!selectedHex || stealableResources.length === 0) return;
    const direction = getDirectionBetweenAdjacentHexes(selectedHex, { col: target.hex.x, row: target.hex.y });
    if (direction === null) return;

    // Convert resources to the format expected by the contract
    const resources = stealableResources
      .filter((r) => r.amount > 0)
      .map((r) => ({ ...r, amount: r.amount * RESOURCE_PRECISION }));
    const calldata = {
      explorer_id: attackerEntityId,
      structure_id: target?.id || 0,
      structure_direction: direction,
      steal_resources: resources,
    };

    try {
      setLoading(true);
      // Using the general provider approach since raid_explorer_vs_guard is not defined in systemCalls
      await raid_explorer_vs_guard({
        signer: account,
        ...calldata,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const buttonMessage = useMemo(() => {
    if (attackerArmyData?.troops.stamina.amount < combatConfig.stamina_attack_req)
      return `Not Enough Stamina (${combatConfig.stamina_attack_req} Required)`;
    if (!attackerArmyData) return "No Troops Present";
    if (target?.targetType !== TargetType.Structure) return "Only structures can be raided";
    if (stealableResources.length === 0) return "No resources raidable";
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

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 mx-auto max-w-full overflow-hidden">
      {/* Unable to Raid Message */}
      {target?.targetType !== TargetType.Structure ? (
        <div className="mt-2 p-6 border border-gold/20 rounded-lg backdrop-blur-sm panel-wood shadow-lg">
          <h3 className="text-2xl font-bold mb-6 text-gold border-b border-gold/20 pb-4 flex items-center">
            <span className="mr-2">⚠️</span> Unable to Raid
          </h3>
          <div className="text-center py-6 flex flex-col items-center">
            <div className="text-5xl mb-4">🛡️</div>
            <div className="text-xl font-bold text-red-400 mb-2">Target cannot be raided!</div>
            <p className="text-gold/80 mb-4 max-w-md mx-auto">
              You can only raid structures owned by other players that contain resources.
            </p>
          </div>
        </div>
      ) : (
        <>
          {showRaidResult ? (
            <div className="p-4 sm:p-6 border border-gold/20 rounded-lg backdrop-blur-sm panel-wood shadow-lg">
              <h3 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-gold border-b border-gold/20 pb-4 flex items-center">
                <span className="mr-2">⚔️</span> Raid in Progress
              </h3>
              <RaidResult
                raiderId={attackerEntityId}
                target={target}
                successRate={raidSimulation?.successChance || 50}
                stolenResources={stealableResources}
              />
            </div>
          ) : (
            <>
              {/* Biome Info Panel */}
              <BiomeInfoPanel biome={biome} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Attacker Panel */}
                <div className="flex flex-col gap-3 p-4 border border-gold/20 rounded-lg backdrop-blur-sm panel-wood">
                  <h4 className="text-xl font-semibold text-gold">Raider Forces (You)</h4>
                  {attackerArmyData && (
                    <div className="mt-4 space-y-4">
                      {/* Troop Information */}
                      <div className="p-4 border border-gold/10 rounded relative">
                        <div className="mt-2">
                          {formatTypeAndBonuses(
                            attackerArmyData.troops.category as TroopType,
                            attackerArmyData.troops.tier as TroopTier,
                            configManager.getBiomeCombatBonus(attackerArmyData.troops.category as TroopType, biome),
                            combatSimulator.calculateStaminaModifier(
                              Number(attackerArmyData.troops.stamina.amount),
                              true,
                            ),
                            true,
                            false, // Not compact for attacker (single entity)
                          )}

                          <div className="flex items-center gap-2 mt-3">
                            <div className="text-2xl font-bold text-gold">
                              {divideByPrecision(attackerArmyData.troops.count)} troops
                            </div>

                            {raidSimulation && (
                              <div className="text-order-giants font-bold text-lg">
                                ({-Math.floor(raidSimulation.raiderDamageTaken)} lost)
                              </div>
                            )}
                          </div>

                          <div className="mt-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-gold/70">Current Stamina:</span>
                              <div className="w-28 h-3 bg-brown-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${Number(attackerArmyData.troops.stamina.amount) >= combatConfig.stamina_attack_req ? "bg-green-600" : "bg-red-600"}`}
                                  style={{
                                    width: `${Math.min(100, (Number(attackerArmyData.troops.stamina.amount) / 100) * 100)}%`,
                                  }}
                                ></div>
                              </div>
                            </div>
                            <span
                              className={`text-sm font-medium ${Number(attackerArmyData.troops.stamina.amount) >= combatConfig.stamina_attack_req ? "text-green-400" : "text-red-400"}`}
                            >
                              {Number(attackerArmyData.troops.stamina.amount)} / {combatConfig.stamina_attack_req}{" "}
                              required
                            </span>
                          </div>

                          <div className="mt-3 flex items-center justify-between">
                            <span className="text-gold/70">Current Remaining Carrying Capacity:</span>
                            <span className="text-gold font-medium">{Number(remainingCapacity.beforeRaid)} kg</span>
                          </div>
                        </div>
                      </div>

                      {/* Raid Simulation Results */}
                      {raidSimulation && (
                        <div className="p-3 border border-gold/10 rounded bg-brown-900/50">
                          <h4 className="text-sm font-medium text-gold/90 mb-2">After Raid</h4>
                          <div className="flex items-center justify-between">
                            <span className="text-gold/70">Troops Remaining:</span>
                            <span className="text-lg font-bold text-gold">
                              {Math.floor(raidSimulation.attackerTroopsLeft)}
                              <span className="text-sm text-gold/60 ml-1">
                                (
                                {Math.floor(
                                  (raidSimulation.attackerTroopsLeft /
                                    divideByPrecision(attackerArmyData.troops.count)) *
                                    100,
                                )}
                                %)
                              </span>
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-gold/70">Stamina After Raid:</span>
                            <span
                              className={`text-lg font-bold ${raidSimulation.newAttackerStamina < 10 ? "text-red-400" : "text-gold"}`}
                            >
                              {raidSimulation.newAttackerStamina}{" "}
                              <span className="text-sm text-gold/60 ml-1">
                                (+ {combatConfig.stamina_attack_req} if success)
                              </span>
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Defender Panel */}
                <div className="flex flex-col gap-3 p-4 border border-gold/20 rounded-lg backdrop-blur-sm panel-wood">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xl font-semibold text-gold">Defender Forces</h4>
                    {target.info.length > 0 && (
                      <span className="bg-brown-800 text-gold px-2 py-1 rounded-md text-sm">
                        {target.info.length} {target.info.length === 1 ? "Guard" : "Guards"}
                      </span>
                    )}
                  </div>

                  {target.info.length > 0 ? (
                    <div className="mt-4 space-y-4">
                      {/* Guard Header - shows when multiple guards are present */}
                      {target.info.length > 1 && (
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <div className="col-span-2">
                            <div className="flex items-center justify-between border-b border-gold/20 pb-2">
                              <span className="text-gold/90 font-medium">Total Defender Troops: </span>
                              <span className="text-gold font-bold">
                                {target.info.reduce(
                                  (total, troop) => total + divideByPrecision(Number(troop.count)),
                                  0,
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Grid layout when there are multiple guards */}
                      <div className={`grid ${target.info.length > 2 ? "grid-cols-2" : "grid-cols-1"} gap-2`}>
                        {/* Troop Information */}
                        {target.info.map((troops, index) => (
                          <div
                            key={index}
                            className={`${target.info.length > 2 ? "p-2" : "p-3"} border border-gold/10 rounded relative`}
                          >
                            {target.info.length > 1 && (
                              <div className="absolute top-0 right-0 bg-brown-800 text-gold px-2 py-0.5 text-xs rounded-bl-md rounded-tr-md">
                                #{index + 1}
                              </div>
                            )}

                            <div className={`${target.info.length > 2 ? "mt-1" : "mt-2"}`}>
                              {formatTypeAndBonuses(
                                troops.category as TroopType,
                                troops.tier as TroopTier,
                                configManager.getBiomeCombatBonus(troops.category as TroopType, biome),
                                combatSimulator.calculateStaminaModifier(Number(troops.stamina.amount || 0), false),
                                false,
                                target.info.length > 2, // Use compact layout when there are more than 2 guards
                              )}
                              <div
                                className={`flex justify-between items-center ${target.info.length > 2 ? "mt-1 text-sm" : "mt-2"}`}
                              >
                                <span
                                  className={`${target.info.length > 2 ? "text-base" : "text-lg"} font-bold text-gold`}
                                >
                                  {divideByPrecision(Number(troops.count))} troops
                                </span>
                                {raidSimulation && (
                                  <span className="text-order-giants font-bold">
                                    -{raidSimulation.damageTakenPerDefender[index]}
                                  </span>
                                )}
                              </div>
                              <div className={`${target.info.length > 2 ? "text-xs" : "text-sm"} text-gold/80 mt-0.5`}>
                                Current Stamina: {Number(troops.stamina.amount || 0)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Raid Simulation Results */}
                      {raidSimulation && (
                        <div className="p-3 border border-gold/10 rounded bg-brown-900/50">
                          <h4 className="text-sm font-medium text-gold/90 mb-2">Combined Losses</h4>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="text-xl font-bold text-order-giants bg-order-giants/10 rounded-md px-2 py-1">
                                {-Math.floor(raidSimulation.defenderDamageTaken)}
                              </div>
                              <div className="uppercase text-xs text-red-400">total troops lost</div>
                            </div>
                            <div className="text-sm text-gold/70">
                              (
                              {Math.floor(
                                (raidSimulation.defenderDamageTaken / raidSimulation.totalDefenderTroops) * 100,
                              )}
                              %)
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-4 space-y-4">
                      <div className="p-3 border border-gold/10 rounded bg-dark-brown/50">
                        <h4 className="text-sm font-medium text-gold/90 mb-2">
                          {target?.targetType === TargetType.Structure ? "No Troops Present" : "Not a Structure"}
                        </h4>
                        {target?.targetType === TargetType.Structure && (
                          <div className="text-green-400 text-sm">Easy to raid! No defenders present.</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Raid Results Panel */}
              {target?.targetType === TargetType.Structure && (
                <div className="mt-2 p-4 sm:p-6 border border-gold/20 rounded-lg backdrop-blur-sm panel-wood shadow-lg overflow-hidden">
                  <h3 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-gold border-b border-gold/20 pb-4 flex items-center">
                    <span className="mr-2">📜</span> Raid Prediction
                  </h3>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      {/* Raid Outcome Section */}
                      <div className="p-4 border border-gold/10 rounded mb-6 bg-brown-900/30">
                        <h4 className="text-lg font-medium text-gold/90 mb-4 flex items-center">
                          <span className="mr-2">⚔️</span> Battle Outcome
                        </h4>

                        {/* Success Chance Meter */}
                        <div className="mb-4">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-gold/70">Success Chance:</span>
                            <span
                              className={`text-lg font-bold ${
                                raidSimulation?.successChance && raidSimulation.successChance >= 80
                                  ? "text-green-400"
                                  : raidSimulation?.successChance && raidSimulation.successChance >= 50
                                    ? "text-yellow-400"
                                    : "text-red-400"
                              }`}
                            >
                              {raidSimulation?.successChance.toFixed(2)}%
                            </span>
                          </div>
                          <div className="w-full h-4 bg-brown-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                raidSimulation?.successChance && raidSimulation.successChance >= 80
                                  ? "bg-green-600"
                                  : raidSimulation?.successChance && raidSimulation.successChance >= 50
                                    ? "bg-yellow-600"
                                    : "bg-red-600"
                              }`}
                              style={{ width: `${raidSimulation?.successChance || 0}%` }}
                            ></div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-3">
                          <div className="flex justify-between items-center">
                            <span className="text-gold/70">Outcome Type:</span>
                            <span
                              className={`text-base font-medium px-2 py-1 rounded ${
                                raidSimulation?.outcomeType === RaidOutcome.Success
                                  ? "bg-green-900/50 text-green-400 border border-green-700/50"
                                  : raidSimulation?.outcomeType === RaidOutcome.Failure
                                    ? "bg-red-900/50 text-red-400 border border-red-700/50"
                                    : "bg-yellow-900/50 text-yellow-400 border border-yellow-700/50"
                              }`}
                            >
                              {raidSimulation?.outcomeType === RaidOutcome.Success
                                ? "Guaranteed Success"
                                : raidSimulation?.outcomeType === RaidOutcome.Failure
                                  ? "Guaranteed Failure"
                                  : "Chance-based"}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gold/70">Stamina Cost:</span>
                            <span className="text-base font-bold text-gold">
                              {Number(attackerArmyData.troops.stamina.amount) -
                                (raidSimulation?.newAttackerStamina || 0)}
                              <span className="text-sm text-gold/60 ml-1">
                                (- {combatConfig.stamina_attack_req} if success)
                              </span>
                            </span>
                          </div>
                        </div>

                        {/* Battle Stats Summary */}
                        <div className="grid grid-cols-2 gap-3 mt-6">
                          <div className="p-2 border border-gold/20 rounded-md bg-brown-900/50 text-center">
                            <div className="text-xs text-gold/70 mb-1">Your Casualties</div>
                            <div className="text-lg font-bold text-order-giants">
                              {raidSimulation ? Math.floor(raidSimulation.raiderDamageTaken) : 0}
                              <span className="text-xs ml-1">
                                (
                                {raidSimulation && attackerArmyData && attackerArmyData.troops.count
                                  ? Math.floor(
                                      (raidSimulation.raiderDamageTaken /
                                        divideByPrecision(attackerArmyData.troops.count)) *
                                        100,
                                    )
                                  : 0}
                                %)
                              </span>
                            </div>
                          </div>
                          <div className="p-2 border border-gold/20 rounded-md bg-brown-900/50 text-center">
                            <div className="text-xs text-gold/70 mb-1">Defender Casualties</div>
                            <div className="text-lg font-bold text-order-giants">
                              {raidSimulation ? Math.floor(raidSimulation.defenderDamageTaken) : 0}
                              <span className="text-xs ml-1">
                                (
                                {raidSimulation && raidSimulation.totalDefenderTroops
                                  ? Math.floor(
                                      (raidSimulation.defenderDamageTaken / raidSimulation.totalDefenderTroops) * 100,
                                    )
                                  : 0}
                                %)
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      {/* Resource Selection Section */}
                      <div className="p-4 border border-gold/10 rounded mb-6 bg-brown-900/30">
                        <h4 className="text-lg font-medium text-gold/90 mb-4 flex items-center">
                          <span className="mr-2">💰</span> Potential Loot
                        </h4>

                        <div className="flex justify-between items-center text-base font-medium text-gold border-b border-gold/20 pb-2 mb-3">
                          <span className="">Remaining Carrying Capacity After Raid:</span>
                          <span className="">{Number(remainingCapacity.afterRaid)} kg</span>
                        </div>

                        {stealableResources.length > 0 ? (
                          <div className="max-h-64 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gold/40 scrollbar-track-brown-900/30">
                            <div className="space-y-3">
                              {stealableResources.map((resource) => (
                                <div
                                  key={resource.resourceId}
                                  className="flex justify-between items-center p-2 border border-gold/10 rounded-md bg-brown-900/20"
                                >
                                  <div className="flex items-center gap-2">
                                    <ResourceIcon
                                      resource={resources.find((r) => r.id === resource.resourceId)?.trait || ""}
                                      size="md"
                                    />
                                    <span className="text-gold/80">
                                      {resources.find((r) => r.id === resource.resourceId)?.trait || ""}
                                    </span>
                                  </div>
                                  <span className="text-lg font-bold text-gold">
                                    {formatStringNumber(resource.amount, 0)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-8 text-gold/60 flex flex-col items-center">
                            <span className="text-3xl mb-2">🚫</span>
                            <p>No resources available to raid in this structure.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Raid Button */}
              <div className="mt-4 flex flex-col items-center">
                <Button
                  variant="primary"
                  className={`px-8 py-3 rounded-lg font-bold text-lg transition-colors ${!canRaid ? "opacity-70" : "hover:bg-yellow-600"}`}
                  isLoading={loading}
                  disabled={!canRaid}
                  onClick={onRaid}
                >
                  {buttonMessage}
                </Button>

                {/* Additional feedback based on raid conditions */}
                {!canRaid && (
                  <div className="mt-2 text-sm text-gold/60 flex items-center gap-2">
                    {attackerArmyData?.troops.stamina.amount < combatConfig.stamina_attack_req && (
                      <span className="flex items-center gap-1">
                        <span>⚡</span> Wait for stamina to recharge ({combatConfig.stamina_attack_req} required)
                      </span>
                    )}
                    {!attackerArmyData && (
                      <span className="flex items-center gap-1">
                        <span>⚔️</span> You need troops to raid
                      </span>
                    )}
                    {stealableResources.length === 0 && target?.targetType === TargetType.Structure && (
                      <span className="flex items-center gap-1">
                        <span>💰</span> This structure has no resources to raid
                      </span>
                    )}
                    {(raidSimulation?.successChance ?? 0) === 0 && (
                      <span className="flex items-center gap-1">
                        <span>❌</span> Your chance of success is 0
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Help Text */}
              <div className="text-xs text-gold/50 text-center mt-2 max-w-lg mx-auto">
                Raids allow you to steal resources from enemy structures. Success chance depends on your troops, terrain
                advantages, and defender forces.
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};
