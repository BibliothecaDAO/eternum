import { configManager } from "@/dojo/setup";
import { useDojo } from "@/hooks/context/DojoContext";
import { NumberInput } from "@/ui/elements/NumberInput";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { currencyFormat, formatTime } from "@/ui/utils/utils";
import {
  Battle,
  ResourcesIds,
  TroopConfig as TroopConfigClass,
  TroopsSimulator,
  WORLD_CONFIG_ID,
} from "@bibliothecadao/eternum";
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
    return new Battle(
      attacker,
      defender,
      { current: attacker.fullHealth(troopConfigSimulation), lifetime: attacker.fullHealth(troopConfigSimulation) },
      { current: defender.fullHealth(troopConfigSimulation), lifetime: defender.fullHealth(troopConfigSimulation) },
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
    <div className="w-full mb-2">
      <div className="p-2 flex flex-row justify-around gap-4 mx-auto">
        <Troops troops={attackingTroopsNumber} setTroops={setAttackingTroopsNumber} />
        <Troops troops={defendingTroopsNumber} setTroops={setDefendingTroopsNumber} />
      </div>
      <div className="h1 text-xl mx-auto text-center">Battle results</div>
      <div className="p-2 flex flex-row justify-around gap-4 mx-auto">
        {remainingTroops && <Troops troops={remainingTroops.attackerRemainingTroops} />}
        {remainingTroops && <Troops troops={remainingTroops.defenderRemainingTroops} />}
      </div>
      {battle && <div className="text-center text-lg">⏳ {formatTime(battle?.calculateDuration() ?? 0)}</div>}
    </div>
  );
};

const Troops = ({
  troops,
  setTroops,
}: {
  troops: Partial<Record<ResourcesIds, bigint>>;
  setTroops?: React.Dispatch<React.SetStateAction<Partial<Record<ResourcesIds, bigint>>>>;
}) => {
  return (
    <div className={`grid grid-${setTroops ? "rows" : "cols"}-3`}>
      {Object.entries(troops).map(([resource, count]) => (
        <div className={`p-2 bg-gold/10 hover:bg-gold/30 `} key={resource}>
          <div className="font-bold mb-4">
            <div className="flex justify-between text-center">
              <div className="text-md">
                {(ResourcesIds[resource as keyof typeof ResourcesIds] as unknown as string).length > 7
                  ? (ResourcesIds[resource as keyof typeof ResourcesIds] as unknown as string).slice(0, 7) + "..."
                  : ResourcesIds[resource as keyof typeof ResourcesIds]}
              </div>
            </div>
            <div className="py-1 flex flex-row justify-between">
              <ResourceIcon
                withTooltip={false}
                resource={ResourcesIds[resource as keyof typeof ResourcesIds] as unknown as string}
                size="lg"
              />
              {!setTroops && <div className="text-lg w-full">{currencyFormat(Number(count), 0)}</div>}
              {setTroops && (
                <NumberInput
                  min={0}
                  step={100}
                  value={Number(count)}
                  onChange={(amount) => setTroops({ ...troops, [resource]: BigInt(amount) })}
                />
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
