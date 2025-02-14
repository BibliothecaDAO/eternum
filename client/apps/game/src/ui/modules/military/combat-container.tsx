import Button from "@/ui/elements/button";
import { getBlockTimestamp } from "@/utils/timestamp";
import {
  Biome,
  CombatSimulator,
  ContractAddress,
  divideByPrecision,
  getArmy,
  getEntityIdFromKeys,
  getStructure,
  ID,
  ResourcesIds,
  StaminaManager,
  TroopType,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { useEntityQuery } from "@dojoengine/react";
import { getComponentValue, Has, HasValue } from "@dojoengine/recs";
import { useMemo } from "react";

enum TargetType {
  Structure,
  Army,
}

const getTroopResourceId = (troopType: TroopType): number => {
  const TROOP_RESOURCES = [
    { type: TroopType.Knight, resourceId: ResourcesIds.Knight },
    { type: TroopType.Crossbowman, resourceId: ResourcesIds.Crossbowman },
    { type: TroopType.Paladin, resourceId: ResourcesIds.Paladin },
  ];
  return TROOP_RESOURCES.find((t) => t.type === troopType)?.resourceId || ResourcesIds.Knight;
};

// Add this helper function to format bonus as percentage
const formatBiomeBonus = (bonus: number) => {
  const percentage = ((bonus - 1) * 100).toFixed(0);
  if (percentage === "0") return "No bonus";
  return percentage.startsWith("-") ? (
    <span className="text-order-giants">{percentage}%</span>
  ) : (
    <span className="text-order-brilliance">+{percentage}%</span>
  );
};

// Add this helper function to format stamina changes
const getStaminaDisplay = (currentStamina: number, newStamina: number, isWinner: boolean) => {
  return (
    <div className="text-gold/80">
      <div className="text-sm font-medium mb-1">Stamina</div>
      <div className="text-xl font-bold flex items-baseline">
        {Math.max(0, newStamina)}
        <span className="text-xs ml-2 text-gold/50">/ {currentStamina}</span>
        {isWinner && <span className="text-xs ml-2 text-green-400">(+30)</span>}
      </div>
    </div>
  );
};

// Determine dominant troop type and count
const getDominantTroopInfo = (troops: { knight_count: number; paladin_count: number; crossbowman_count: number }) => {
  const knightCount = troops.knight_count;
  const crossbowmanCount = troops.crossbowman_count;
  const paladinCount = troops.paladin_count;

  if (knightCount >= crossbowmanCount && knightCount >= paladinCount) {
    return { type: TroopType.Knight, count: knightCount, label: "Knights" };
  }
  if (crossbowmanCount >= knightCount && crossbowmanCount >= paladinCount) {
    return { type: TroopType.Crossbowman, count: crossbowmanCount, label: "Crossbowmen" };
  }
  return { type: TroopType.Paladin, count: paladinCount, label: "Paladins" };
};

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
      components,
      components: { Position, Army, Structure, Health },
    },
  } = useDojo();

  // Get target entity on the hex (army or structure)
  const targetEntities = useEntityQuery([Has(Position), HasValue(Position, { x: targetHex.x, y: targetHex.y })]);

  const biome = useMemo(() => {
    return Biome.getBiome(targetHex.x, targetHex.y);
  }, [targetEntities]);

  const attackerStamina = useMemo(() => {
    return new StaminaManager(components, attackerEntityId).getStamina(getBlockTimestamp().currentArmiesTick).amount;
  }, [attackerEntityId]);

  const target = useMemo(() => {
    if (!targetEntities.length) return null;

    const targetEntity = targetEntities[0];
    const structure = getComponentValue(Structure, targetEntity);
    const army = getComponentValue(Army, targetEntity);

    if (structure) {
      return {
        info: getStructure(targetEntity, ContractAddress(account.address), components),
        targetType: TargetType.Structure,
      };
    }

    if (army) {
      return {
        info: getArmy(targetEntity, ContractAddress(account.address), components),
        targetType: TargetType.Army,
      };
    }

    return null;
  }, [targetEntities, account, components]);

  const defenderStamina = useMemo(() => {
    return new StaminaManager(components, target?.info?.entity_id || 0).getStamina(
      getBlockTimestamp().currentArmiesTick,
    ).amount;
  }, [target]);

  // If target is a structure, show WIP message
  if (target?.targetType === TargetType.Structure) {
    return (
      <div className="flex flex-col items-center justify-center p-6 max-w-4xl mx-auto">
        <div className="p-6 border border-gold/20 rounded-lg bg-dark-brown/90 backdrop-blur-sm text-center">
          <h3 className="text-2xl font-bold text-gold mb-4">Structure Combat</h3>
          <p className="text-gold/80">Combat against structures is currently being worked on. Check back soon!</p>
        </div>
      </div>
    );
  }

  // Simulate battle outcome
  const battleSimulation = useMemo(() => {
    if (!target || target.targetType === TargetType.Structure) return null;

    const targetId = target.info?.entity_id;
    if (!targetId) return null;

    const targetArmy = getComponentValue(Army, getEntityIdFromKeys([BigInt(targetId)]));
    const targetArmyEntity = {
      ...targetArmy,
      troops: {
        knight_count: Number(targetArmy?.troops.knight_count || 0),
        paladin_count: Number(targetArmy?.troops.paladin_count || 0),
        crossbowman_count: Number(targetArmy?.troops.crossbowman_count || 0),
      },
    };

    const attackerArmyComponent = getComponentValue(Army, getEntityIdFromKeys([BigInt(attackerEntityId)]));
    const attackerArmyEntity = {
      ...attackerArmyComponent,
      troops: {
        knight_count: Number(attackerArmyComponent?.troops.knight_count || 0),
        paladin_count: Number(attackerArmyComponent?.troops.paladin_count || 0),
        crossbowman_count: Number(attackerArmyComponent?.troops.crossbowman_count || 0),
      },
    };

    const attackerHealth = getComponentValue(Health, getEntityIdFromKeys([BigInt(attackerEntityId)]));
    const targetHealth = getComponentValue(Health, getEntityIdFromKeys([BigInt(targetId)]));

    if (!attackerArmyEntity || !targetArmyEntity || !attackerHealth || !targetHealth) return null;

    // Convert game armies to simulator armies
    const attackerArmy = {
      entity_id: attackerEntityId,
      stamina: attackerStamina,
      troopCount:
        Number(attackerArmyEntity.troops.knight_count) +
        Number(attackerArmyEntity.troops.paladin_count) +
        Number(attackerArmyEntity.troops.crossbowman_count),
      troopType: getDominantTroopInfo(attackerArmyEntity.troops).type, // You may want to determine dominant troop type
      tier: 1 as 1 | 2 | 3, // You may want to determine tier from game state
    };

    const defenderArmy = {
      entity_id: targetId,
      stamina: defenderStamina,
      troopCount:
        Number(targetArmyEntity.troops.knight_count) +
        Number(targetArmyEntity.troops.paladin_count) +
        Number(targetArmyEntity.troops.crossbowman_count),
      troopType: getDominantTroopInfo(targetArmyEntity.troops).type, // You may want to determine dominant troop type
      tier: 1 as 1 | 2 | 3, // You may want to determine tier from game state
    };

    // Use default parameters for simulation
    const params = CombatSimulator.getDefaultParameters();

    // Simulate battle with default biome (Grassland) for now
    // You may want to get actual biome from game state
    const result = CombatSimulator.simulateBattleWithParams(attackerArmy, defenderArmy, biome, params);

    // Calculate remaining troops based on damage
    const attackerTroopsLost = Math.min(attackerArmy.troopCount, Math.ceil(result.defenderDamage));
    const defenderTroopsLost = Math.min(defenderArmy.troopCount, Math.ceil(result.attackerDamage));

    const attackerTroopsLeft = attackerArmy.troopCount - attackerTroopsLost;
    const defenderTroopsLeft = defenderArmy.troopCount - defenderTroopsLost;

    // Only set winner if one side is completely eliminated
    const winner =
      attackerTroopsLeft === 0 ? defenderArmy.entity_id : defenderTroopsLeft === 0 ? attackerArmy.entity_id : null;

    // Calculate stamina changes
    const staminaCost = 30;
    let newAttackerStamina = attackerStamina - staminaCost;
    let newDefenderStamina = defenderStamina - Math.min(staminaCost, defenderStamina);

    // Add bonus stamina to winner if one side is eliminated
    if (attackerTroopsLeft <= 0 && defenderTroopsLeft > 0) {
      newDefenderStamina += 30;
    } else if (defenderTroopsLeft <= 0 && attackerTroopsLeft > 0) {
      newAttackerStamina += 30;
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
        attackerTroops: {
          knight_count: Math.ceil(
            Number(attackerArmyEntity.troops.knight_count) * (1 - attackerTroopsLost / attackerArmy.troopCount),
          ),
          paladin_count: Math.ceil(
            Number(attackerArmyEntity.troops.paladin_count) * (1 - attackerTroopsLost / attackerArmy.troopCount),
          ),
          crossbowman_count: Math.ceil(
            Number(attackerArmyEntity.troops.crossbowman_count) * (1 - attackerTroopsLost / attackerArmy.troopCount),
          ),
        },
        defenderTroops: {
          knight_count: Math.ceil(
            Number(targetArmyEntity.troops.knight_count) * (1 - defenderTroopsLost / defenderArmy.troopCount),
          ),
          paladin_count: Math.ceil(
            Number(targetArmyEntity.troops.paladin_count) * (1 - defenderTroopsLost / defenderArmy.troopCount),
          ),
          crossbowman_count: Math.ceil(
            Number(targetArmyEntity.troops.crossbowman_count) * (1 - defenderTroopsLost / defenderArmy.troopCount),
          ),
        },
      }),
    };
  }, [attackerEntityId, target, account, components, attackerStamina, defenderStamina]);

  const remainingTroops = battleSimulation?.getRemainingTroops();
  const winner = battleSimulation?.winner;

  // Get the current army states for display
  const attackerArmyData = useMemo(() => {
    const army = getComponentValue(Army, getEntityIdFromKeys([BigInt(attackerEntityId)]));

    return {
      ...army,
      troops: {
        knight_count: Number(army?.troops.knight_count || 0),
        paladin_count: Number(army?.troops.paladin_count || 0),
        crossbowman_count: Number(army?.troops.crossbowman_count || 0),
      },
    };
  }, [attackerEntityId]);

  const targetArmyData = useMemo(() => {
    if (!target?.info?.entity_id) return null;
    const army = getComponentValue(Army, getEntityIdFromKeys([BigInt(target.info.entity_id)]));

    return {
      ...army,
      troops: {
        knight_count: Number(army?.troops.knight_count || 0),
        paladin_count: Number(army?.troops.paladin_count || 0),
        crossbowman_count: Number(army?.troops.crossbowman_count || 0),
      },
    };
  }, [target]);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
      {/* Add Biome Info Panel */}
      <div className="p-4 border border-gold/20 rounded-lg bg-dark-brown/90 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gold">Terrain: {biome}</h3>
            <div className="mt-2 grid grid-cols-3 gap-4 text-sm text-gold/80">
              <div>Knights: {formatBiomeBonus(CombatSimulator.getBiomeBonus(TroopType.Knight, biome))}</div>
              <div>Crossbowmen: {formatBiomeBonus(CombatSimulator.getBiomeBonus(TroopType.Crossbowman, biome))}</div>
              <div>Paladins: {formatBiomeBonus(CombatSimulator.getBiomeBonus(TroopType.Paladin, biome))}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Attacker Panel */}
        <div className="flex flex-col gap-3 p-4 border border-gold/20 rounded-lg bg-dark-brown/90 backdrop-blur-sm">
          <div className="relative z-10">
            <h3 className="text-lg font-semibold text-gold">Attacker Forces</h3>
            {attackerArmyData && (
              <div className="mt-4 space-y-4">
                <div className="text-gold/80">
                  <div className="text-sm font-medium mb-1">
                    {getDominantTroopInfo(attackerArmyData.troops).label}
                    <span className="ml-2 text-xs">
                      {formatBiomeBonus(
                        CombatSimulator.getBiomeBonus(getDominantTroopInfo(attackerArmyData.troops).type, biome),
                      )}
                    </span>
                  </div>
                  <div className="text-xl font-bold">
                    {divideByPrecision(getDominantTroopInfo(attackerArmyData.troops).count)}
                  </div>
                </div>
                {battleSimulation && (
                  <div className="text-gold/80">
                    <div className="text-sm font-medium mb-1">Damage to Defender</div>
                    <div className="text-xl font-bold text-order-giants">
                      {-Math.ceil(divideByPrecision(battleSimulation.attackerDamage))}
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
                    {getDominantTroopInfo(targetArmyData.troops).label}
                    <span className="ml-2 text-xs">
                      {formatBiomeBonus(
                        CombatSimulator.getBiomeBonus(getDominantTroopInfo(targetArmyData.troops).type, biome),
                      )}
                    </span>
                  </div>
                  <div className="text-xl font-bold">
                    {divideByPrecision(getDominantTroopInfo(targetArmyData.troops).count)}
                  </div>
                </div>
                {battleSimulation && (
                  <div className="text-gold/80">
                    <div className="text-sm font-medium mb-1">Damage to Attacker</div>
                    <div className="text-xl font-bold text-order-giants">
                      {-Math.ceil(divideByPrecision(battleSimulation.defenderDamage))}
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
                  new StaminaManager(components, attackerEntityId).getStamina(getBlockTimestamp().currentArmiesTick)
                    .amount,
                ),
                newStamina: battleSimulation?.newAttackerStamina || 0,
              },
              {
                label: "Defender",
                troops: remainingTroops.defenderTroops,
                isWinner: winner !== null && winner !== attackerEntityId,
                originalTroops: targetArmyData.troops,
                currentStamina: Number(
                  new StaminaManager(components, target?.info?.entity_id || 0).getStamina(
                    getBlockTimestamp().currentArmiesTick,
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
                        getDominantTroopInfo(originalTroops).type,
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
                        {Math.floor(divideByPrecision(getDominantTroopInfo(troops).count))}
                        <span className="text-xs ml-2 text-gold/50">
                          / {Math.floor(divideByPrecision(getDominantTroopInfo(originalTroops).count))}
                        </span>
                      </div>
                    </div>

                    {getStaminaDisplay(currentStamina, newStamina, isWinner)}
                  </div>

                  <div className="text-gold/80">
                    <div className="text-sm font-medium mb-1">Biome Bonus</div>
                    <div>
                      {formatBiomeBonus(
                        CombatSimulator.getBiomeBonus(getDominantTroopInfo(originalTroops).type, biome),
                      )}
                    </div>
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
          disabled={attackerStamina < 30}
          onClick={() => console.log("ATTACKKKKKK")}
        >
          {attackerStamina >= 30 ? "Attack!" : "Not Enough Stamina (30 Required)"}
        </Button>
      </div>
    </div>
  );
};
