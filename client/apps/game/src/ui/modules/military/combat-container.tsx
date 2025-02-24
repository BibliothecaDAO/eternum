import Button from "@/ui/elements/button";
import { getBlockTimestamp } from "@/utils/timestamp";
import {
  Biome,
  CombatSimulator,
  configManager,
  ContractAddress,
  divideByPrecision,
  getArmy,
  getEntityIdFromKeys,
  getStructure,
  ID,
  StaminaManager,
  TroopType,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { getComponentValue } from "@dojoengine/recs";
import { useMemo } from "react";
import { formatBiomeBonus, getStaminaDisplay, getTroopResourceId } from "./combat-utils";

enum TargetType {
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
      components,
      components: { Structure, ExplorerTroops, Occupier },
    },
  } = useDojo();

  const targetEntity = getComponentValue(Occupier, getEntityIdFromKeys([BigInt(targetHex.x), BigInt(targetHex.y)]));

  const staminaCombatConfig = useMemo(() => {
    return configManager.getStaminaCombatConfig();
  }, [components]);

  const biome = useMemo(() => {
    return Biome.getBiome(targetHex.x, targetHex.y);
  }, [targetHex]);

  const attackerStamina = useMemo(() => {
    return new StaminaManager(components, attackerEntityId).getStamina(getBlockTimestamp().currentArmiesTick).amount;
  }, [attackerEntityId]);

  const target = useMemo(() => {
    const occupierId = getEntityIdFromKeys([BigInt(targetEntity?.occupier || 0n)]);
    const structure = getComponentValue(Structure, occupierId);
    const explorer = getComponentValue(ExplorerTroops, occupierId);

    if (structure) {
      return {
        info: getStructure(occupierId, ContractAddress(account.address), components),
        targetType: TargetType.Structure,
      };
    }

    if (explorer) {
      return {
        info: getArmy(occupierId, ContractAddress(account.address), components),
        targetType: TargetType.Army,
      };
    }

    return null;
  }, [targetEntity, account, components]);

  const defenderStamina = useMemo(() => {
    return new StaminaManager(components, target?.info?.entityId || 0).getStamina(getBlockTimestamp().currentArmiesTick)
      .amount;
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

    const targetId = target.info?.entityId;
    if (!targetId) return null;

    const targetArmy = getComponentValue(ExplorerTroops, getEntityIdFromKeys([BigInt(targetId)]));

    const attackerArmyComponent = getComponentValue(ExplorerTroops, getEntityIdFromKeys([BigInt(attackerEntityId)]));

    if (!attackerArmyComponent || !targetArmy) return null;

    // Convert game armies to simulator armies
    const attackerArmy = {
      entity_id: attackerEntityId,
      stamina: Number(attackerStamina),
      troopCount: Number(attackerArmyComponent.troops.count),
      troopType: attackerArmyComponent.troops.category as TroopType,
      tier: Number(attackerArmyComponent.troops.tier) as 1 | 2 | 3,
    };

    const defenderArmy = {
      entity_id: targetId,
      stamina: Number(defenderStamina),
      troopCount: Number(targetArmy.troops.count),
      troopType: targetArmy.troops.category as TroopType,
      tier: Number(targetArmy.troops.tier) as 1 | 2 | 3,
    };

    const params = CombatSimulator.getDefaultParameters();
    const result = CombatSimulator.simulateBattleWithParams(attackerArmy, defenderArmy, biome, params);

    const attackerTroopsLost = Math.min(attackerArmy.troopCount, Math.ceil(result.defenderDamage));
    const defenderTroopsLost = Math.min(defenderArmy.troopCount, Math.ceil(result.attackerDamage));

    const attackerTroopsLeft = attackerArmy.troopCount - attackerTroopsLost;
    const defenderTroopsLeft = defenderArmy.troopCount - defenderTroopsLost;

    const winner =
      attackerTroopsLeft === 0 ? defenderArmy.entity_id : defenderTroopsLeft === 0 ? attackerArmy.entity_id : null;

    let newAttackerStamina = Number(attackerStamina) - staminaCombatConfig.staminaCost;
    let newDefenderStamina =
      Number(defenderStamina) - Math.min(staminaCombatConfig.staminaCost, Number(defenderStamina));

    if (attackerTroopsLeft <= 0 && defenderTroopsLeft > 0) {
      newDefenderStamina += staminaCombatConfig.staminaBonus;
    } else if (defenderTroopsLeft <= 0 && attackerTroopsLeft > 0) {
      newAttackerStamina += staminaCombatConfig.staminaBonus;
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
  }, [attackerEntityId, target, account, components, attackerStamina, defenderStamina]);

  const remainingTroops = battleSimulation?.getRemainingTroops();
  const winner = battleSimulation?.winner;

  // Get the current army states for display
  const attackerArmyData = useMemo(() => {
    const army = getComponentValue(ExplorerTroops, getEntityIdFromKeys([BigInt(attackerEntityId)]));

    return {
      ...army,
      troops: {
        count: Number(army?.troops.count || 0),
        category: army?.troops.category as TroopType,
        tier: Number(army?.troops.tier) as 1 | 2 | 3,
      },
    };
  }, [attackerEntityId]);

  const targetArmyData = useMemo(() => {
    if (!target?.info?.entityId) return null;
    const army = getComponentValue(ExplorerTroops, getEntityIdFromKeys([BigInt(target.info.entityId)]));

    return {
      ...army,
      troops: {
        count: Number(army?.troops.count || 0),
        category: army?.troops.category as TroopType,
        tier: Number(army?.troops.tier) as 1 | 2 | 3,
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
                    {TroopType[attackerArmyData.troops.category]}
                    <span className="ml-2 text-xs">
                      {formatBiomeBonus(CombatSimulator.getBiomeBonus(attackerArmyData.troops.category, biome))}
                    </span>
                  </div>
                  <div className="text-xl font-bold">{divideByPrecision(attackerArmyData.troops.count)}</div>
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
                    {TroopType[targetArmyData.troops.category]}
                    <span className="ml-2 text-xs">
                      {formatBiomeBonus(CombatSimulator.getBiomeBonus(targetArmyData.troops.category, biome))}
                    </span>
                  </div>
                  <div className="text-xl font-bold">{divideByPrecision(targetArmyData.troops.count)}</div>
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
                  new StaminaManager(components, target?.info?.entityId || 0).getStamina(
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
                        originalTroops.category,
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
                        {Math.floor(divideByPrecision(troops))}
                        <span className="text-xs ml-2 text-gold/50">
                          / {Math.floor(divideByPrecision(originalTroops.count))}
                        </span>
                      </div>
                    </div>

                    {getStaminaDisplay(currentStamina, newStamina, isWinner, staminaCombatConfig.staminaBonus)}
                  </div>

                  <div className="text-gold/80">
                    <div className="text-sm font-medium mb-1">Biome Bonus</div>
                    <div>{formatBiomeBonus(CombatSimulator.getBiomeBonus(originalTroops.category, biome))}</div>
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
          disabled={attackerStamina < staminaCombatConfig.staminaCost}
          // todo: add attack tx
          onClick={() => console.log("ATTACKKKKKK")}
        >
          {attackerStamina >= staminaCombatConfig.staminaCost
            ? "Attack!"
            : `Not Enough Stamina (${staminaCombatConfig.staminaCost} Required)`}
        </Button>
      </div>
    </div>
  );
};
