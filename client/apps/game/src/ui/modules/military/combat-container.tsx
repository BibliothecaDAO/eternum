import { useUIStore } from "@/hooks/store/use-ui-store";
import Button from "@/ui/elements/button";
import { ResourceIcon } from "@/ui/elements/resource-icon";
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
  getTroopResourceId,
  ID,
  RESOURCE_PRECISION,
  resources,
  StaminaManager,
  TroopTier,
  TroopType,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { getComponentValue } from "@dojoengine/recs";
import { useMemo, useState } from "react";
import { formatBiomeBonus, getStaminaDisplay } from "./combat-utils";

enum TargetType {
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
    setup: {
      systemCalls: { attack_explorer_vs_explorer, attack_explorer_vs_guard, attack_guard_vs_explorer },
      components,
      components: { Structure, ExplorerTroops, Tile },
    },
  } = useDojo();

  const [loading, setLoading] = useState(false);
  const [selectedGuardSlot, setSelectedGuardSlot] = useState<number | null>(null);

  const toggleModal = useUIStore((state) => state.toggleModal);

  const selectedHex = useUIStore((state) => state.selectedHex);

  const targetEntity = getComponentValue(Tile, getEntityIdFromKeys([BigInt(targetHex.x), BigInt(targetHex.y)]));

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

        const maxStamina = StaminaManager.getMaxStamina(guard.troops);
        return StaminaManager.getStamina(
          guard.troops.stamina,
          maxStamina,
          getBlockTimestamp().currentArmiesTick,
          components,
        ).amount;
      } else if (selectedGuardSlot !== null) {
        const selectedGuard = structureGuards.find((guard) => guard.slot === selectedGuardSlot);
        if (selectedGuard && selectedGuard.troops.stamina) {
          const maxStamina = StaminaManager.getMaxStamina(selectedGuard.troops);
          return StaminaManager.getStamina(
            selectedGuard.troops.stamina,
            maxStamina,
            getBlockTimestamp().currentArmiesTick,
            components,
          ).amount;
        }
      }
      return 0n;
    }
    return new StaminaManager(components, attackerEntityId).getStamina(getBlockTimestamp().currentArmiesTick).amount;
  }, [attackerEntityId, attackerType, components, selectedGuardSlot, structureGuards]);

  const target = useMemo(() => {
    const occupierId = getEntityIdFromKeys([BigInt(targetEntity?.occupier_id || 0n)]);
    const structure = getComponentValue(Structure, occupierId);
    const explorer = getComponentValue(ExplorerTroops, occupierId);

    if (structure) {
      return {
        info: getGuardsByStructure(structure)[0]?.troops,
        id: targetEntity?.occupier_id,
        targetType: TargetType.Structure,
      };
    }

    if (explorer) {
      return {
        info: getArmy(occupierId, ContractAddress(account.address), components)?.troops,
        id: targetEntity?.occupier_id,
        targetType: TargetType.Army,
      };
    }

    return null;
  }, [targetEntity, account, components]);

  // Get the current army states for display
  const attackerArmyData = useMemo(() => {
    if (attackerType === AttackerType.Structure) {
      if (selectedGuardSlot === null) return null;

      const selectedGuard = structureGuards.find((guard) => guard.slot === selectedGuardSlot);
      if (!selectedGuard) return null;

      return {
        troops: {
          count: Number(selectedGuard.troops.count || 0),
          category: selectedGuard.troops.category as TroopType,
          tier: selectedGuard.troops.tier as TroopTier,
          stamina: selectedGuard.troops.stamina,
        },
      };
    } else {
      const army = getComponentValue(ExplorerTroops, getEntityIdFromKeys([BigInt(attackerEntityId)]));
      return {
        troops: {
          count: Number(army?.troops.count || 0),
          category: army?.troops.category as TroopType,
          tier: army?.troops.tier as TroopTier,
          stamina: army?.troops.stamina,
        },
      };
    }
  }, [attackerEntityId, attackerType, selectedGuardSlot, structureGuards]);

  const targetArmyData = useMemo(() => {
    return {
      troops: {
        count: Number(target?.info?.count || 0),
        category: target?.info?.category as TroopType,
        tier: target?.info?.tier as TroopTier,
        stamina: target?.info?.stamina,
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
  }, [target]);

  const params = configManager.getCombatConfig();
  const combatSimulator = useMemo(() => new CombatSimulator(params), [params]);

  // Simulate battle outcome
  const battleSimulation = useMemo(() => {
    if (!attackerArmyData) return null;

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
    if (attackerTroopsLeft === 0 && defenderTroopsLeft > 0) {
      winner = defenderArmy.entity_id;
    } else if (defenderTroopsLeft === 0 && attackerTroopsLeft > 0) {
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
      <div className="p-4 border border-gold/20 rounded-lg bg-dark-brown/90 backdrop-blur-sm mb-4">
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
                  {TroopType[guard.troops.category as TroopType]} (Slot {guard.slot})
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

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
      {/* Add Biome Info Panel */}
      <div className="p-4 border border-gold/20 rounded-lg bg-dark-brown/90 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gold">Terrain: {biome}</h3>
            <div className="mt-2 grid grid-cols-3 gap-4 text-sm text-gold/80">
              <div>Knights: {formatBiomeBonus(combatSimulator.getBiomeBonus(TroopType.Knight, biome))}</div>
              <div>Crossbowmen: {formatBiomeBonus(combatSimulator.getBiomeBonus(TroopType.Crossbowman, biome))}</div>
              <div>Paladins: {formatBiomeBonus(combatSimulator.getBiomeBonus(TroopType.Paladin, biome))}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Troop Selector for Structure */}
      {TroopSelector()}

      <div className="grid grid-cols-2 gap-6">
        {/* Attacker Panel */}
        <div className="flex flex-col gap-3 p-4 border border-gold/20 rounded-lg bg-dark-brown/90 backdrop-blur-sm">
          <div className="relative z-10">
            <h3 className="text-lg font-semibold text-gold">Attacker Forces</h3>
            {attackerArmyData && (
              <div className="mt-4 space-y-4">
                <div className="text-gold/80">
                  <div className="text-sm font-medium mb-1">
                    {TroopType[attackerArmyData.troops.category as TroopType]}
                    <span className="ml-2 text-xs">
                      {formatBiomeBonus(combatSimulator.getBiomeBonus(attackerArmyData.troops.category, biome))}
                    </span>
                  </div>
                  <div className="text-xl font-bold">{divideByPrecision(attackerArmyData.troops.count)}</div>
                </div>
                {battleSimulation && (
                  <div className="text-gold/80">
                    <div className="text-sm font-medium mb-1">Damage Dealt to Defender</div>
                    <div className="text-xl font-bold text-order-giants">
                      {-Math.ceil(battleSimulation.attackerDamage)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Defender Panel */}
        <div className="flex flex-col gap-3 p-4 border border-gold/20 rounded-lg bg-dark-brown/90 backdrop-blur-sm">
          <div className="relative z-10">
            <h3 className="text-lg font-semibold text-gold">Defender Forces</h3>
            {targetArmyData && (
              <div className="mt-4 space-y-4">
                <div className="text-gold/80">
                  <div className="text-sm font-medium mb-1">
                    {TroopType[targetArmyData.troops.category as TroopType]}
                    <span className="ml-2 text-xs">
                      {formatBiomeBonus(combatSimulator.getBiomeBonus(targetArmyData.troops.category, biome))}
                    </span>
                  </div>
                  <div className="text-xl font-bold">{divideByPrecision(targetArmyData.troops.count)}</div>
                </div>
                {battleSimulation && (
                  <div className="text-gold/80">
                    <div className="text-sm font-medium mb-1">Damage Dealt to Attacker</div>
                    <div className="text-xl font-bold text-order-giants">
                      {-Math.ceil(battleSimulation.defenderDamage)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Battle Results */}
      {remainingTroops && attackerArmyData && targetArmyData && (
        <div className="mt-2 p-6 border border-gold/20 rounded-lg bg-dark-brown/90 backdrop-blur-sm shadow-lg">
          <h3 className="text-2xl font-bold mb-6 text-gold border-b border-gold/20 pb-4">Battle Prediction</h3>
          <div className="grid grid-cols-2 gap-8">
            {[
              {
                label: "Attacker",
                troops: remainingTroops.attackerTroops,
                isWinner: winner === attackerEntityId,
                originalTroops: attackerArmyData.troops,
                currentStamina: Number(
                  StaminaManager.getStamina(
                    attackerArmyData.troops.stamina || { amount: 0n, updated_tick: 0n },
                    StaminaManager.getMaxStamina({
                      count: BigInt(attackerArmyData.troops.count),
                      category: attackerArmyData.troops.category,
                      tier: attackerArmyData.troops.tier,
                      stamina: attackerArmyData.troops.stamina || { amount: 0n, updated_tick: 0n },
                    }),
                    getBlockTimestamp().currentArmiesTick,
                    components,
                  ).amount,
                ),
                newStamina: battleSimulation?.newAttackerStamina || 0,
              },
              {
                label: "Defender",
                troops: remainingTroops.defenderTroops,
                isWinner: winner !== null && winner !== attackerEntityId,
                originalTroops: targetArmyData.troops,
                currentStamina: Number(
                  StaminaManager.getStamina(
                    target?.info?.stamina || { amount: 0n, updated_tick: 0n },
                    StaminaManager.getMaxStamina(
                      target?.info
                        ? {
                            count: BigInt(Number(target.info.count || 0)),
                            category: target.info.category,
                            tier: target.info.tier,
                            stamina: target.info.stamina || { amount: 0n, updated_tick: 0n },
                          }
                        : undefined,
                    ),
                    getBlockTimestamp().currentArmiesTick,
                    components,
                  ).amount,
                ),
                newStamina: battleSimulation?.newDefenderStamina || 0,
              },
            ].map(({ label, troops, isWinner, originalTroops, currentStamina, newStamina }) => (
              <div
                key={label}
                className="relative p-4 rounded-lg border border-gold/10"
                style={{
                  backgroundImage: originalTroops
                    ? `linear-gradient(rgba(20, 16, 13, 0.7), rgba(20, 16, 13, 0.7)), url(/images/resources/${getTroopResourceId(
                        originalTroops.category as TroopType,
                        originalTroops.tier as TroopTier,
                      )}.png)`
                    : undefined,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                <div className="relative z-10 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xl text-gold">{label}</h4>
                    {isWinner && (
                      <span className="px-2 py-1 bg-green-900/50 text-green-400 text-sm font-medium rounded border border-green-400/30">
                        Victory!
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-gold/80">
                      <div className="text-sm font-medium mb-1">Remaining Forces</div>
                      <div className="text-xl font-bold flex items-baseline">
                        {troops > 0 ? Math.floor(troops) : 0}
                        <span className="text-xs ml-2 text-gold/50">
                          / {Math.floor(divideByPrecision(originalTroops.count))}
                        </span>
                      </div>
                    </div>

                    {getStaminaDisplay(currentStamina, newStamina, isWinner, combatConfig.stamina_bonus_value)}
                  </div>

                  <div className="text-gold/80">
                    <div className="text-sm font-medium mb-1">Biome Bonus</div>
                    <div>{formatBiomeBonus(combatSimulator.getBiomeBonus(originalTroops.category, biome))}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attack Button */}
      <div className="mt-2 flex justify-center">
        <Button
          variant="primary"
          className={`px-6 py-3 rounded-lg font-bold text-lg transition-colors`}
          isLoading={loading}
          disabled={attackerStamina < combatConfig.stamina_attack_req || !attackerArmyData}
          onClick={onAttack}
        >
          {attackerStamina >= combatConfig.stamina_attack_req && attackerArmyData
            ? "Attack!"
            : `Not Enough Stamina (${combatConfig.stamina_attack_req} Required)`}
        </Button>
      </div>
    </div>
  );
};
