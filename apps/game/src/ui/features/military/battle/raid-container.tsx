import { usePlayerNames } from "@/hooks/use-player-profile";
import { useStoredBiome } from "@/hooks/helpers/use-tile-at";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { HudButton, HudChip, HudMeter, HudPanel } from "@/ui/design-system/kit/hud-elements";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { isStaminaRecharging, STAMINA_RECHARGING_TEXT_CLASS } from "@/ui/shared/lib/stamina-visuals";
import { BiomeInfoPanel } from "@/ui/features";
import {
  CombatSimulator,
  configManager,
  divideByPrecision,
  getArmy,
  getEntityIdFromKeys,
  getRemainingCapacityInKg,
  RaidSimulator,
  StaminaManager,
} from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRow, useNativeRevision } from "@/hooks/helpers/use-native-facts";
import {
  BiomeType,
  CapacityConfig,
  ContractAddress,
  getDirectionBetweenAdjacentHexes,
  ID,
  RelicEffect,
  RESOURCE_PRECISION,
  ResourcesIds,
  TroopTier,
  TroopType,
  formatCharge,
  formatCount,
  formatPercent,
  resourceName,
  resources,
  formatExact,
} from "@bibliothecadao/types";
import { useMemo, useState } from "react";
import { ActiveRelicEffects } from "../../world/components/entities/active-relic-effects";
import { AttackTarget, TargetType } from "./types";
import { formatTypeAndBonuses } from "./combat-utils";
import { RaidResult } from "./raid-result";
import { toast } from "@/ui/features/event-feed/notify";

enum RaidOutcome {
  Success = "Success",
  Failure = "Failure",
  Chance = "Chance",
}

