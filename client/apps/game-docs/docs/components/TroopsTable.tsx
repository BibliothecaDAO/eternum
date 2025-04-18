import { ETERNUM_CONFIG } from "@/utils/config";
import { ResourcesIds } from "@bibliothecadao/types";

export default function TroopsTable() {
  const troopTypes = [ResourcesIds.Paladin, ResourcesIds.Knight, ResourcesIds.Crossbowman];

  const config = ETERNUM_CONFIG();

  const getTroopName = (troopId: number) => {
    switch (troopId) {
      case ResourcesIds.Paladin:
        return "Paladin";
      case ResourcesIds.Knight:
        return "Knight";
      case ResourcesIds.Crossbowman:
        return "Crossbowman";
      default:
        return "Unknown";
    }
  };

  return (
    <div className="my-4 p-4">
      <div className="font-bold mb-6 text-xl">Military Units</div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {troopTypes.map((troopId) => {
          const troopName = getTroopName(troopId);
          const maxStamina = config.troop.stamina[`stamina${troopName}Max`];

          return (
            <div key={troopId} className="border border-gray-700 p-4 rounded-lg bg-white/5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg font-semibold">{troopName}</span>
              </div>

              <div className="mb-4">
                <div className="font-bold mb-2">⚡️ Stamina</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    Initial: <span className="text-gray-400">{config.troop.stamina.staminaInitial}</span>
                  </div>
                  <div>
                    Max: <span className="text-gray-400">{maxStamina}</span>
                  </div>
                  <div>
                    Gain Per Tick: <span className="text-gray-400">{config.troop.stamina.staminaGainPerTick}</span>
                  </div>
                  <div>
                    Biome Bonus: <span className="text-gray-400">{config.troop.stamina.staminaBonusValue}</span>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <div className="font-bold mb-2">📊 Stamina Costs</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    Travel: <span className="text-gray-400">{config.troop.stamina.staminaTravelStaminaCost}</span>
                  </div>
                  <div>
                    Explore: <span className="text-gray-400">{config.troop.stamina.staminaExploreStaminaCost}</span>
                  </div>
                  <div>
                    Attack Min: <span className="text-gray-400">{config.troop.stamina.staminaAttackReq}</span>
                  </div>
                  <div>
                    Attack Max: <span className="text-gray-400">{config.troop.stamina.staminaAttackMax}</span>
                  </div>
                </div>
              </div>

              {troopId === ResourcesIds.Paladin && (
                <>
                  <div className="mb-4">
                    <div className="font-bold mb-2">🍲 Food Consumption</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="col-span-2 font-semibold">Travel:</div>
                      <div>
                        Wheat: <span className="text-gray-400">{config.troop.stamina.staminaTravelWheatCost}</span>
                      </div>
                      <div>
                        Fish: <span className="text-gray-400">{config.troop.stamina.staminaTravelFishCost}</span>
                      </div>

                      <div className="col-span-2 font-semibold">Explore:</div>
                      <div>
                        Wheat: <span className="text-gray-400">{config.troop.stamina.staminaExploreWheatCost}</span>
                      </div>
                      <div>
                        Fish: <span className="text-gray-400">{config.troop.stamina.staminaExploreFishCost}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <div className="font-bold mb-2">🔣 Troop Limits</div>
                    <div className="grid grid-cols-1 gap-2 text-sm">
                      <div>
                        Max Explorer Party:{" "}
                        <span className="text-gray-400">{config.troop.limit.explorerMaxPartyCount}</span>
                      </div>
                      <div>
                        Max Troop Count:{" "}
                        <span className="text-gray-400">{config.troop.limit.explorerAndGuardMaxTroopCount}</span>
                      </div>
                      <div>
                        Guard Resurrection:{" "}
                        <span className="text-gray-400">
                          {Math.floor(config.troop.limit.guardResurrectionDelay / 3600)} hours
                        </span>
                      </div>
                      <div>
                        Mercenary Range:{" "}
                        <span className="text-gray-400">
                          {config.troop.limit.mercenariesTroopLowerBound} -{" "}
                          {config.troop.limit.mercenariesTroopUpperBound}
                        </span>
                      </div>
                      <div>
                        Agent Range:{" "}
                        <span className="text-gray-400">
                          {config.troop.limit.agentTroopLowerBound} - {config.troop.limit.agentTroopUpperBound}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {troopId === ResourcesIds.Knight && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <div className="font-bold mb-2">⚔️ Damage Multipliers</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      T1 Base: <span className="text-gray-400">1.0</span>
                    </div>
                    <div>
                      T2:{" "}
                      <span className="text-gray-400">
                        {Number(config.troop.damage.t2DamageMultiplier) / 1844674407370955161600}
                      </span>
                    </div>
                    <div>
                      T3:{" "}
                      <span className="text-gray-400">
                        {Number(config.troop.damage.t3DamageMultiplier) / 1844674407370955161600}
                      </span>
                    </div>
                    <div>
                      Biome Bonus:{" "}
                      <span className="text-gray-400">{config.troop.damage.damageBiomeBonusNum / 100}%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
