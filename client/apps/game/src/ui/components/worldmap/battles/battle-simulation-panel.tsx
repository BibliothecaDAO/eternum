import { Troops } from "@/ui/components/worldmap/battles/troops";
import {
  BattleSimulator,
  configManager,
  formatTime,
  ResourcesIds,
  TroopConfig as TroopConfigClass,
  TroopsSimulator,
  WORLD_CONFIG_ID,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useMemo, useState } from "react";

export const BattleSimulationPanel = () => {
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
  const battle = useMemo(() => {
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
    return new BattleSimulator(
      attacker,
      defender,
      attacker.fullHealth(troopConfigSimulation),
      defender.fullHealth(troopConfigSimulation),
      troopConfigSimulation,
    );
  }, [attackingTroopsNumber, defendingTroopsNumber, troopConfig]);

  const remainingTroops = useMemo(() => {
    if (!battle) return;
    const remainingTroops = battle.getRemainingTroops();

    const attackerRemainingTroops = {
      [ResourcesIds.Crossbowman]: remainingTroops.attackerTroops.crossbowman_count || 0n,
      [ResourcesIds.Knight]: remainingTroops.attackerTroops.knight_count || 0n,
      [ResourcesIds.Paladin]: remainingTroops.attackerTroops.paladin_count || 0n,
    };
    const defenderRemainingTroops = {
      [ResourcesIds.Crossbowman]: remainingTroops.defenderTroops.crossbowman_count || 0n,
      [ResourcesIds.Knight]: remainingTroops.defenderTroops.knight_count || 0n,
      [ResourcesIds.Paladin]: remainingTroops.defenderTroops.paladin_count || 0n,
    };

    return { attackerRemainingTroops, defenderRemainingTroops };
  }, [battle]);

  return (
    <div className="w-full mb-4 p-6 rounded-lg shadow-lg">
      <div className="grid grid-cols-2 gap-8">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-4">Attackers</h2>
          <Troops troops={attackingTroopsNumber} setTroops={setAttackingTroopsNumber} />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold mb-4">Defenders</h2>
          <Troops troops={defendingTroopsNumber} setTroops={setDefendingTroopsNumber} />
        </div>
      </div>

      {remainingTroops && (
        <div className="mt-8">
          <h2 className="text-xl font-bold text-center mb-4">Battle Results</h2>

          <div className="text-center mb-8">
            <div className="bg-black rounded-lg p-3">
              <div className="text-sm">Battle Duration</div>
              <div className="text-xl font-bold">⏳ {formatTime(battle?.calculateDuration() ?? 0)}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div className="text-center">
              <h3 className="text-lg font-bold mb-3">Attackers Remaining</h3>
              <Troops troops={remainingTroops.attackerRemainingTroops} />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold mb-3">Defenders Remaining</h3>
              <Troops troops={remainingTroops.defenderRemainingTroops} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
