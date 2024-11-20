import { configManager } from "@/dojo/setup";
import { useDojo } from "@/hooks/context/DojoContext";
import {
  getChancesOfSuccess,
  getMaxResourceAmountStolen,
  getTroopLossOnRaid,
} from "@/ui/modules/military/battle-view/utils";
import { currencyFormat } from "@/ui/utils/utils";
import {
  ResourcesIds,
  TroopConfig as TroopConfigClass,
  TroopsSimulator,
  WORLD_CONFIG_ID,
} from "@bibliothecadao/eternum";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useMemo, useState } from "react";
import { Troops } from "./Troops";

export const PillageSimulationPanel = () => {
  const {
    setup: {
      components: { TroopConfig },
    },
  } = useDojo();

  const defaultTroops = {
    [ResourcesIds.Crossbowman]: 0n,
    [ResourcesIds.Knight]: 0n,
    [ResourcesIds.Paladin]: 0n,
  };
  const [attackingTroopsNumber, setAttackingTroopsNumber] =
    useState<Partial<Record<ResourcesIds, bigint>>>(defaultTroops);
  const [defendingTroopsNumber, setDefendingTroopsNumber] =
    useState<Partial<Record<ResourcesIds, bigint>>>(defaultTroops);

  const troopConfig = useMemo(() => getComponentValue(TroopConfig, getEntityIdFromKeys([WORLD_CONFIG_ID])), []);

  const simulationResults = useMemo(() => {
    if (!troopConfig) return;

    const troopConfigSimulation = new TroopConfigClass(
      troopConfig.health,
      troopConfig.knight_strength,
      troopConfig.paladin_strength,
      troopConfig.crossbowman_strength,
      troopConfig.advantage_percent,
      troopConfig.disadvantage_percent,
      troopConfig.battle_time_scale,
      troopConfig.battle_max_time_seconds,
    );

    const attacker = new TroopsSimulator(
      (attackingTroopsNumber[ResourcesIds.Knight] ?? 0n) * BigInt(configManager.getResourcePrecision()),
      (attackingTroopsNumber[ResourcesIds.Paladin] ?? 0n) * BigInt(configManager.getResourcePrecision()),
      (attackingTroopsNumber[ResourcesIds.Crossbowman] ?? 0n) * BigInt(configManager.getResourcePrecision()),
    );

    const defender = new TroopsSimulator(
      (defendingTroopsNumber[ResourcesIds.Knight] ?? 0n) * BigInt(configManager.getResourcePrecision()),
      (defendingTroopsNumber[ResourcesIds.Paladin] ?? 0n) * BigInt(configManager.getResourcePrecision()),
      (defendingTroopsNumber[ResourcesIds.Crossbowman] ?? 0n) * BigInt(configManager.getResourcePrecision()),
    );

    if (attacker.count() === 0n || defender.count() === 0n) {
      return;
    }

    const attackerArmyInfo = {
      troops: attacker.troops(),
      health: attacker.fullHealth(troopConfigSimulation),
    };

    const defenderArmyInfo = {
      troops: defender.troops(),
      health: defender.fullHealth(troopConfigSimulation),
    };

    const raidSuccessPercentage = getChancesOfSuccess(attackerArmyInfo, defenderArmyInfo, troopConfig) * 100;
    const maxResourceAmountStolen = getMaxResourceAmountStolen(attackerArmyInfo, defenderArmyInfo, troopConfig);
    const [attackerTroopsLoss, defenseTroopsLoss] = getTroopLossOnRaid(attackerArmyInfo, defenderArmyInfo, troopConfig);

    const attackerRemainingTroops = {
      [ResourcesIds.Crossbowman]:
        attackerArmyInfo.troops.crossbowman_count -
        BigInt(attackerTroopsLoss) * (attackerArmyInfo.troops.crossbowman_count / attacker.count()),
      [ResourcesIds.Knight]:
        attackerArmyInfo.troops.knight_count -
        BigInt(
          Math.round(
            Number(attackerTroopsLoss) * (Number(attackerArmyInfo.troops.knight_count) / Number(attacker.count())),
          ),
        ),
      [ResourcesIds.Paladin]:
        attackerArmyInfo.troops.paladin_count -
        BigInt(
          Math.round(
            Number(attackerTroopsLoss) * (Number(attackerArmyInfo.troops.paladin_count) / Number(attacker.count())),
          ),
        ),
    };
    const defenderRemainingTroops = {
      [ResourcesIds.Crossbowman]:
        defenderArmyInfo.troops.crossbowman_count -
        BigInt(
          Math.round(
            Number(defenseTroopsLoss) * (Number(defenderArmyInfo.troops.crossbowman_count) / Number(defender.count())),
          ),
        ),
      [ResourcesIds.Knight]:
        defenderArmyInfo.troops.knight_count -
        BigInt(
          Math.round(
            Number(defenseTroopsLoss) * (Number(defenderArmyInfo.troops.knight_count) / Number(defender.count())),
          ),
        ),
      [ResourcesIds.Paladin]:
        defenderArmyInfo.troops.paladin_count -
        BigInt(
          Math.round(
            Number(defenseTroopsLoss) * (Number(defenderArmyInfo.troops.paladin_count) / Number(defender.count())),
          ),
        ),
    };

    return {
      attackerRemainingTroops,
      defenderRemainingTroops,
      raidSuccessPercentage,
      maxResourceAmountStolen,
      attackerTroopsLoss,
      defenseTroopsLoss,
    };
  }, [attackingTroopsNumber, defendingTroopsNumber, troopConfig]);

  return (
    <div className="w-full mb-4 p-6 rounded-lg shadow-lg">
      <div className="grid grid-cols-2 gap-8">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-4">Raiders</h2>
          <Troops troops={attackingTroopsNumber} setTroops={setAttackingTroopsNumber} />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold mb-4">Defenders</h2>
          <Troops troops={defendingTroopsNumber} setTroops={setDefendingTroopsNumber} />
        </div>
      </div>

      {simulationResults ? (
        <div className="mt-8">
          <h2 className="text-xl font-bold text-center mb-4">Battle Results</h2>

          <div className="grid grid-cols-2 gap-4 text-center mb-8">
            <div className="bg-black rounded-lg p-3">
              <div className="text-sm">Success Chance</div>
              <div className="text-xl font-bold">{simulationResults.raidSuccessPercentage.toFixed(2)}%</div>
            </div>
            <div className="bg-black rounded-lg p-3">
              <div className="text-sm">Resources Stolen</div>
              <div className="text-xl font-bold">{simulationResults.maxResourceAmountStolen}</div>
            </div>
            <div className="bg-black rounded-lg p-3">
              <div className="text-sm">Raiders Lost</div>
              <div className="text-xl font-bold">{currencyFormat(Number(simulationResults.attackerTroopsLoss), 0)}</div>
            </div>
            <div className="bg-black rounded-lg p-3">
              <div className="text-sm">Defenders Lost</div>
              <div className="text-xl font-bold">{currencyFormat(Number(simulationResults.defenseTroopsLoss), 0)}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8">
            {simulationResults.attackerRemainingTroops && (
              <div className="text-center">
                <h3 className="text-lg font-bold mb-3">Raiders Remaining</h3>
                <Troops troops={simulationResults.attackerRemainingTroops} />
              </div>
            )}
            {simulationResults.defenderRemainingTroops && (
              <div className="text-center">
                <h3 className="text-lg font-bold mb-3">Target Remaining</h3>
                <Troops troops={simulationResults.defenderRemainingTroops} />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center mt-8">Please select troops to simulate battle</div>
      )}
    </div>
  );
};
