import { useUIStore } from "@/hooks/store/use-ui-store";
import Button from "@/ui/elements/button";
import { SelectResource } from "@/ui/elements/select-resource";
import { currencyFormat } from "@/ui/utils/utils";
import { getBlockTimestamp } from "@/utils/timestamp";
import {
  Biome,
  CombatSimulator,
  configManager,
  ContractAddress,
  divideByPrecision,
  getArmy,
  getDirectionBetweenAdjacentHexes,
  getEntityIdFromKeys,
  getGuardsByStructure,
  ID,
  RESOURCE_PRECISION,
  ResourceManager,
  ResourcesIds,
  StaminaManager,
  StructureType,
  TroopTier,
  TroopType,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { getComponentValue } from "@dojoengine/recs";
import { useMemo, useState } from "react";
import { formatBiomeBonus, formatTypeAndBonuses } from "./combat-utils";

// Mock RaidOutcome enum and RaidSimulator interface until properly implemented
enum RaidOutcome {
  Success = "Success",
  Failure = "Failure",
  Chance = "Chance",
}

interface RaidResult {
  isSuccessful: boolean;
  raiderDamageTaken: number;
  defenderDamageTaken: number;
  outcomeType: RaidOutcome;
  successChance: number;
}

// Simple implementation to simulate raid outcomes
class MockRaidSimulator {
  constructor(private params: any) {}

  getBiomeBonus(troopType: TroopType, biome: string): number {
    return 1.0; // Default bonus
  }

  calculateStaminaModifier(stamina: number, isAttacker: boolean): number {
    return 1.0; // Default modifier
  }

  simulateRaid(attacker: any, defenders: any[], biome: string, damageMultiplier: number): RaidResult {
    // Simple simulation logic - to be replaced with actual implementation
    const hasDefenders = defenders.length > 0 && defenders[0].troopCount > 0;
    const attackerStrength = attacker.troopCount * 100;
    let defenderStrength = 0;

    if (hasDefenders) {
      defenderStrength = defenders[0].troopCount * 80;
    }

    const successChance = hasDefenders
      ? Math.min(100, Math.max(0, (attackerStrength / (defenderStrength + 1)) * 50))
      : 100;

    const isSuccessful = Math.random() * 100 < successChance;

    let outcomeType = RaidOutcome.Chance;
    if (successChance >= 95) outcomeType = RaidOutcome.Success;
    if (successChance <= 5) outcomeType = RaidOutcome.Failure;

    // Calculate damage
    const raiderDamageTaken = hasDefenders ? Math.round(defenderStrength * 0.1 * RESOURCE_PRECISION) : 0;

    const defenderDamageTaken = hasDefenders ? Math.round(attackerStrength * 0.1 * RESOURCE_PRECISION) : 0;

    return {
      isSuccessful,
      raiderDamageTaken,
      defenderDamageTaken,
      outcomeType,
      successChance,
    };
  }
}

enum TargetType {
  Village,
  Structure,
  Army,
}

enum AttackerType {
  Structure,
  Army,
}

export const RaidContainer = ({
  attackerEntityId,
  targetHex,
}: {
  attackerEntityId: ID;
  targetHex: { x: number; y: number };
}) => {
  const {
    account: { account },
    setup: {
      systemCalls,
      components,
      components: { Structure, ExplorerTroops, Tile },
    },
  } = useDojo();

  const [loading, setLoading] = useState(false);
  const [selectedResources, setSelectedResources] = useState<Array<{ resourceId: number; amount: number }>>([
    { resourceId: 0, amount: 0 },
  ]);

  const updateSelectedEntityId = useUIStore((state) => state.updateEntityActionSelectedEntityId);
  const toggleModal = useUIStore((state) => state.toggleModal);
  const selectedHex = useUIStore((state) => state.selectedHex);

  const targetEntity = getComponentValue(Tile, getEntityIdFromKeys([BigInt(targetHex.x), BigInt(targetHex.y)]));

  const combatConfig = useMemo(() => {
    return configManager.getCombatConfig();
  }, []);

  const biome = useMemo(() => {
    return Biome.getBiome(targetHex.x, targetHex.y);
  }, [targetHex]);

  // Only explorers can raid
  const attackerType = AttackerType.Army;

  const attackerStamina = useMemo(() => {
    return new StaminaManager(components, attackerEntityId).getStamina(getBlockTimestamp().currentArmiesTick).amount;
  }, [attackerEntityId, components]);

  const target = useMemo(() => {
    const occupierId = getEntityIdFromKeys([BigInt(targetEntity?.occupier_id || 0n)]);
    const structure = getComponentValue(Structure, occupierId);
    const explorer = getComponentValue(ExplorerTroops, occupierId);

    if (structure) {
      return {
        info: getGuardsByStructure(structure).filter((guard) => guard.troops.count > 0n)[0]?.troops,
        id: targetEntity?.occupier_id,
        targetType: TargetType.Structure,
        structureCategory: structure.category,
        structure,
      };
    }

    if (explorer) {
      return {
        info: getArmy(occupierId, ContractAddress(account.address), components)?.troops,
        id: targetEntity?.occupier_id,
        targetType: TargetType.Army,
        structureCategory: null,
      };
    }

    return null;
  }, [targetEntity, account, components]);

  // Get the available resources in the target structure
  const structureResources = useMemo(() => {
    if (!target?.structure) return [];

    // Get all non-zero resource balances from the structure
    const structureId = target.id;
    const availableResources: Array<{ resourceId: number; amount: number }> = [];

    Object.values(ResourcesIds)
      .filter((id) => typeof id === "number")
      .forEach((resourceId) => {
        if (typeof resourceId === "number") {
          // Skip Lords - they can't be raided
          if (resourceId === ResourcesIds.Lords) return;

          // Use a resource manager to get the balance
          const resourceManager = new ResourceManager(components, structureId as ID);
          const amount = resourceManager.balance(resourceId);
          if (amount > 0) {
            availableResources.push({
              resourceId,
              amount: Number(amount),
            });
          }
        }
      });

    return availableResources;
  }, [target, components]);

  // Get the current army states for display
  const attackerArmyData = useMemo(() => {
    const army = getComponentValue(ExplorerTroops, getEntityIdFromKeys([BigInt(attackerEntityId)]));
    return {
      troops: {
        count: Number(army?.troops.count || 0),
        category: army?.troops.category as TroopType,
        tier: army?.troops.tier as TroopTier,
        stamina: army?.troops.stamina,
      },
    };
  }, [attackerEntityId]);

  const targetArmyData = useMemo(() => {
    if (!target?.info) return null;

    return {
      troops: {
        count: Number(target.info.count || 0),
        category: target.info.category as TroopType,
        tier: target.info.tier as TroopTier,
        stamina: target.info.stamina,
      },
    };
  }, [target]);

  const defenderStamina = useMemo(() => {
    if (!target?.info?.stamina) return 0;
    const maxStamina = StaminaManager.getMaxStamina(target?.info);
    return StaminaManager.getStamina(
      target?.info?.stamina,
      maxStamina,
      getBlockTimestamp().currentArmiesTick,
      components,
    ).amount;
  }, [target, components]);

  const isVillageWithoutTroops = useMemo(() => {
    return target?.structureCategory === StructureType.Village && !target?.info;
  }, [target]);

  const params = configManager.getCombatConfig();
  const raidSimulator = useMemo(() => new MockRaidSimulator(params), [params]);
  const combatSimulator = useMemo(() => new CombatSimulator(params), [params]);

  // Simulate raid outcome
  const raidSimulation = useMemo(() => {
    if (!attackerArmyData) return null;

    // Convert game armies to simulator armies
    const attackerArmy = {
      entity_id: attackerEntityId,
      stamina: Number(attackerStamina),
      troopCount: Number(attackerArmyData.troops.count) / RESOURCE_PRECISION,
      troopType: attackerArmyData.troops.category as TroopType,
      tier: attackerArmyData.troops.tier as TroopTier,
    };

    const defenders = targetArmyData
      ? [
          {
            entity_id: target?.id || 0,
            stamina: Number(defenderStamina),
            troopCount: Number(targetArmyData.troops.count) / RESOURCE_PRECISION,
            troopType: targetArmyData.troops.category as TroopType,
            tier: targetArmyData.troops.tier as TroopTier,
          },
        ]
      : [];

    // Use the raid simulator to predict the outcome
    const result = raidSimulator.simulateRaid(attackerArmy, defenders, biome, 0.1);

    return {
      ...result,
      attackerTroopsLeft: attackerArmy.troopCount - result.raiderDamageTaken / RESOURCE_PRECISION,
      defenderTroopsLeft:
        defenders.length > 0 ? defenders[0].troopCount - result.defenderDamageTaken / RESOURCE_PRECISION : 0,
      newAttackerStamina: Number(attackerStamina) - combatConfig.stamina_attack_req,
      newDefenderStamina: Number(defenderStamina) - (defenders.length > 0 ? combatConfig.stamina_attack_req : 0),
    };
  }, [
    attackerEntityId,
    target,
    account,
    components,
    attackerStamina,
    defenderStamina,
    attackerArmyData,
    targetArmyData,
    biome,
    combatConfig,
    raidSimulator,
  ]);

  const onRaid = async () => {
    if (!selectedHex) return;
    await onExplorerVsGuardRaid();
    // Close modal after raid
    updateSelectedEntityId(null);
    toggleModal(null);
  };

  const onExplorerVsGuardRaid = async () => {
    if (!selectedHex || selectedResources.length === 0) return;
    const direction = getDirectionBetweenAdjacentHexes(selectedHex, { col: targetHex.x, row: targetHex.y });
    if (direction === null) return;

    // Convert resources to the format expected by the contract
    const resources = selectedResources
      .filter((r) => r.resourceId > 0 && r.amount > 0)
      .map((r) => [r.resourceId, BigInt(r.amount * RESOURCE_PRECISION)]);

    try {
      setLoading(true);
      // Using the general provider approach since raid_explorer_vs_guard is not defined in systemCalls
      await account.callContract({
        contractAddress: "YOUR_CONTRACT_ADDRESS", // Replace with actual contract address
        entrypoint: "raid_explorer_vs_guard",
        calldata: [
          attackerEntityId.toString(),
          (target?.id || 0).toString(),
          direction.toString(),
          resources.flat().map(String),
        ],
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const addResourceField = () => {
    setSelectedResources([...selectedResources, { resourceId: 0, amount: 0 }]);
  };

  const removeResourceField = (index: number) => {
    const newResources = [...selectedResources];
    newResources.splice(index, 1);
    setSelectedResources(newResources);
  };

  const updateResourceId = (index: number, resourceId: number | null) => {
    const newResources = [...selectedResources];
    newResources[index].resourceId = resourceId || 0;
    setSelectedResources(newResources);
  };

  const updateResourceAmount = (index: number, amount: number) => {
    const newResources = [...selectedResources];
    newResources[index].amount = amount;
    setSelectedResources(newResources);
  };

  const buttonMessage = useMemo(() => {
    if (isVillageWithoutTroops) return "Villages cannot be raided without defenders";
    if (attackerStamina < combatConfig.stamina_attack_req)
      return `Not Enough Stamina (${combatConfig.stamina_attack_req} Required)`;
    if (!attackerArmyData) return "No Troops Present";
    if (target?.targetType !== TargetType.Structure) return "Only structures can be raided";
    if (!selectedResources.some((r) => r.resourceId > 0 && r.amount > 0)) return "Select resources to raid";
    return "Raid!";
  }, [isVillageWithoutTroops, attackerStamina, attackerArmyData, combatConfig, target, selectedResources]);

  const getMaxResourceAmount = (resourceId: number) => {
    const resource = structureResources.find((r) => r.resourceId === resourceId);
    return resource ? divideByPrecision(resource.amount) : 0;
  };

  const canRaid = useMemo(() => {
    return (
      attackerStamina >= combatConfig.stamina_attack_req &&
      attackerArmyData &&
      target?.targetType === TargetType.Structure &&
      selectedResources.some((r) => r.resourceId > 0 && r.amount > 0) &&
      !isVillageWithoutTroops
    );
  }, [attackerStamina, combatConfig, attackerArmyData, target, selectedResources, isVillageWithoutTroops]);

  return (
    <div className="flex flex-col gap-6 p-6 mx-auto max-w-full overflow-hidden">
      {/* Add Biome Info Panel */}
      <div className="p-4 border panel-wood rounded-lg backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2>Terrain: {biome}</h2>
            <div className="flex gap-4 mt-4 text-xl">
              <div>Melee: {formatBiomeBonus(combatSimulator.getBiomeBonus(TroopType.Knight, biome))}</div>
              <div>Ranged: {formatBiomeBonus(combatSimulator.getBiomeBonus(TroopType.Crossbowman, biome))}</div>
              <div>Paladins: {formatBiomeBonus(combatSimulator.getBiomeBonus(TroopType.Paladin, biome))}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Attacker Panel */}
        <div className="flex flex-col gap-3 p-4 border border-gold/20 rounded-lg backdrop-blur-sm panel-wood">
          <h4>Raider Forces (You)</h4>
          {attackerArmyData && (
            <div className="mt-4 space-y-4">
              {/* Troop Information */}
              <div className="p-3 border border-gold/10 rounded">
                {formatTypeAndBonuses(
                  attackerArmyData.troops.category as TroopType,
                  attackerArmyData.troops.tier as TroopTier,
                  combatSimulator.getBiomeBonus(attackerArmyData.troops.category as TroopType, biome),
                  combatSimulator.calculateStaminaModifier(Number(attackerStamina), true),
                  true,
                )}
                <div className="text-2xl font-bold text-gold">
                  {divideByPrecision(attackerArmyData.troops.count)} troops
                </div>
              </div>

              {/* Raid Simulation Results */}
              {raidSimulation && (
                <div className="p-3 border border-gold/10 rounded">
                  <h4 className="text-sm font-medium text-gold/90 mb-2">Potential Raid Losses</h4>
                  <div className="flex items-center gap-2">
                    <div className="text-2xl font-bold text-order-giants bg-order-giants/10 rounded-md px-2 py-1">
                      {-Math.ceil(raidSimulation.raiderDamageTaken / RESOURCE_PRECISION)}
                    </div>
                    <div className="uppercase text-xs text-red-400">troops lost</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Defender Panel */}
        <div className="flex flex-col gap-3 p-4 border border-gold/20 rounded-lg backdrop-blur-sm panel-wood">
          <h4>Defender Forces</h4>
          {targetArmyData ? (
            <div className="mt-4 space-y-4">
              {/* Troop Information */}
              <div className="p-3 border border-gold/10 rounded">
                {formatTypeAndBonuses(
                  targetArmyData.troops.category as TroopType,
                  targetArmyData.troops.tier as TroopTier,
                  combatSimulator.getBiomeBonus(targetArmyData.troops.category as TroopType, biome),
                  combatSimulator.calculateStaminaModifier(Number(defenderStamina), false),
                  false,
                )}
                <div className="text-2xl font-bold text-gold">
                  {divideByPrecision(targetArmyData.troops.count)} troops
                </div>
              </div>

              {/* Raid Simulation Results */}
              {raidSimulation && (
                <div className="p-3 border border-gold/10 rounded">
                  <h4 className="text-sm font-medium text-gold/90 mb-2">Potential Raid Losses</h4>
                  <div className="flex items-center gap-2">
                    <div className="text-2xl font-bold text-order-giants bg-order-giants/10 rounded-md px-2 py-1">
                      {-Math.ceil(raidSimulation.defenderDamageTaken / RESOURCE_PRECISION)}
                    </div>
                    <div className="uppercase text-xs text-red-400">troops lost</div>
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
          <h3 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-gold border-b border-gold/20 pb-4">
            Raid Prediction
          </h3>

          <div className="p-4 border border-gold/10 rounded mb-6">
            <h4 className="text-lg font-medium text-gold/90 mb-4">Raid Outcome</h4>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
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
              <div className="flex justify-between items-center">
                <span className="text-gold/70">Outcome Type:</span>
                <span className="text-lg font-bold text-gold">
                  {raidSimulation?.outcomeType === RaidOutcome.Success
                    ? "Guaranteed Success"
                    : raidSimulation?.outcomeType === RaidOutcome.Failure
                      ? "Guaranteed Failure"
                      : "Chance-based"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gold/70">Stamina Cost:</span>
                <span className="text-lg font-bold text-gold">{combatConfig.stamina_attack_req} stamina</span>
              </div>
            </div>
          </div>

          {/* Resource Selection */}
          <div className="p-4 border border-gold/10 rounded mb-6">
            <h4 className="text-lg font-medium text-gold/90 mb-4">Resources to Raid</h4>

            {structureResources.length > 0 ? (
              <div className="space-y-4">
                {selectedResources.map((resource, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <SelectResource
                      onSelect={(resourceId) => updateResourceId(index, resourceId)}
                      defaultValue={resource.resourceId}
                      className="flex-1"
                      excludeResourceIds={[ResourcesIds.Lords]} // LORDS can't be raided
                    />

                    <div className="flex flex-col items-center">
                      <div className="text-xs text-gold/60 mb-1">Available</div>
                      <div className="text-sm text-gold/80">
                        {currencyFormat(getMaxResourceAmount(resource.resourceId), 2)}
                      </div>
                    </div>

                    <input
                      type="number"
                      value={resource.amount}
                      onChange={(e) => updateResourceAmount(index, Number(e.target.value))}
                      min={0}
                      max={getMaxResourceAmount(resource.resourceId)}
                      className="px-2 py-1 w-24 bg-brown-900/50 border border-gold/20 rounded text-gold/90"
                    />

                    <button onClick={() => removeResourceField(index)} className="p-2 text-red-400 hover:text-red-300">
                      X
                    </button>
                  </div>
                ))}

                <div className="flex justify-between mt-4">
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={addResourceField}
                    className="text-gold/80 border-gold/30"
                  >
                    + Add Resource
                  </Button>

                  <div className="flex items-center gap-2">
                    <div className="text-sm text-gold/60">Total Resources:</div>
                    <div className="text-lg font-bold text-gold">
                      {selectedResources.reduce((sum, r) => sum + r.amount, 0)}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-gold/60">No resources available to raid in this structure.</div>
            )}
          </div>

          {/* Battle Stats Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="p-2 border border-gold/20 rounded-md bg-brown-900/50 text-center">
              <div className="text-xs text-gold/70 mb-1">Attacker Casualties</div>
              <div className="text-lg font-bold text-order-giants">
                {raidSimulation ? Math.ceil(raidSimulation.raiderDamageTaken / RESOURCE_PRECISION) : 0}
                <span className="text-xs ml-1">
                  (
                  {raidSimulation && attackerArmyData && attackerArmyData.troops.count
                    ? Math.round(
                        (raidSimulation.raiderDamageTaken /
                          RESOURCE_PRECISION /
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
                {raidSimulation && targetArmyData
                  ? Math.ceil(raidSimulation.defenderDamageTaken / RESOURCE_PRECISION)
                  : 0}
                <span className="text-xs ml-1">
                  (
                  {raidSimulation && targetArmyData && targetArmyData.troops.count
                    ? Math.round(
                        (raidSimulation.defenderDamageTaken /
                          RESOURCE_PRECISION /
                          divideByPrecision(targetArmyData.troops.count)) *
                          100,
                      )
                    : 0}
                  %)
                </span>
              </div>
            </div>
            <div className="p-2 border border-gold/20 rounded-md bg-brown-900/50 text-center">
              <div className="text-xs text-gold/70 mb-1">Success Chance</div>
              <div
                className={`text-lg font-bold ${
                  raidSimulation?.successChance && raidSimulation.successChance >= 80
                    ? "text-green-400"
                    : raidSimulation?.successChance && raidSimulation.successChance >= 50
                      ? "text-yellow-400"
                      : "text-red-400"
                }`}
              >
                {raidSimulation ? raidSimulation.successChance.toFixed(2) : 0}%
              </div>
            </div>
            <div className="p-2 border border-gold/20 rounded-md bg-brown-900/50 text-center">
              <div className="text-xs text-gold/70 mb-1">Raid Outcome</div>
              <div className={`text-lg font-bold ${raidSimulation?.isSuccessful ? "text-green-400" : "text-red-400"}`}>
                {raidSimulation ? (raidSimulation.isSuccessful ? "Success" : "Failure") : "Unknown"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unable to Raid Message */}
      {target?.targetType !== TargetType.Structure && (
        <div className="mt-2 p-6 border border-gold/20 rounded-lg backdrop-blur-sm panel-wood shadow-lg">
          <h3 className="text-2xl font-bold mb-6 text-gold border-b border-gold/20 pb-4">Unable to Raid</h3>
          <div className="text-center py-4">
            <div className="text-xl font-bold text-red-400 mb-2">Target cannot be raided!</div>
            <p className="text-gold/80 mb-4">You can only raid structures owned by other players.</p>
          </div>
        </div>
      )}

      {/* Raid Button */}
      <div className="mt-2 flex justify-center">
        <Button
          variant="primary"
          className={`px-6 py-3 rounded-lg font-bold text-lg transition-colors`}
          isLoading={loading}
          disabled={!canRaid}
          onClick={onRaid}
        >
          {buttonMessage}
        </Button>
      </div>
    </div>
  );
};
