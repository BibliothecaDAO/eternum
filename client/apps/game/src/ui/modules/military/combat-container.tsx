import { useUIStore } from "@/hooks/store/use-ui-store";
import { BiomeInfoPanel } from "@/ui/components/biome/biome-info-panel";
import Button from "@/ui/elements/button";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { currencyFormat } from "@/ui/utils/utils";
import { getBlockTimestamp } from "@/utils/timestamp";
import {
  Biome,
  CombatSimulator,
  configManager,
  divideByPrecision,
  getEntityIdFromKeys,
  getGuardsByStructure,
  getRemainingCapacityInKg,
  getTroopResourceId,
  ResourceManager,
  StaminaManager,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { getExplorerFromToriiClient, getStructureFromToriiClient } from "@bibliothecadao/torii-client";
import {
  CapacityConfig,
  getDirectionBetweenAdjacentHexes,
  ID,
  Resource,
  RESOURCE_PRECISION,
  resources,
  ResourcesIds,
  StructureType,
  Troops,
  TroopTier,
  TroopType,
} from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatTypeAndBonuses, getStaminaDisplay } from "./combat-utils";

const STEALABLE_RESOURCES = [
  ResourcesIds.Wheat,
  ResourcesIds.Fish,
  ResourcesIds.Stone,
  ResourcesIds.Coal,
  ResourcesIds.Wood,
  ResourcesIds.Copper,
  ResourcesIds.Ironwood,
  ResourcesIds.Obsidian,
  ResourcesIds.Gold,
  ResourcesIds.Silver,
  ResourcesIds.Mithral,
  ResourcesIds.AlchemicalSilver,
  ResourcesIds.ColdIron,
  ResourcesIds.DeepCrystal,
  ResourcesIds.Ruby,
  ResourcesIds.Diamonds,
  ResourcesIds.Hartwood,
  ResourcesIds.Ignium,
  ResourcesIds.TwilightQuartz,
  ResourcesIds.TrueIce,
  ResourcesIds.Adamantine,
  ResourcesIds.Sapphire,
  ResourcesIds.EtherealSilica,
  ResourcesIds.Dragonhide,
  ResourcesIds.Labor,
  ResourcesIds.AncientFragment,
  ResourcesIds.Donkey,
  ResourcesIds.Knight,
  ResourcesIds.Crossbowman,
  ResourcesIds.Paladin,
  ResourcesIds.KnightT2,
  ResourcesIds.CrossbowmanT2,
  ResourcesIds.PaladinT2,
  ResourcesIds.KnightT3,
  ResourcesIds.CrossbowmanT3,
  ResourcesIds.PaladinT3,
  ResourcesIds.Lords,
];

enum TargetType {
  Village,
  Structure,
  Army,
}

enum AttackerType {
  Structure,
  Army,
}

