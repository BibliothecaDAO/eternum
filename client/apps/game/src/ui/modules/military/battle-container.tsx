import {
  BattleSimulator,
  ContractAddress,
  getArmy,
  getEntityIdFromKeys,
  getStructure,
  TroopConfig,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { useEntityQuery } from "@dojoengine/react";
import { getComponentValue, Has, HasValue } from "@dojoengine/recs";
import { useMemo } from "react";

enum TargetType {
  Structure,
  Army,
}

export const BattleContainer = ({
  attackerEntityId,
  targetHex,
}: {
  attackerEntityId: string;
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

  // Simulate battle outcome
  const battleSimulation = useMemo(() => {
    if (!target || target.targetType === TargetType.Structure) return null;

    const targetId = target.info?.entity_id;

    if (!targetId) return null;

    const targetArmyEntity = getComponentValue(Army, getEntityIdFromKeys([BigInt(targetId)]));
    const attackerArmyEntity = getComponentValue(Army, getEntityIdFromKeys([BigInt(attackerEntityId)]));

    const attackerHealth = getComponentValue(Health, getEntityIdFromKeys([BigInt(attackerEntityId)]));
    const targetHealth = getComponentValue(Health, getEntityIdFromKeys([BigInt(targetId)]));

    if (!attackerArmyEntity || !targetArmyEntity || !attackerHealth || !targetHealth) return null;

    // Example troop config - should come from game config
    const config = new TroopConfig(
      100, // health
      10, // knight strength
      12, // paladin strength
      8, // crossbowman strength
      2000, // advantage percent (20%)
      1000, // disadvantage percent (10%)
      100, // battle time scale
      300, // max battle time seconds
    );

    return new BattleSimulator(
      attackerArmyEntity.troops,
      targetArmyEntity.troops,
      attackerHealth,
      targetHealth,
      config,
    );
  }, [attackerEntityId, target, account, components]);

  const remainingTroops = battleSimulation?.getRemainingTroops();
  const winner = battleSimulation?.getWinner();
  const duration = battleSimulation?.calculateDuration();

  // Get the current army states for display
  const attackerArmyData = useMemo(() => {
    return getComponentValue(Army, getEntityIdFromKeys([BigInt(attackerEntityId)]));
  }, [attackerEntityId]);

  const targetArmyData = useMemo(() => {
    if (!target?.info?.entity_id) return null;
    return getComponentValue(Army, getEntityIdFromKeys([BigInt(target.info.entity_id)]));
  }, [target]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold">Battle</h2>

        {/* Attacker Info */}
        <div className="p-4 bg-gray-800 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Attacker Forces</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>Knights: {attackerArmyData?.troops.knight_count.toString()}</div>
            <div>Paladins: {attackerArmyData?.troops.paladin_count.toString()}</div>
            <div>Crossbowmen: {attackerArmyData?.troops.crossbowman_count.toString()}</div>
          </div>
        </div>

        {/* Defender Info */}
        <div className="p-4 bg-gray-800 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Defender Forces</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>Knights: {targetArmyData?.troops.knight_count.toString() || "0"}</div>
            <div>Paladins: {targetArmyData?.troops.paladin_count.toString() || "0"}</div>
            <div>Crossbowmen: {targetArmyData?.troops.crossbowman_count.toString() || "0"}</div>
          </div>
        </div>

        {/* Battle Simulation */}
        {remainingTroops && (
          <div className="p-4 bg-gray-700 rounded-lg mt-4">
            <h3 className="text-lg font-semibold mb-2">Battle Prediction</h3>
            <div className="space-y-2">
              <div>Expected Duration: {duration} turns</div>
              <div>Predicted Winner: {winner === attackerArmyData ? "Attacker" : "Defender"}</div>

              <div className="mt-4">
                <h4 className="font-medium">Remaining Forces:</h4>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <h5 className="font-medium">Attacker</h5>
                    <div>Knights: {remainingTroops.attackerTroops.knight_count.toString()}</div>
                    <div>Paladins: {remainingTroops.attackerTroops.paladin_count.toString()}</div>
                    <div>Crossbowmen: {remainingTroops.attackerTroops.crossbowman_count.toString()}</div>
                  </div>
                  <div>
                    <h5 className="font-medium">Defender</h5>
                    <div>Knights: {remainingTroops.defenderTroops.knight_count.toString()}</div>
                    <div>Paladins: {remainingTroops.defenderTroops.paladin_count.toString()}</div>
                    <div>Crossbowmen: {remainingTroops.defenderTroops.crossbowman_count.toString()}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
