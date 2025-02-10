import { NumberInput } from "@/ui/elements/number-input";
import { SelectBiome } from "@/ui/elements/select-biome";
import { SelectTier } from "@/ui/elements/select-tier";
import { SelectTroop } from "@/ui/elements/select-troop";
import { Biome, CombatSimulator, ResourcesIds, TroopType, type Army } from "@bibliothecadao/eternum";
import { useState } from "react";

interface ArmyInputProps {
  label: string;
  army: Army;
  onChange: (army: Army) => void;
}

const MAX_TROOPS_PER_ARMY = 500_000;

const TROOP_RESOURCES = [
  { type: TroopType.KNIGHT, resourceId: ResourcesIds.Knight },
  { type: TroopType.CROSSBOWMAN, resourceId: ResourcesIds.Crossbowman },
  { type: TroopType.PALADIN, resourceId: ResourcesIds.Paladin },
];

const getTroopResourceId = (troopType: TroopType): number => {
  return TROOP_RESOURCES.find((t) => t.type === troopType)?.resourceId || ResourcesIds.Knight;
};

const ArmyInput = ({ label, army, onChange }: ArmyInputProps) => {
  return (
    <div
      className="flex flex-col gap-3 p-4 border border-gray-200 rounded-lg relative overflow-hidden"
      style={{
        backgroundImage: `linear-gradient(rgba(20, 16, 13, 0.7), rgba(20, 16, 13, 0.7)), url(/images/resources/${getTroopResourceId(army.troopType)}.png)`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="relative z-10">
        <h3 className="text-lg font-semibold text-gray-900">{label}</h3>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col">
            <span className="text-sm font-medium text-gray-700 mb-1">Stamina</span>
            <NumberInput
              value={army.stamina}
              onChange={(value) => onChange({ ...army, stamina: value })}
              min={0}
              max={100}
              step={1}
            />
          </label>
          <label className="flex flex-col">
            <span className="text-sm font-medium text-gray-700 mb-1">Troop Count</span>
            <NumberInput
              value={army.troopCount}
              onChange={(value) => onChange({ ...army, troopCount: value })}
              min={1}
              max={MAX_TROOPS_PER_ARMY}
              step={100}
            />
          </label>
          <label className="flex flex-col">
            <span className="text-sm font-medium text-gray-700 mb-1">Troop Type</span>
            <SelectTroop
              onSelect={(troopType) => {
                if (troopType) {
                  onChange({ ...army, troopType });
                }
              }}
              defaultValue={army.troopType}
            />
          </label>
          <label className="flex flex-col">
            <span className="text-sm font-medium text-gray-700 mb-1">Tier</span>
            <SelectTier
              onSelect={(tier) => {
                if (tier) {
                  onChange({ ...army, tier: tier as 1 | 2 | 3 });
                }
              }}
              defaultValue={army.tier}
            />
          </label>
        </div>
      </div>
    </div>
  );
};

export const CombatSimulationPanel = () => {
  const [biome, setBiome] = useState<Biome>(Biome.GRASSLAND);
  const [attacker, setAttacker] = useState<Army>({
    stamina: 100,
    troopCount: 100,
    troopType: TroopType.KNIGHT,
    tier: 1,
  });
  const [defender, setDefender] = useState<Army>({
    stamina: 100,
    troopCount: 100,
    troopType: TroopType.CROSSBOWMAN,
    tier: 1,
  });

  const simulationResult = CombatSimulator.simulateBattle(attacker, defender, biome);

  // Calculate remaining troops based on damage
  const attackerTroopsLost = Math.min(attacker.troopCount, Math.ceil(simulationResult.defenderDamage));
  const defenderTroopsLost = Math.min(defender.troopCount, Math.ceil(simulationResult.attackerDamage));

  const attackerTroopsLeft = attacker.troopCount - attackerTroopsLost;
  const defenderTroopsLeft = defender.troopCount - defenderTroopsLost;

  // Calculate stamina changes
  const staminaCost = 30;
  let newAttackerStamina = attacker.stamina - staminaCost;
  let newDefenderStamina = defender.stamina - Math.min(staminaCost, defender.stamina);

  // Add bonus stamina to winner if one side is eliminated
  if (attackerTroopsLeft <= 0 && defenderTroopsLeft > 0) {
    newDefenderStamina += 30;
  } else if (defenderTroopsLeft <= 0 && attackerTroopsLeft > 0) {
    newAttackerStamina += 30;
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Combat Simulation</h2>
        <div className="w-64">
          <label className="flex flex-col">
            <span className="text-sm font-medium text-gray-700 mb-1">Biome</span>
            <SelectBiome
              onSelect={(newBiome) => {
                if (newBiome) {
                  setBiome(newBiome);
                }
              }}
              defaultValue={biome}
            />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <ArmyInput label="Attacker" army={attacker} onChange={setAttacker} />
        <ArmyInput label="Defender" army={defender} onChange={setDefender} />
      </div>

      <div className="mt-2 p-6 border border-gray-200 rounded-lg bg-gray-50/80 backdrop-blur-sm">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Battle Results</h3>
        <div className="grid grid-cols-2 gap-8">
          {[
            {
              label: "Attacker",
              data: {
                army: attacker,
                troopsLeft: attackerTroopsLeft,
                damage: simulationResult.attackerDamage,
                newStamina: newAttackerStamina,
                isWinner: defenderTroopsLeft <= 0 && attackerTroopsLeft > 0,
              },
            },
            {
              label: "Defender",
              data: {
                army: defender,
                troopsLeft: defenderTroopsLeft,
                damage: simulationResult.defenderDamage,
                newStamina: newDefenderStamina,
                isWinner: attackerTroopsLeft <= 0 && defenderTroopsLeft > 0,
              },
            },
          ].map(({ label, data }) => (
            <div key={label} className="space-y-2">
              <h4 className="font-semibold text-lg text-gray-900">{label}</h4>
              <div className="space-y-1.5">
                <p className="text-gray-700">
                  Damage Dealt: <span className="font-medium">{data.damage.toFixed(2)}</span>
                </p>
                <p className="text-gray-700">
                  Troops Left: <span className="font-medium">{Math.max(0, data.troopsLeft)}</span>
                  <span className="text-gray-500 text-sm ml-2">(Started: {data.army.troopCount})</span>
                </p>
                <p className="text-gray-700">
                  Stamina: <span className="font-medium">{Math.max(0, data.newStamina)}</span>
                  <span className="text-gray-500 text-sm ml-2">(Started: {data.army.stamina})</span>
                  {data.isWinner && <span className="text-green-600 font-medium ml-2">(+30 victory bonus)</span>}
                </p>
                <p className="text-gray-700">
                  Biome Bonus:
                  <span
                    className={
                      CombatSimulator.getBiomeBonus(data.army.troopType, biome) > 1
                        ? "text-green-600 font-medium"
                        : CombatSimulator.getBiomeBonus(data.army.troopType, biome) < 1
                          ? "text-red-600 font-medium"
                          : "text-gray-600"
                    }
                  >
                    {" "}
                    {((CombatSimulator.getBiomeBonus(data.army.troopType, biome) - 1) * 100).toFixed(0)}%
                  </span>
                </p>
              </div>
            </div>
          ))}
        </div>
        {(attackerTroopsLeft <= 0 || defenderTroopsLeft <= 0) && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-green-700 font-semibold text-center">
              {attackerTroopsLeft <= 0 ? "Defender" : "Attacker"} Wins! (+30 stamina bonus)
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
