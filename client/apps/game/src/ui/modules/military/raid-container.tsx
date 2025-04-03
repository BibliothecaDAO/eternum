import { useUIStore } from "@/hooks/store/use-ui-store";
import Button from "@/ui/elements/button";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { formatStringNumber } from "@/ui/utils/utils";
import { getBlockTimestamp } from "@/utils/timestamp";
import {
  Biome,
  CombatSimulator,
  configManager,
  ContractAddress,
  divideByPrecision,
  getArmy,
  getArmyTotalCapacityInKg,
  getDirectionBetweenAdjacentHexes,
  getEntityIdFromKeys,
  getGuardsByStructure,
  ID,
  isMilitaryResource,
  RaidSimulator,
  RESOURCE_PRECISION,
  RESOURCE_RARITY,
  ResourceManager,
  resources,
  ResourcesIds,
  StaminaManager,
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

enum TargetType {
  Village,
  Structure,
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
      components,
      components: { Structure, Tile },
    },
  } = useDojo();

  const [loading, setLoading] = useState(false);

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

  const target = useMemo(() => {
    const structure = getComponentValue(Structure, getEntityIdFromKeys([BigInt(targetEntity?.occupier_id || 0n)]));

    if (structure) {
      return {
        info: getGuardsByStructure(structure).filter((guard) => guard.troops.count > 0n)[0]?.troops,
        id: targetEntity?.occupier_id,
        targetType: TargetType.Structure,
        structureCategory: structure.category,
        structure,
      };
    }

    return null;
  }, [targetEntity, account, components]);

  // Get the available resources in the target structure
  const structureResourcesByRarity = useMemo(() => {
    if (!target?.structure) return [];

    // Get all non-zero resource balances from the structure
    const structureId = target.id;
    const availableResources: Array<{ resourceId: number; amount: number }> = [];
    const { currentDefaultTick } = getBlockTimestamp();

    // Iterate through all resource IDs in the game
    Object.keys(RESOURCE_RARITY)
      .map(Number)
      .filter((id) => !isNaN(id))
      .forEach((resourceId) => {
        // Skip Lords - they can't be raided
        if (resourceId === ResourcesIds.Lords || isMilitaryResource(resourceId)) return;

        // Use a resource manager to get the balance
        const resourceManager = new ResourceManager(components, structureId as ID);
        const amount = resourceManager.balanceWithProduction(currentDefaultTick, resourceId);

        if (amount > 0) {
          availableResources.push({
            resourceId,
            amount: Number(amount),
          });
        }
      });

    return availableResources;
  }, [target, components]);

  // Get all troops defending the structure
  const defenderTroops = useMemo(() => {
    if (!target?.structure) return [];

    const { currentArmiesTick } = getBlockTimestamp();

    // Get all troops with non-zero count
    return getGuardsByStructure(target.structure)
      .filter((guard) => guard.troops.count > 0n)
      .map((guard) => {
        const stamina = StaminaManager.getStamina(
          guard.troops.stamina,
          StaminaManager.getMaxStamina(guard.troops),
          currentArmiesTick,
          components,
        );
        return {
          count: Number(guard.troops.count),
          category: guard.troops.category as TroopType,
          tier: guard.troops.tier as TroopTier,
          stamina: Number(stamina.amount),
        };
      });
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
        stamina: StaminaManager.getStamina(
          army?.troops.stamina || { amount: 0n, updated_tick: 0n },
          StaminaManager.getMaxStamina(army?.troops),
          currentArmiesTick,
          components,
        ),
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
    const defenders = defenderTroops.map((troop) => ({
      entity_id: target?.id || 0,
      stamina: Number(troop.stamina || 0),
      troopCount: divideByPrecision(Number(troop.count)),
      troopType: troop.category as TroopType,
      tier: troop.tier as TroopTier,
    }));

    // Use the raid simulator to predict the outcome
    const result = raidSimulator.simulateRaid(attackerArmy, defenders, biome);

    // Calculate total defender troops for percentages
    const totalDefenderTroops = defenderTroops.reduce((total, troop) => total + divideByPrecision(troop.count), 0);

    return {
      ...result,
      attackerTroopsLeft: attackerArmy.troopCount - result.raiderDamageTaken,
      defenderTroopsLeft: defenders.map((troop) => troop.troopCount - result.defenderDamageTaken),
      newAttackerStamina: Number(attackerArmyData.troops.stamina.amount) - combatConfig.stamina_attack_req,
      newDefendersStamina: defenders.map((troop) => troop.stamina - result.defenderDamageTaken),
      totalDefenderTroops,
    };
  }, [
    attackerEntityId,
    target,
    account,
    components,
    attackerArmyData,
    biome,
    combatConfig,
    raidSimulator,
    defenderTroops,
  ]);

  const remainingCapacity = useMemo(() => {
    return getArmyTotalCapacityInKg(raidSimulation?.attackerTroopsLeft || 0);
  }, [raidSimulation]);

  const stealableResources = useMemo(() => {
    // let remainingCapacity = Number(getArmyTotalCapacityInKg(raidSimulation?.attackerTroopsLeft || 0));
    let remainingCapacity = 10000000000000000000;
    let stealableResources: Array<{ resourceId: number; amount: number }> = [];
    structureResourcesByRarity
      .filter((resource) => resource.resourceId !== ResourcesIds.Lords)
      .forEach((resource) => {
        const availableAmount = divideByPrecision(resource.amount);
        const resourceWeight = configManager.getResourceWeightKg(resource.resourceId);
        if (remainingCapacity > 0) {
          const maxStealableAmount = Math.min(
            Math.floor(Number(remainingCapacity) / Number(resourceWeight)),
            availableAmount,
          );
          if (maxStealableAmount > 0) {
            stealableResources.push({
              ...resource,
              amount: maxStealableAmount,
            });
          }
          remainingCapacity -= maxStealableAmount * Number(resourceWeight);
        }
      });
    return stealableResources;
  }, [structureResourcesByRarity, remainingCapacity]);

  const onRaid = async () => {
    if (!selectedHex) return;
    await onExplorerVsStructureRaid();
    // Close modal after raid
    updateSelectedEntityId(null);
    toggleModal(null);
  };

  const onExplorerVsStructureRaid = async () => {
    if (!selectedHex || stealableResources.length === 0) return;
    const direction = getDirectionBetweenAdjacentHexes(selectedHex, { col: targetHex.x, row: targetHex.y });
    if (direction === null) return;

    // Convert resources to the format expected by the contract
    const resources = stealableResources
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
      stealableResources.some((r) => r.resourceId > 0 && r.amount > 0)
    );
  }, [attackerArmyData, combatConfig, target, stealableResources]);

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
                  combatSimulator.calculateStaminaModifier(Number(attackerArmyData.troops.stamina.amount), true),
                  true,
                )}
                <div className="text-2xl font-bold text-gold">
                  {divideByPrecision(attackerArmyData.troops.count)} troops
                </div>
                <div className="text-lg text-gold/80 mt-1">
                  Stamina: {Number(attackerArmyData.troops.stamina.amount)} / {combatConfig.stamina_attack_req} required
                </div>
              </div>

              {/* Raid Simulation Results */}
              {raidSimulation && (
                <div className="p-3 border border-gold/10 rounded">
                  <h4 className="text-sm font-medium text-gold/90 mb-2">Potential Raid Losses</h4>
                  <div className="flex items-center gap-2">
                    <div className="text-2xl font-bold text-order-giants bg-order-giants/10 rounded-md px-2 py-1">
                      {-Math.floor(raidSimulation.raiderDamageTaken)}
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
          <h4>Combined Defender Forces</h4>
          {defenderTroops.length > 0 ? (
            <div className="mt-4 space-y-4">
              {/* Troop Information */}
              {defenderTroops.map((troops, index) => (
                <div key={index} className="p-3 border border-gold/10 rounded">
                  {formatTypeAndBonuses(
                    troops.category as TroopType,
                    troops.tier as TroopTier,
                    combatSimulator.getBiomeBonus(troops.category as TroopType, biome),
                    combatSimulator.calculateStaminaModifier(Number(troops.stamina || 0), false),
                    false,
                  )}
                  <div className="text-2xl font-bold text-gold">{divideByPrecision(troops.count)} troops</div>
                  <div className="text-2xl font-bold text-gold">
                    -{raidSimulation?.damageTakenPerDefender[index]} troops lost
                  </div>
                  <div className="text-lg text-gold/80 mt-1">Current Stamina: {Number(troops.stamina || 0)}</div>
                </div>
              ))}

              {/* Raid Simulation Results */}
              {raidSimulation && (
                <div className="p-3 border border-gold/10 rounded">
                  <h4 className="text-sm font-medium text-gold/90 mb-2">Potential Raid Losses</h4>
                  <div className="flex items-center gap-2">
                    <div className="text-2xl font-bold text-order-giants bg-order-giants/10 rounded-md px-2 py-1">
                      {-Math.floor(raidSimulation.defenderDamageTaken)}
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
            <h4 className="text-lg font-medium text-gold/90 mb-4">Resources Pillaged if Raid Succeeds</h4>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center text-lg font-bold text-gold">
                <span className="">Remaining Capacity:</span>
                <span className="">{Number(remainingCapacity)} kg</span>
              </div>
            </div>

            {stealableResources.length > 0 ? (
              <div className="flex flex-col gap-2">
                {stealableResources.map((resource) => (
                  <div key={resource.resourceId} className="flex justify-between items-center">
                    <span className="text-lg font-bold text-gold">{formatStringNumber(resource.amount, 0)}</span>
                    <ResourceIcon
                      resource={resources.find((r) => r.id === resource.resourceId)?.trait || ""}
                      size="lg"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-gold/60">No resources available to raid in this structure.</div>
            )}
          </div>

          {/* Battle Stats Summary */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            <div className="p-2 border border-gold/20 rounded-md bg-brown-900/50 text-center">
              <div className="text-xs text-gold/70 mb-1">Attacker Casualties</div>
              <div className="text-lg font-bold text-order-giants">
                {raidSimulation ? Math.floor(raidSimulation.raiderDamageTaken) : 0}
                <span className="text-xs ml-1">
                  (
                  {raidSimulation && attackerArmyData && attackerArmyData.troops.count
                    ? Math.floor(
                        (raidSimulation.raiderDamageTaken / divideByPrecision(attackerArmyData.troops.count)) * 100,
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
                    ? Math.floor((raidSimulation.defenderDamageTaken / raidSimulation.totalDefenderTroops) * 100)
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