export const RaidContainer = ({
  attackerEntityId,
  target,
  targetResources,
  attackerActiveRelicEffects = [],
  targetActiveRelicEffects = [],
}: {
  attackerEntityId: ID;
  target: AttackTarget;
  targetResources: Array<{ resourceId: number; amount: number }>;
  attackerActiveRelicEffects: RelicEffect[];
  targetActiveRelicEffects: RelicEffect[];
}) => {
  const {
    account: { account },
    setup: {
      systemCalls: { raid_explorer_vs_guard },
      store,
    },
  } = useGame();
  const revision = useNativeRevision(["ExplorerTroops", "Structure", "TileOccupancy"]);
  const resourceWeight = useNativeRow("ResourceWeight", {
    game_id: configManager.getActiveGameId(),
    entity_id: attackerEntityId,
  });

  const [loading, setLoading] = useState(false);
  const [showRaidResult, setShowRaidResult] = useState(false);
  const [raidTransactionHash, setRaidTransactionHash] = useState<string | null>(null);

  const selectedHex = useUIStore((state) => state.selectedHex);
  const timestamp = useCurrentDefaultTick();
  const targetTroops = useMemo(
    () =>
      target.info.map((troops) => ({
        ...troops,
        stamina: StaminaManager.getStamina(troops, timestamp),
      })),
    [target.info, timestamp],
  );

  const combatConfig = useMemo(() => {
    return configManager.getCombatConfig();
  }, []);

  const biome = useStoredBiome(target.hex.x, target.hex.y) ?? BiomeType.None;

  // Get the current army states for display
  const names = usePlayerNames();
  const attackerArmyData = useMemo(() => {
    const army = getArmy(attackerEntityId, ContractAddress(account.address), store, names.text);
    // An army this client cannot see raids nothing: no simulation runs on a phantom attacker.
    if (!army) return null;

    return {
      capacity: army.totalCapacity,
      troops: {
        count: Number(army.troops.count),
        category: army.troops.category as TroopType,
        tier: army.troops.tier as TroopTier,
        stamina: StaminaManager.getStamina(army.troops, timestamp),
        battle_cooldown_end: army.troops.battle_cooldown_end,
      },
    };
  }, [account.address, attackerEntityId, store, timestamp, revision, names]);
  const attackerRecharging =
    attackerArmyData !== null &&
    isStaminaRecharging(Number(attackerArmyData.troops.stamina.amount), combatConfig.stamina_attack_req);

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
      battle_cooldown_end: attackerArmyData.troops.battle_cooldown_end,
    };

    // Convert all defender troops into simulator armies
    const defenders = targetTroops.map((troop) => ({
      entity_id: target.id,
      stamina: Number(troop.stamina.amount),
      troopCount: divideByPrecision(Number(troop.count)),
      troopType: troop.category as TroopType,
      tier: troop.tier as TroopTier,
      battle_cooldown_end: troop.battle_cooldown_end,
    }));

    // Use the raid simulator to predict the outcome
    // Convert attacker relic effects to resource IDs for RaidSimulator
    const attackerRelicResourceIds = attackerActiveRelicEffects.map((effect) => Number(effect.id)) as ResourcesIds[];

    // For defenders, we aggregate all target relic effects
    const targetRelicResourceIds = targetActiveRelicEffects.map((effect) => Number(effect.id)) as ResourcesIds[];

    const result = raidSimulator.simulateRaid(
      attackerArmy,
      defenders,
      biome,
      attackerRelicResourceIds,
      targetRelicResourceIds,
    );

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
      newDefendersStamina: defenders.map((troop) => troop.stamina - result.defenderDamageTaken),
      totalDefenderTroops,
    };
  }, [
    attackerEntityId,
    target,
    targetTroops,
    attackerArmyData,
    biome,
    combatConfig,
    raidSimulator,
    attackerActiveRelicEffects,
    targetActiveRelicEffects,
  ]);

  const remainingCapacity = useMemo(() => {
    const remainingCapacity = resourceWeight ? getRemainingCapacityInKg(resourceWeight) : 0;
    const remainingCapacityAfterRaid =
      remainingCapacity -
      (raidSimulation?.raiderDamageTaken || 0) * configManager.getCapacityConfigKg(CapacityConfig.Army);
    return { beforeRaid: remainingCapacity, afterRaid: remainingCapacityAfterRaid };
  }, [resourceWeight, raidSimulation]);

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
      structure_id: target.id,
      structure_direction: direction,
      steal_resources: resources,
    };

    try {
      setLoading(true);
      // Using the general provider approach since raid_explorer_vs_guard is not defined in systemCalls
      const result = await raid_explorer_vs_guard({
        signer: account,
        ...calldata,
      });
      if (!("transaction_hash" in result)) throw new Error("Raid receipt has no transaction hash");
      setRaidTransactionHash(result.transaction_hash);
    } catch (error) {
      toast.failed(error, "The raid failed.");
      setShowRaidResult(false);
    } finally {
      setLoading(false);
    }
  };

  const buttonMessage = useMemo(() => {
    if (!attackerArmyData) return "No Troops Present";
    if (attackerArmyData.troops.stamina.amount < combatConfig.stamina_attack_req)
      return `Not Enough Stamina (${combatConfig.stamina_attack_req} Required)`;
    if (target?.targetType !== TargetType.Structure) return "Only structures can be raided";
    if (stealableResources.length === 0) return "No resources raidable";
    return "Raid!";
  }, [attackerArmyData, combatConfig, target, stealableResources]);

  const canRaid = useMemo(() => {
    return (
      attackerArmyData !== null &&
      attackerArmyData.troops.stamina.amount >= combatConfig.stamina_attack_req &&
      target?.targetType === TargetType.Structure &&
      stealableResources.some((r) => r.resourceId > 0 && r.amount > 0) &&
      (raidSimulation?.successChance ?? 0) > 0
    );
  }, [attackerArmyData, combatConfig, target, stealableResources, raidSimulation?.successChance]);

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 mx-auto max-w-full overflow-hidden">
      {/* Unable to Raid Message */}
      {target?.targetType !== TargetType.Structure ? (
        <HudPanel>
          <div className="mt-2 overflow-hidden">
            <h3 className="text-hud-display mb-6 text-hud-accent border-b border-hud-line pb-4 flex items-center">
              <span className="mr-2">⚠️</span> Unable to Raid
            </h3>
            <div className="text-center py-6 flex flex-col items-center">
              <div className="text-hud-display mb-4">🛡️</div>
              <div className="text-hud-display text-hud-bad mb-2">Target cannot be raided!</div>
              <p className="text-hud-accent mb-4 max-w-md mx-auto">
                You can only raid structures owned by other players that contain resources.
              </p>
            </div>
          </div>
        </HudPanel>
      ) : (
        <>
          {showRaidResult ? (
            <HudPanel>
              <div>
                <h3 className="text-hud-display sm:text-hud-display mb-4 sm:mb-6 text-hud-accent border-b border-hud-line pb-4 flex items-center">
                  <span className="mr-2">⚔️</span> Raid in Progress
                </h3>
                <RaidResult
                  transactionHash={raidTransactionHash}
                  raiderId={attackerEntityId}
                  target={target}
                  successRate={raidSimulation?.successChance || 50}
                  stolenResources={stealableResources}
                />
              </div>
            </HudPanel>
          ) : (
            <>
              {/* Biome Info Panel */}
              <BiomeInfoPanel biome={biome} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Attacker Panel */}
                <HudPanel>
                  <div className="flex flex-col gap-3">
                    <h4 className="text-hud-display text-hud-accent">Raider Forces (You)</h4>
                    {attackerArmyData && (
                      <div className="mt-4 space-y-4">
                        {/* Troop Information */}
                        <div className="p-4 border border-hud-divider rounded relative">
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
                              <div className="text-hud-display text-hud-accent">
                                {divideByPrecision(attackerArmyData.troops.count)} troops
                              </div>

                              {raidSimulation && (
                                <div className="text-hud-bad text-hud-title">
                                  ({-Math.floor(raidSimulation.raiderDamageTaken)} lost)
                                </div>
                              )}
                            </div>

                            <div className="mt-3 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span
                                  className={cn("text-hud-muted", attackerRecharging && STAMINA_RECHARGING_TEXT_CLASS)}
                                >
                                  Current Stamina:
                                </span>
                                <span className="w-28">
                                  <HudMeter
                                    share={Math.min(1, Number(attackerArmyData.troops.stamina.amount) / 100)}
                                    tone={
                                      Number(attackerArmyData.troops.stamina.amount) >= combatConfig.stamina_attack_req
                                        ? "good"
                                        : "bad"
                                    }
                                    label="Stamina"
                                    filling={attackerRecharging}
                                  />
                                </span>
                              </div>
                              <span
                                className={cn(
                                  "text-hud-body",
                                  Number(attackerArmyData.troops.stamina.amount) >= combatConfig.stamina_attack_req
                                    ? "text-hud-good"
                                    : "text-hud-bad",
                                  attackerRecharging && STAMINA_RECHARGING_TEXT_CLASS,
                                )}
                              >
                                {Number(attackerArmyData.troops.stamina.amount)} / {combatConfig.stamina_attack_req}{" "}
                                required
                              </span>
                            </div>

                            <div className="mt-3 flex items-center justify-between">
                              <span className="text-hud-muted">Current Remaining Carrying Capacity:</span>
                              <span className="text-hud-accent">{Number(remainingCapacity.beforeRaid)} kg</span>
                            </div>
                          </div>

                          {/* Active Relic Effects */}
                          <ActiveRelicEffects relicEffects={attackerActiveRelicEffects} entityId={attackerEntityId} />
                        </div>

                        {/* Raid Simulation Results */}
                        {raidSimulation && (
                          <div className="p-3 border border-hud-divider rounded bg-hud-well">
                            <h4 className="text-hud-body text-hud-accent mb-2">After Raid</h4>
                            <div className="flex items-center justify-between">
                              <span className="text-hud-muted">Troops Remaining:</span>
                              <span className="text-hud-title text-hud-accent">
                                {Math.floor(raidSimulation.attackerTroopsLeft)}
                                <span className="text-hud-body text-hud-muted ml-1">
                                  (
                                  {formatPercent(
                                    raidSimulation.attackerTroopsLeft /
                                      divideByPrecision(attackerArmyData.troops.count),
                                  )}
                                  )
                                </span>
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-hud-muted">Stamina After Raid:</span>
                              <span
                                className={`text-hud-title ${raidSimulation.newAttackerStamina < 10 ? "text-hud-bad" : "text-hud-accent"}`}
                              >
                                {raidSimulation.newAttackerStamina}{" "}
                                <span className="text-hud-body text-hud-muted ml-1">
                                  (+ {combatConfig.stamina_attack_req} if success)
                                </span>
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </HudPanel>

                {/* Defender Panel */}
                <HudPanel>
                  <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <h4 className="text-hud-display text-hud-accent">Defender Forces</h4>
                      {targetTroops.length > 0 && (
                        <span className="bg-hud-well text-hud-accent px-2 py-1 rounded-md text-hud-body">
                          {formatCount(targetTroops.length, "Guard")}
                        </span>
                      )}
                    </div>

                    {targetTroops.length > 0 ? (
                      <div className="mt-4 space-y-4">
                        {/* Guard Header - shows when multiple guards are present */}
                        {targetTroops.length > 1 && (
                          <div className="grid grid-cols-2 gap-2 mb-2">
                            <div className="col-span-2">
                              <div className="flex items-center justify-between border-b border-hud-line pb-2">
                                <span className="text-hud-accent">Total Defender Troops: </span>
                                <span className="text-hud-accent text-hud-strong">
                                  {targetTroops.reduce(
                                    (total, troop) => total + divideByPrecision(Number(troop.count)),
                                    0,
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Grid layout when there are multiple guards */}
                        <div className={`grid ${targetTroops.length > 2 ? "grid-cols-2" : "grid-cols-1"} gap-2`}>
                          {/* Troop Information */}
                          {targetTroops.map((troops, index) => (
                            <div
                              key={index}
                              className={`${targetTroops.length > 2 ? "p-2" : "p-3"} border border-hud-divider rounded relative`}
                            >
                              {targetTroops.length > 1 && (
                                <div className="absolute top-0 right-0 bg-hud-well text-hud-accent px-2 py-0.5 text-hud-label rounded-bl-md rounded-tr-md">
                                  #{index + 1}
                                </div>
                              )}

                              <div className={`${targetTroops.length > 2 ? "mt-1" : "mt-2"}`}>
                                {formatTypeAndBonuses(
                                  troops.category as TroopType,
                                  troops.tier as TroopTier,
                                  configManager.getBiomeCombatBonus(troops.category as TroopType, biome),
                                  combatSimulator.calculateStaminaModifier(Number(troops.stamina.amount || 0), false),
                                  false,
                                  targetTroops.length > 2, // Use compact layout when there are more than 2 guards
                                )}
                                <div
                                  className={`flex justify-between items-center ${targetTroops.length > 2 ? "mt-1 text-hud-body" : "mt-2"}`}
                                >
                                  <span
                                    className={`${targetTroops.length > 2 ? "text-hud-body" : "text-hud-title"} text-hud-strong text-hud-accent`}
                                  >
                                    {divideByPrecision(Number(troops.count))} troops
                                  </span>
                                  {raidSimulation && (
                                    <span className="text-hud-bad text-hud-strong">
                                      -{raidSimulation.damageTakenPerDefender[index]}
                                    </span>
                                  )}
                                </div>
                                <div
                                  className={`${targetTroops.length > 2 ? "text-hud-label" : "text-hud-body"} text-hud-accent mt-0.5`}
                                >
                                  Current Stamina: {Number(troops.stamina.amount || 0)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Active Relic Effects for Defenders */}
                        <ActiveRelicEffects relicEffects={targetActiveRelicEffects} entityId={target.id} />

                        {/* Raid Simulation Results */}
                        {raidSimulation && (
                          <div className="p-3 border border-hud-divider rounded bg-hud-well">
                            <h4 className="text-hud-body text-hud-accent mb-2">Combined Losses</h4>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="text-hud-display text-hud-bad rounded-md px-2 py-1">
                                  {-Math.floor(raidSimulation.defenderDamageTaken)}
                                </div>
                                <div className="uppercase text-hud-label text-hud-bad">Total troops lost</div>
                              </div>
                              <div className="text-hud-body text-hud-muted">
                                (
                                {formatPercent(raidSimulation.defenderDamageTaken / raidSimulation.totalDefenderTroops)}
                                )
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-4 space-y-4">
                        <div className="p-3 border border-hud-divider rounded bg-hud-well">
                          <h4 className="text-hud-body text-hud-accent mb-2">
                            {target?.targetType === TargetType.Structure ? "No Troops Present" : "Not a Structure"}
                          </h4>
                          {target?.targetType === TargetType.Structure && (
                            <div className="text-hud-good text-hud-body">Easy to raid! No defenders present.</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </HudPanel>
              </div>

              {/* Raid Results Panel */}
              {target?.targetType === TargetType.Structure && raidSimulation && attackerArmyData && (
                <HudPanel>
                  <div className="mt-2 overflow-hidden">
                    <h3 className="text-hud-display sm:text-hud-display mb-4 sm:mb-6 text-hud-accent border-b border-hud-line pb-4 flex items-center">
                      <span className="mr-2">📜</span> Raid Prediction
                    </h3>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        {/* Raid Outcome Section */}
                        <div className="p-4 border border-hud-divider rounded mb-6 bg-hud-well">
                          <h4 className="text-hud-title text-hud-accent mb-4 flex items-center">
                            <span className="mr-2">⚔️</span> Battle Outcome
                          </h4>

                          {/* Success Chance Meter */}
                          <div className="mb-4">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-hud-muted">Success Chance:</span>
                              <span
                                className={`text-hud-title ${
                                  raidSimulation?.successChance && raidSimulation.successChance >= 80
                                    ? "text-hud-good"
                                    : raidSimulation?.successChance && raidSimulation.successChance >= 50
                                      ? "text-hud-warn"
                                      : "text-hud-bad"
                                }`}
                              >
                                {formatPercent(raidSimulation ? raidSimulation.successChance / 100 : undefined)}
                              </span>
                            </div>
                            <HudMeter
                              share={(raidSimulation?.successChance || 0) / 100}
                              tone={
                                raidSimulation?.successChance && raidSimulation.successChance >= 80
                                  ? "good"
                                  : raidSimulation?.successChance && raidSimulation.successChance >= 50
                                    ? "warn"
                                    : "bad"
                              }
                              label="Success chance"
                            />
                          </div>

                          <div className="flex flex-col gap-3">
                            <div className="flex justify-between items-center">
                              <span className="text-hud-muted">Outcome Type:</span>
                              <HudChip
                                tone={
                                  raidSimulation?.outcomeType === RaidOutcome.Success
                                    ? "good"
                                    : raidSimulation?.outcomeType === RaidOutcome.Failure
                                      ? "bad"
                                      : "warn"
                                }
                              >
                                {raidSimulation?.outcomeType === RaidOutcome.Success
                                  ? "Guaranteed Success"
                                  : raidSimulation?.outcomeType === RaidOutcome.Failure
                                    ? "Guaranteed Failure"
                                    : "Chance-based"}
                              </HudChip>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-hud-muted">Stamina Cost:</span>
                              <span className="text-hud-strong text-hud-accent">
                                {Number(attackerArmyData.troops.stamina.amount) -
                                  (raidSimulation?.newAttackerStamina || 0)}
                                <span className="text-hud-body text-hud-muted ml-1">
                                  (- {combatConfig.stamina_attack_req} if success)
                                </span>
                              </span>
                            </div>
                          </div>

                          {/* Battle Stats Summary */}
                          <div className="grid grid-cols-2 gap-3 mt-6">
                            <div className="p-2 border border-hud-line rounded-md bg-hud-well text-center">
                              <div className="text-hud-label text-hud-muted mb-1">Your Casualties</div>
                              <div className="text-hud-title text-hud-bad">
                                {raidSimulation ? Math.floor(raidSimulation.raiderDamageTaken) : 0}
                                <span className="text-hud-label ml-1">
                                  (
                                  {formatPercent(
                                    raidSimulation && attackerArmyData && attackerArmyData.troops.count
                                      ? raidSimulation.raiderDamageTaken /
                                          divideByPrecision(attackerArmyData.troops.count)
                                      : 0,
                                  )}
                                  )
                                </span>
                              </div>
                            </div>
                            <div className="p-2 border border-hud-line rounded-md bg-hud-well text-center">
                              <div className="text-hud-label text-hud-muted mb-1">Defender Casualties</div>
                              <div className="text-hud-title text-hud-bad">
                                {raidSimulation ? Math.floor(raidSimulation.defenderDamageTaken) : 0}
                                <span className="text-hud-label ml-1">
                                  (
                                  {formatPercent(
                                    raidSimulation && raidSimulation.totalDefenderTroops
                                      ? raidSimulation.defenderDamageTaken / raidSimulation.totalDefenderTroops
                                      : 0,
                                  )}
                                  )
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        {/* Resource Selection Section */}
                        <div className="p-4 border border-hud-divider rounded mb-6 bg-hud-well">
                          <h4 className="text-hud-title text-hud-accent mb-4 flex items-center">
                            <span className="mr-2">💰</span> Potential Loot
                          </h4>

                          <div className="flex justify-between items-center text-hud-body text-hud-accent border-b border-hud-line pb-2 mb-3">
                            <span className="">Remaining Carrying Capacity After Raid:</span>
                            <span className="">{Number(remainingCapacity.afterRaid)} kg</span>
                          </div>

                          {stealableResources.length > 0 ? (
                            <div className="max-h-64 overflow-y-auto pr-1">
                              <div className="space-y-3">
                                {stealableResources.map((resource) => (
                                  <div
                                    key={resource.resourceId}
                                    className="flex justify-between items-center p-2 border border-hud-divider rounded-md bg-hud-well"
                                  >
                                    <div className="flex items-center gap-2">
                                      <ResourceIcon resource={resource.resourceId} size="md" />
                                      <span className="text-hud-accent">{resourceName(resource.resourceId)}</span>
                                    </div>
                                    <span className="text-hud-title text-hud-accent">
                                      {formatExact(resource.amount)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-8 text-hud-muted flex flex-col items-center">
                              <span className="text-hud-display mb-2">🚫</span>
                              <p>No resources available to raid in this structure.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </HudPanel>
              )}

              {/* Raid Button */}
              <div className="mt-4 flex flex-col items-center">
                <HudButton kind="primary" disabled={!canRaid || loading} aria-busy={loading} onClick={onRaid}>
                  {loading ? "Raiding…" : buttonMessage}
                </HudButton>

                {/* Additional feedback based on raid conditions */}
                {!canRaid && (
                  <div className="mt-2 text-hud-body text-hud-muted flex items-center gap-2">
                    {attackerArmyData && attackerArmyData.troops.stamina.amount < combatConfig.stamina_attack_req && (
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
              <div className="text-hud-label text-hud-cue text-center mt-2 max-w-lg mx-auto">
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