export const CombatContainer = ({
  attackerEntityId,
  targetHex,
}: {
  attackerEntityId: ID;
  targetHex: { x: number; y: number };
}) => {
  const {
    account: { account },
    network: { toriiClient },
    setup: {
      systemCalls: { attack_explorer_vs_explorer, attack_explorer_vs_guard, attack_guard_vs_explorer },
      components,
      components: { Structure, ExplorerTroops, Tile },
    },
  } = useDojo();

  const [loading, setLoading] = useState(false);
  const [selectedGuardSlot, setSelectedGuardSlot] = useState<number | null>(null);
  const [target, setTarget] = useState<{
    info: Troops;
    id: ID;
    targetType: TargetType;
    structureCategory: StructureType | null;
  } | null>(null);
  const [targetArmyResourcesByRarity, setTargetArmyResourcesByRarity] = useState<
    Array<{ resourceId: number; amount: number }>
  >([]);

  const updateSelectedEntityId = useUIStore((state) => state.updateEntityActionSelectedEntityId);

  const toggleModal = useUIStore((state) => state.toggleModal);

  const selectedHex = useUIStore((state) => state.selectedHex);

  const targetTile = getComponentValue(Tile, getEntityIdFromKeys([BigInt(targetHex.x), BigInt(targetHex.y)]));

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
    if (attackerType === AttackerType.Structure) {
      if (selectedGuardSlot === null && structureGuards.length > 0) {
        // Auto-select the first guard if none is selected
        setSelectedGuardSlot(structureGuards[0].slot);

        // For structure guards, we need to calculate stamina differently
        const guard = structureGuards[0];
        if (!guard.troops.stamina) return 0n;

        return StaminaManager.getStamina(guard.troops, getBlockTimestamp().currentArmiesTick).amount;
      } else if (selectedGuardSlot !== null) {
        const selectedGuard = structureGuards.find((guard) => guard.slot === selectedGuardSlot);
        if (selectedGuard && selectedGuard.troops.stamina) {
          return StaminaManager.getStamina(selectedGuard.troops, getBlockTimestamp().currentArmiesTick).amount;
        }
      }
      return 0n;
    }
    return new StaminaManager(components, attackerEntityId).getStamina(getBlockTimestamp().currentArmiesTick).amount;
  }, [attackerEntityId, attackerType, components, selectedGuardSlot, structureGuards]);

  // Function to order resources according to STEALABLE_RESOURCES order
  const orderResourcesByPriority = useCallback((resourceBalances: Resource[]): Resource[] => {
    const orderedResources: Resource[] = [];

    STEALABLE_RESOURCES.forEach((resourceId) => {
      const resource = resourceBalances.find((r) => r.resourceId === resourceId);
      if (resource) {
        orderedResources.push(resource);
      }
    });

    return orderedResources;
  }, []);

  // target not synced so need to fetch from torii
  useEffect(() => {
    if (!targetTile?.occupier_id) return;
    const isStructure = targetTile?.occupier_is_structure;

    const getTarget = async () => {
      if (isStructure) {
        const result = await getStructureFromToriiClient(toriiClient, targetTile.occupier_id);
        if (result) {
          setTarget({
            info: getGuardsByStructure(result.structure).filter((guard) => guard.troops.count > 0n)[0]?.troops,
            id: targetTile?.occupier_id,
            targetType: TargetType.Structure,
            structureCategory: result.structure.category,
          });
        }
      } else {
        const { explorer, resources } = await getExplorerFromToriiClient(toriiClient, targetTile.occupier_id);
        const resourcesByRarity = orderResourcesByPriority(ResourceManager.getResourceBalances(resources));
        setTargetArmyResourcesByRarity(resourcesByRarity);
        setTarget({
          info: explorer.troops,
          id: targetTile?.occupier_id,
          targetType: TargetType.Army,
          structureCategory: null,
        });
      }
    };

    getTarget();
  }, [targetTile]);

  // Get the current army states for display
  const attackerArmyData: { troops: Troops } | null = useMemo(() => {
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
        },
      };
    } else {
      // attacker always synced already
      const army = getComponentValue(ExplorerTroops, getEntityIdFromKeys([BigInt(attackerEntityId)]));
      return {
        troops: {
          count: army?.troops.count || 0n,
          category: army?.troops.category as TroopType,
          tier: army?.troops.tier as TroopTier,
          stamina: army?.troops.stamina || { amount: 0n, updated_tick: 0n },
        },
      };
    }
  }, [attackerEntityId, attackerType, selectedGuardSlot, structureGuards]);

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
    return StaminaManager.getStamina(target?.info, getBlockTimestamp().currentArmiesTick).amount;
  }, [target]);

  const isVillageWithoutTroops = useMemo(() => {
    return target?.structureCategory === StructureType.Village && !target?.info;
  }, [target]);

  const params = configManager.getCombatConfig();
  const combatSimulator = useMemo(() => new CombatSimulator(params), [params]);

  // Simulate battle outcome
  const battleSimulation = useMemo(() => {
    if (!attackerArmyData) return null;

    // If there are no target troops, we can claim the realm without a battle
    if (!targetArmyData) return null;

    // Convert game armies to simulator armies
    const attackerArmy = {
      entity_id: attackerEntityId,
      stamina: Number(attackerStamina),
      troopCount: Number(attackerArmyData.troops.count) / RESOURCE_PRECISION,
      troopType: attackerArmyData.troops.category as TroopType,
      tier: attackerArmyData.troops.tier as TroopTier,
    };

    const defenderArmy = {
      entity_id: target?.id || 0,
      stamina: Number(defenderStamina),
      troopCount: Number(targetArmyData.troops.count) / RESOURCE_PRECISION,
      troopType: targetArmyData.troops.category as TroopType,
      tier: targetArmyData.troops.tier as TroopTier,
    };

    const result = combatSimulator.simulateBattleWithParams(attackerArmy, defenderArmy, biome);

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

    let newAttackerStamina = Number(attackerStamina) - combatConfig.stamina_attack_req;
    let newDefenderStamina = Number(defenderStamina) - combatConfig.stamina_attack_req;

    if (attackerTroopsLeft <= 0 && defenderTroopsLeft > 0) {
      newDefenderStamina += combatConfig.stamina_bonus_value;
    } else if (defenderTroopsLeft <= 0 && attackerTroopsLeft > 0) {
      newAttackerStamina += combatConfig.stamina_bonus_value;
    }

    return {
      attackerTroopsLeft,
      defenderTroopsLeft,
      winner,
      newAttackerStamina,
      newDefenderStamina,
      attackerDamage: result.attackerDamage,
      defenderDamage: result.defenderDamage,
      getRemainingTroops: () => ({
        attackerTroops: attackerArmy.troopCount - attackerTroopsLost,
        defenderTroops: defenderArmy.troopCount - defenderTroopsLost,
      }),
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
    combatSimulator,
  ]);

  const remainingTroops = battleSimulation?.getRemainingTroops();
  const winner = battleSimulation?.winner;

  const onAttack = async () => {
    if (!selectedHex) return;

    if (attackerType === AttackerType.Structure) {
      if (selectedGuardSlot === null) return;
      await onGuardVsExplorerAttack();
    } else if (target?.targetType === TargetType.Army) {
      await onExplorerVsExplorerAttack();
    } else {
      await onExplorerVsGuardAttack();
    }
    // close modal after attack because we already know the result
    updateSelectedEntityId(null);
    toggleModal(null);
  };

  const onExplorerVsGuardAttack = async () => {
    if (!selectedHex) return;
    const direction = getDirectionBetweenAdjacentHexes(selectedHex, { col: targetHex.x, row: targetHex.y });
    if (direction === null) return;

    try {
      setLoading(true);
      await attack_explorer_vs_guard({
        signer: account,
        explorer_id: attackerEntityId,
        structure_id: target?.id || 0,
        structure_direction: direction,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const remainingCapacity = useMemo(() => {
    const resource = getComponentValue(components.Resource, getEntityIdFromKeys([BigInt(attackerEntityId)]));
    const remainingCapacity = resource ? getRemainingCapacityInKg(resource) : 0;
    const remainingCapacityAfterRaid =
      remainingCapacity -
      (battleSimulation?.defenderDamage || 0) * configManager.getCapacityConfigKg(CapacityConfig.Army);
    return { beforeRaid: remainingCapacity, afterRaid: remainingCapacityAfterRaid };
  }, [battleSimulation]);

  const stealableResourcesUI = useMemo(() => {
    let capacityAfterRaid = remainingCapacity.afterRaid;
    const stealableResources: Array<{ resourceId: number; amount: number }> = [];

    // If no capacity, return empty array immediately
    if (capacityAfterRaid <= 0) {
      return stealableResources;
    }

    targetArmyResourcesByRarity
      .sort((a, b) => b.amount - a.amount)
      .forEach((resource) => {
        const availableAmount = divideByPrecision(resource.amount);
        const resourceWeight = configManager.getResourceWeightKg(resource.resourceId);
        if (capacityAfterRaid > 0) {
          let maxStealableAmount;
          if (resourceWeight === 0) {
            // If resource has no weight, can take all of it
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
          return; // Exit the forEach loop if no more capacity
        }
      });
    return stealableResources;
  }, [targetArmyResourcesByRarity]);

  const onExplorerVsExplorerAttack = async () => {
    if (!selectedHex) return;
    const direction = getDirectionBetweenAdjacentHexes(selectedHex, { col: targetHex.x, row: targetHex.y });
    if (direction === null) return;

    try {
      setLoading(true);
      await attack_explorer_vs_explorer({
        signer: account,
        aggressor_id: attackerEntityId,
        defender_id: target?.id || 0,
        defender_direction: direction,
        steal_resources: targetArmyResourcesByRarity,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const onGuardVsExplorerAttack = async () => {
    if (!selectedHex || selectedGuardSlot === null) return;
    const direction = getDirectionBetweenAdjacentHexes(selectedHex, { col: targetHex.x, row: targetHex.y });
    if (direction === null) return;

    try {
      setLoading(true);
      await attack_guard_vs_explorer({
        signer: account,
        structure_id: attackerEntityId,
        structure_guard_slot: selectedGuardSlot,
        explorer_id: target?.id || 0,
        explorer_direction: direction,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Troop selector component for structure troops
  const TroopSelector = () => {
    if (attackerType !== AttackerType.Structure || structureGuards.length === 0) return null;

    return (
      <div className="p-3 sm:p-4 border border-gold/20 rounded-lg bg-dark-brown/90 backdrop-blur-sm mb-4 overflow-hidden">
        <h3 className="text-lg font-semibold text-gold mb-3">Select Attacking Troops</h3>
        <div className="flex flex-wrap gap-2">
          {structureGuards.map((guard) => (
            <button
              key={guard.slot}
              onClick={() => setSelectedGuardSlot(guard.slot)}
              className={`flex items-center bg-brown-900/90 border ${
                selectedGuardSlot === guard.slot ? "border-gold" : "border-gold/20"
              } rounded-md px-2 py-1.5 hover:border-gold/60 transition-colors`}
            >
              <ResourceIcon
                withTooltip={false}
                resource={
                  resources.find(
                    (r) =>
                      r.id === getTroopResourceId(guard.troops.category as TroopType, guard.troops.tier as TroopTier),
                  )?.trait || ""
                }
                size="sm"
                className="w-4 h-4 mr-2"
              />
              <div className="flex flex-col">
                <span className="text-xs text-gold/90 font-medium">
                  {TroopType[guard.troops.category as TroopType]} {guard.troops.tier as TroopTier} (Slot {guard.slot})
                </span>
                <span className="text-sm text-gold font-bold">
                  {currencyFormat(Number(guard.troops.count || 0), 0)}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const buttonMessage = useMemo(() => {
    if (isVillageWithoutTroops) return "Villages cannot be claimed";
    if (attackerStamina < combatConfig.stamina_attack_req)
      return `Not Enough Stamina (${combatConfig.stamina_attack_req} Required)`;
    if (!attackerArmyData) return "No Troops Present";
    return "Attack!";
  }, [isVillageWithoutTroops, attackerStamina, attackerArmyData, combatConfig]);

  return (
    <div className="flex flex-col gap-6 p-6 mx-auto max-w-full overflow-hidden">
      {/* Add Biome Info Panel */}
      <BiomeInfoPanel biome={biome} />

      {/* Troop Selector for Structure */}
      {TroopSelector()}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Attacker Panel */}
        <div className="flex flex-col gap-3 p-4 border border-gold/20 rounded-lg backdrop-blur-sm panel-wood">
          <h4>Attacker Forces (You)</h4>
          {attackerArmyData && (
            <div className="mt-4 space-y-4">
              {/* Troop Information */}
              <div className="p-3 border border-gold/10 rounded">
                {formatTypeAndBonuses(
                  attackerArmyData.troops.category as TroopType,
                  attackerArmyData.troops.tier as TroopTier,
                  configManager.getBiomeCombatBonus(attackerArmyData.troops.category as TroopType, biome),
                  combatSimulator.calculateStaminaModifier(Number(attackerStamina), true),
                  true,
                )}
                <div className="text-2xl font-bold text-gold">
                  {divideByPrecision(Number(attackerArmyData.troops.count))} troops
                </div>
                <div className="text-lg text-gold/80 mt-1">
                  Stamina: {Number(attackerStamina)} / {combatConfig.stamina_attack_req} required
                </div>
              </div>

              {/* Battle Simulation Results */}
              {battleSimulation && (
                <div className="p-3 border border-gold/10 rounded ">
                  <h4 className="text-sm font-medium text-gold/90 mb-2">Losses</h4>
                  <div className="flex items-center gap-2">
                    <div className="text-2xl font-bold text-order-giants bg-order-giants/10 rounded-md px-2 py-1">
                      {-Math.ceil(battleSimulation.defenderDamage)}
                    </div>
                    <div className="uppercase text-xs text-red-400">dead</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Defender Panel */}
        <div className="flex flex-col gap-3 p-4 border border-gold/20 rounded-lg  backdrop-blur-sm panel-wood">
          <h4>Defender Forces</h4>
          {targetArmyData ? (
            <div className="mt-4 space-y-4">
              {/* Troop Information */}
              <div className="p-3 border border-gold/10 rounded ">
                {formatTypeAndBonuses(
                  targetArmyData.troops.category as TroopType,
                  targetArmyData.troops.tier as TroopTier,
                  configManager.getBiomeCombatBonus(targetArmyData.troops.category as TroopType, biome),
                  combatSimulator.calculateStaminaModifier(Number(defenderStamina), false),
                  false,
                )}
                <div className="text-2xl font-bold text-gold">
                  {divideByPrecision(targetArmyData.troops.count)} troops
                </div>
                <div className="text-lg text-gold/80 mt-1"> Current Stamina: {Number(defenderStamina)}</div>
              </div>

              {/* Battle Simulation Results */}
              {battleSimulation && (
                <div className="p-3 border border-gold/10 rounded">
                  <h4 className="text-sm font-medium text-gold/90 mb-2">Losses</h4>
                  <div className="flex items-center gap-2">
                    <div className="text-2xl font-bold text-order-giants bg-order-giants/10 rounded-md px-2 py-1">
                      {-Math.ceil(battleSimulation.attackerDamage)}
                    </div>
                    <div className="uppercase text-xs text-red-400">dead</div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="p-3 border border-gold/10 rounded bg-dark-brown/50">
                <h4 className="text-sm font-medium text-gold/90 mb-2">No Troops Present</h4>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Battle Results */}
      {targetArmyData && remainingTroops && attackerArmyData && (
        <div className="mt-2 p-4 sm:p-6 border border-gold/20 rounded-lg backdrop-blur-sm panel-wood shadow-lg overflow-hidden">
          <h3 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-gold border-b border-gold/20 pb-4 flex items-center">
            <span className="mr-2">📜</span> Battle Prediction
          </h3>

          {/* Battle Outcome Bar */}
          <div className="mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gold font-semibold">Your Forces</span>
              <span className="text-gold font-semibold">Enemy Forces</span>
            </div>
            <div className="relative h-10 bg-brown-900/70 rounded-md overflow-hidden border border-gold/20">
              {/* Calculate percentage based on remaining troops ratio */}
              {(() => {
                const attackerPercentage = Math.max(
                  0,
                  Math.min(
                    100,
                    (remainingTroops.attackerTroops / divideByPrecision(Number(attackerArmyData.troops.count))) * 100,
                  ),
                );
                const defenderPercentage = Math.max(
                  0,
                  Math.min(
                    100,
                    (remainingTroops.defenderTroops / divideByPrecision(targetArmyData.troops.count)) * 100,
                  ),
                );

                // Normalize to show relative strength in the bar
                const totalPercentage = attackerPercentage + defenderPercentage;
                const normalizedAttackerWidth = totalPercentage > 0 ? (attackerPercentage / totalPercentage) * 100 : 50;

                return (
                  <>
                    <div
                      className="absolute h-full bg-gold/40 transition-all duration-300 flex items-center"
                      style={{ width: `${normalizedAttackerWidth}%` }}
                    >
                      {/* Combat Icons */}
                      {Array.from({ length: Math.min(5, Math.ceil(remainingTroops.attackerTroops / 5)) }).map(
                        (_, i) => (
                          <div
                            key={`attacker-icon-${i}`}
                            className="w-5 h-5 mx-1 opacity-80"
                            style={{
                              backgroundImage: `url("/assets/ui/icons/${TroopType[attackerArmyData.troops.category as TroopType].toLowerCase()}.svg")`,
                              backgroundSize: "contain",
                              backgroundPosition: "center",
                              backgroundRepeat: "no-repeat",
                            }}
                          />
                        ),
                      )}

                      {normalizedAttackerWidth > 20 && (
                        <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-xs font-bold text-gold-900">
                          {Math.floor(remainingTroops.attackerTroops)} remaining
                        </span>
                      )}
                    </div>
                    <div
                      className="absolute right-0 h-full bg-order-giants/60 transition-all duration-300 flex items-center justify-end"
                      style={{ width: `${100 - normalizedAttackerWidth}%` }}
                    >
                      {/* Combat Icons */}
                      {Array.from({ length: Math.min(5, Math.ceil(remainingTroops.defenderTroops / 5)) }).map(
                        (_, i) => (
                          <div
                            key={`defender-icon-${i}`}
                            className="w-5 h-5 mx-1 opacity-80"
                            style={{
                              backgroundImage: `url("/assets/ui/icons/${TroopType[targetArmyData.troops.category as TroopType].toLowerCase()}.svg")`,
                              backgroundSize: "contain",
                              backgroundPosition: "center",
                              backgroundRepeat: "no-repeat",
                            }}
                          />
                        ),
                      )}

                      {100 - normalizedAttackerWidth > 20 && (
                        <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs font-bold text-white">
                          {Math.floor(remainingTroops.defenderTroops)} remaining
                        </span>
                      )}
                    </div>

                    {/* Middle Divider */}
                    <div className="absolute h-full" style={{ left: `${normalizedAttackerWidth}%`, width: "2px" }}>
                      <div className="h-full w-full bg-white/30 animate-pulse"></div>
                    </div>

                    {winner && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span
                          className={`px-3 py-0.5 rounded-full text-xs font-bold ${
                            winner === attackerEntityId ? "bg-green-500/80 text-white" : "bg-red-500/80 text-white"
                          }`}
                        >
                          {winner === attackerEntityId ? "VICTORY" : "DEFEAT"}
                        </span>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          {/* Battle Stats Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="p-2 border border-gold/20 rounded-md bg-brown-900/50 text-center">
              <div className="text-xs text-gold/70 mb-1">Attacker Casualties</div>
              <div className="text-lg font-bold text-order-giants">
                {battleSimulation ? Math.ceil(battleSimulation.attackerDamage) : 0}
                <span className="text-xs ml-1">
                  (
                  {battleSimulation
                    ? Math.round(
                        (battleSimulation.attackerDamage / divideByPrecision(Number(attackerArmyData.troops.count))) *
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
                {battleSimulation ? Math.ceil(battleSimulation.defenderDamage) : 0}
                <span className="text-xs ml-1">
                  (
                  {battleSimulation
                    ? Math.round(
                        (battleSimulation.defenderDamage / divideByPrecision(targetArmyData.troops.count)) * 100,
                      )
                    : 0}
                  %)
                </span>
              </div>
            </div>
            <div className="p-2 border border-gold/20 rounded-md bg-brown-900/50 text-center">
              <div className="text-xs text-gold/70 mb-1">Stamina Change</div>
              <div className="text-lg font-bold text-gold">
                {winner === attackerEntityId ? "+" : "-"}
                {battleSimulation ? Math.abs(battleSimulation.newAttackerStamina - Number(attackerStamina)) : 0}
              </div>
            </div>
            <div className="p-2 border border-gold/20 rounded-md bg-brown-900/50 text-center">
              <div className="text-xs text-gold/70 mb-1">Battle Outcome</div>
              <div className={`text-lg font-bold ${winner === attackerEntityId ? "text-green-400" : "text-red-400"}`}>
                {winner === attackerEntityId ? "Victory" : winner === null ? "Draw" : "Defeat"}
              </div>
            </div>
          </div>

          {/* Resources to be stolen section - only show when winner is attacker and target is Army */}
          {winner === attackerEntityId && target?.targetType === TargetType.Army && stealableResourcesUI.length > 0 && (
            <div className="mb-6 p-4 border border-gold/10 rounded bg-brown-900/30">
              <h4 className="text-lg font-medium text-gold/90 mb-4 flex items-center">
                <span className="mr-2">💰</span> Resources You Will Steal
              </h4>
              <div className="max-h-64 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gold/40 scrollbar-track-brown-900/30">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {stealableResourcesUI.map((resource) => (
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
                      <span className="text-lg font-bold text-gold">{resource.amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
            {[
              {
                label: "Attacker Forces (You)",
                troops: remainingTroops.attackerTroops,
                isWinner: winner === attackerEntityId,
                originalTroops: attackerArmyData.troops,
                currentStamina: attackerArmyData.troops
                  ? StaminaManager.getStamina(attackerArmyData.troops, getBlockTimestamp().currentArmiesTick).amount
                  : 0,
                newStamina: battleSimulation?.newAttackerStamina || 0,
                isAttacker: true,
              },
              {
                label: "Defender Forces",
                troops: remainingTroops.defenderTroops,
                isWinner: winner !== null && winner !== attackerEntityId,
                originalTroops: targetArmyData.troops,
                currentStamina: Number(
                  target ? StaminaManager.getStamina(target.info, getBlockTimestamp().currentArmiesTick).amount : 0,
                ),
                newStamina: battleSimulation?.newDefenderStamina || 0,
                isAttacker: false,
              },
            ].map(({ label, troops, isWinner, originalTroops, currentStamina, newStamina, isAttacker }) => (
              <div key={label} className="flex flex-col gap-3 p-4 border border-gold/20 rounded-lg">
                <h4 className="font-bold text-lg">{label}</h4>
                <div className="space-y-4">
                  <div className="p-3 border border-gold/10 rounded">
                    {formatTypeAndBonuses(
                      originalTroops.category as TroopType,
                      originalTroops.tier as TroopTier,
                      configManager.getBiomeCombatBonus(originalTroops.category as TroopType, biome),
                      combatSimulator.calculateStaminaModifier(Number(currentStamina), isAttacker),
                      isAttacker,
                    )}
                    <div className="text-2xl font-bold text-gold">
                      {troops > 0 ? Math.floor(Number(troops)) : 0} /{" "}
                      {Math.floor(divideByPrecision(Number(originalTroops.count)))} troops
                    </div>
                  </div>

                  <div className="p-3 border border-gold/10 rounded">
                    <h4 className="text-sm font-medium text-gold/90 mb-2">Combat Result</h4>
                    <div className="flex items-center gap-2">
                      {isWinner ? (
                        <div className="text-xl font-bold text-green-400 bg-green-900/20 rounded-md px-2 py-1">
                          Victory!
                        </div>
                      ) : winner === null ? (
                        <div className="text-xl font-bold text-yellow-400 bg-yellow-900/20 rounded-md px-2 py-1">
                          Draw
                        </div>
                      ) : (
                        <div className="text-xl font-bold text-red-400 bg-red-900/20 rounded-md px-2 py-1">Defeat</div>
                      )}
                    </div>
                  </div>

                  <div className="p-3 border border-gold/10 rounded">
                    <h4 className="text-sm font-medium text-gold/90 mb-2">Stamina</h4>
                    {getStaminaDisplay(
                      Number(currentStamina),
                      Number(newStamina),
                      isWinner,
                      combatConfig.stamina_bonus_value,
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Troops Message */}
      {!targetArmyData && attackerArmyData && (
        <div className="mt-2 p-6 border border-gold/20 rounded-lg backdrop-blur-sm panel-wood shadow-lg">
          <h3 className="text-2xl font-bold mb-6 text-gold border-b border-gold/20 pb-4">Claim Opportunity</h3>
          <div className="text-center py-4">
            <div className="text-xl font-bold text-green-400 mb-2">No Defending Troops Present!</div>
            {isVillageWithoutTroops ? (
              <p className="text-gold/80 mb-4">Villages cannot be claimed</p>
            ) : (
              <p className="text-gold/80 mb-4">This realm can be claimed without a battle.</p>
            )}
          </div>
        </div>
      )}

      {/* Attack Button */}
      <div className="mt-2 flex justify-center">
        <Button
          variant="primary"
          className={`px-6 py-3 rounded-lg font-bold text-lg transition-colors`}
          isLoading={loading}
          disabled={attackerStamina < combatConfig.stamina_attack_req || !attackerArmyData || isVillageWithoutTroops}
          onClick={onAttack}
        >
          {buttonMessage}
        </Button>
      </div>
    </div>
  );
};
