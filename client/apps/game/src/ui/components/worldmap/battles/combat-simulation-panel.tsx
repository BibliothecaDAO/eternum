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
    <div className="flex flex-col gap-3 p-4 border border-gold/20 rounded-lg bg-dark-brown/90 backdrop-blur-sm">
      <div className="relative z-10">
        <h3 className="text-lg font-semibold text-gold">{label}</h3>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col">
            <span className="text-sm font-medium text-gold/80 mb-1">Stamina</span>
            <NumberInput
              value={army.stamina}
              onChange={(value) => onChange({ ...army, stamina: value })}
              min={0}
              max={100}
              step={1}
            />
          </label>
          <label className="flex flex-col">
            <span className="text-sm font-medium text-gold/80 mb-1">Troop Count</span>
            <NumberInput
              value={army.troopCount}
              onChange={(value) => onChange({ ...army, troopCount: value })}
              min={1}
              max={MAX_TROOPS_PER_ARMY}
              step={100}
            />
          </label>
          <label className="flex flex-col">
            <span className="text-sm font-medium text-gold/80 mb-1">Troop Type</span>
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
            <span className="text-sm font-medium text-gold/80 mb-1">Tier</span>
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
      <div>
        <label className="flex flex-col">
          <span className="text-sm font-medium text-gold/80 mb-1">Select Biome</span>
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

      <div className="grid grid-cols-2 gap-6">
        <ArmyInput label="Attacker" army={attacker} onChange={setAttacker} />
        <ArmyInput label="Defender" army={defender} onChange={setDefender} />
      </div>

      <div className="mt-2 p-6 border border-gold/20 rounded-lg bg-dark-brown/90 backdrop-blur-sm shadow-lg">
        <h3 className="text-2xl font-bold mb-6 text-gold border-b border-gold/20 pb-4">Battle Results</h3>
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
            <div
              key={label}
              className="relative p-4 rounded-lg border border-gold/10"
              style={{
                backgroundImage: `linear-gradient(rgba(20, 16, 13, 0.7), rgba(20, 16, 13, 0.7)), url(/images/resources/${getTroopResourceId(data.army.troopType)}.png)`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xl text-gold">{label}</h4>
                  {data.isWinner && (
                    <span className="px-2 py-1 bg-green-900/50 text-green-400 text-sm font-medium rounded border border-green-400/30">
                      Victory!
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="text-gold/80">
                      <div className="text-sm font-medium mb-1">Damage Dealt</div>
                      <div className="text-xl font-bold">{data.damage.toFixed(1)}</div>
                    </div>
                    <div className="text-gold/80">
                      <div className="text-sm font-medium mb-1">Troops Left</div>
                      <div className="text-xl font-bold flex items-baseline">
                        {Math.max(0, data.troopsLeft)}
                        <span className="text-xs ml-2 text-gold/50">/ {data.army.troopCount}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-gold/80">
                      <div className="text-sm font-medium mb-1">Stamina</div>
                      <div className="text-xl font-bold flex items-baseline">
                        {Math.max(0, data.newStamina)}
                        <span className="text-xs ml-2 text-gold/50">/ {data.army.stamina}</span>
                        {data.isWinner && <span className="text-xs ml-2 text-green-400">(+30)</span>}
                      </div>
                    </div>
                    <div className="text-gold/80">
                      <div className="text-sm font-medium mb-1">Biome Bonus</div>
                      <div
                        className={`text-xl font-bold ${
                          CombatSimulator.getBiomeBonus(data.army.troopType, biome) > 1
                            ? "text-green-400"
                            : CombatSimulator.getBiomeBonus(data.army.troopType, biome) < 1
                              ? "text-red-400"
                              : "text-gold/50"
                        }`}
                      >
                        {((CombatSimulator.getBiomeBonus(data.army.troopType, biome) - 1) * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {(attackerTroopsLeft <= 0 || defenderTroopsLeft <= 0) && (
          <div className="mt-6 p-4 bg-green-900/30 border border-green-400/30 rounded-lg">
            <p className="text-green-400 font-bold text-center text-lg">
              {attackerTroopsLeft <= 0 ? "Defender" : "Attacker"} Wins!
              <span className="text-green-400/80 text-base ml-2">(+30 stamina bonus)</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
