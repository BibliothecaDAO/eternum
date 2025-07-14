import { NumberInput } from "@/ui/design-system/atoms/number-input";
import { SelectBiome } from "@/ui/design-system/molecules/select-biome";
import { SelectRelic } from "@/ui/design-system/molecules/select-relic";
import { SelectTier } from "@/ui/design-system/molecules/select-tier";
import { SelectTroop } from "@/ui/design-system/molecules/select-troop";
import { formatTypeAndBonuses, getStaminaDisplay } from "@/ui/features/military";
import {
  CombatParameters,
  CombatSimulator,
  configManager,
  getTroopResourceId,
  type Army,
} from "@bibliothecadao/eternum";
import { BiomeType, RELICS, ResourcesIds, TroopTier, TroopType } from "@bibliothecadao/types";
import { useEffect, useMemo, useState } from "react";

interface ArmyInputProps {
  label: string;
  army: Army;
  onChange: (army: Army) => void;
  relics: ResourcesIds[];
  onRelicsChange: (relics: ResourcesIds[]) => void;
}

const MAX_TROOPS_PER_ARMY = 500_000;

const ArmyInput = ({ label, army, onChange, relics, onRelicsChange }: ArmyInputProps) => {
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
              max={200}
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
              step={200}
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
                  onChange({ ...army, tier: tier });
                }
              }}
              defaultValue={army.tier}
            />
          </label>
        </div>
        <div className="mt-3 col-span-2">
          <SelectRelic
            label="Active Relics"
            onSelect={onRelicsChange}
            defaultValue={relics}
            allowMultiple={true}
            filterTypes={["Damage", "Damage Reduction", "Stamina"]}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
};

interface ParametersPanelProps {
  parameters: CombatParameters;
  onParametersChange: (parameters: CombatParameters) => void;
  show: boolean;
}

const ParametersPanel = ({ parameters, onParametersChange, show }: ParametersPanelProps) => {
  if (!show) return null;

  return (
    <div className="fixed top-4 right-4 p-4 bg-dark-brown/95 border border-gold/20 rounded-lg shadow-lg z-50 w-80">
      <h3 className="text-lg font-bold text-gold mb-4">Combat Parameters</h3>
      <div className="space-y-3">
        {Object.entries(parameters).map(([key, value]) => (
          <label key={key} className="flex flex-col">
            <span className="text-sm font-medium text-gold/80 mb-1">
              {key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())}
            </span>
            <input
              type="number"
              value={value}
              onChange={(e) => {
                const newValue = parseFloat(e.target.value);
                if (!isNaN(newValue)) {
                  onParametersChange({ ...parameters, [key]: newValue });
                }
              }}
              min={0}
              max={key === "c0" || key === "delta" ? 1000000 : 1000}
              step={key === "c0" || key === "delta" ? 1000 : 0.01}
              className="px-2 py-1 bg-dark-brown border border-gold/20 rounded text-gold focus:outline-none focus:border-gold/40"
            />
          </label>
        ))}
        <button
          className="w-full mt-4 px-4 py-2 bg-gold/20 hover:bg-gold/30 text-gold rounded"
          onClick={() => onParametersChange(CombatSimulator.getDefaultParameters())}
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  );
};

export const CombatSimulationPanel = () => {
  const [biome, setBiome] = useState<BiomeType>(BiomeType.Grassland);
  const [attacker, setAttacker] = useState<Army>({
    stamina: 100,
    troopCount: 100,
    troopType: TroopType.Knight,
    tier: TroopTier.T1,
  });
  const [defender, setDefender] = useState<Army>({
    stamina: 100,
    troopCount: 100,
    troopType: TroopType.Crossbowman,
    tier: TroopTier.T1,
  });
  const [attackerRelics, setAttackerRelics] = useState<ResourcesIds[]>([]);
  const [defenderRelics, setDefenderRelics] = useState<ResourcesIds[]>([]);
  const [showParameters, setShowParameters] = useState(false);
  const [parameters, setParameters] = useState<CombatParameters>(CombatSimulator.getDefaultParameters());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "s") {
        setShowParameters((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const combatSimulator = useMemo(() => new CombatSimulator(parameters), [parameters]);

  const simulationResult = combatSimulator.simulateBattleWithParams(
    attacker,
    defender,
    biome,
    attackerRelics,
    defenderRelics,
  );

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

  // Calculate relic bonuses for display
  const getRelicBonuses = (relics: ResourcesIds[]) => {
    const damageRelics = RELICS.filter((r) => relics.includes(r.id) && r.type === "Damage");
    const reductionRelics = RELICS.filter((r) => relics.includes(r.id) && r.type === "Damage Reduction");
    const staminaRelics = RELICS.filter((r) => relics.includes(r.id) && r.type === "Stamina");

    return {
      damageBonus: damageRelics.length > 0 ? Math.max(...damageRelics.map((r) => r.bonus)) : 1,
      reductionBonus: reductionRelics.length > 0 ? Math.min(...reductionRelics.map((r) => r.bonus)) : 1,
      staminaBonus: staminaRelics.length > 0 ? Math.max(...staminaRelics.map((r) => r.bonus)) : 1,
      activeRelics: [...damageRelics, ...reductionRelics, ...staminaRelics],
    };
  };

  const attackerRelicBonuses = getRelicBonuses(attackerRelics);
  const defenderRelicBonuses = getRelicBonuses(defenderRelics);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
      <ParametersPanel parameters={parameters} onParametersChange={setParameters} show={showParameters} />
      <div>
        <label className="flex flex-col">
          <span className="text-sm font-medium text-gold/80 mb-1">Select Biome</span>
          <SelectBiome
            combatSimulator={combatSimulator}
            onSelect={(newBiome) => {
              if (newBiome) {
                setBiome(newBiome as BiomeType);
              }
            }}
            defaultValue={biome}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <ArmyInput
          label="Attacker"
          army={attacker}
          onChange={setAttacker}
          relics={attackerRelics}
          onRelicsChange={setAttackerRelics}
        />
        <ArmyInput
          label="Defender"
          army={defender}
          onChange={setDefender}
          relics={defenderRelics}
          onRelicsChange={setDefenderRelics}
        />
      </div>

      {
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
                  staminaModifier: combatSimulator.calculateStaminaModifier(attacker.stamina, true),
                  biomeBonus: configManager.getBiomeCombatBonus(attacker.troopType, biome),
                  relicBonuses: attackerRelicBonuses,
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
                  staminaModifier: combatSimulator.calculateStaminaModifier(defender.stamina, false),
                  biomeBonus: configManager.getBiomeCombatBonus(defender.troopType, biome),
                  relicBonuses: defenderRelicBonuses,
                },
              },
            ].map(({ label, data }) => (
              <div
                key={label}
                className="relative p-4 rounded-lg border border-gold/10"
                style={{
                  backgroundImage: `linear-gradient(rgba(20, 16, 13, 0.7), rgba(20, 16, 13, 0.7)), url(/images/resources/${getTroopResourceId(data.army.troopType, TroopTier.T1)}.png)`,
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

                  {formatTypeAndBonuses(
                    data.army.troopType,
                    data.army.tier,
                    data.biomeBonus,
                    data.staminaModifier,
                    label === "Attacker",
                  )}

                  {/* Relic Effects Display */}
                  {data.relicBonuses.activeRelics.length > 0 && (
                    <div className="mt-3 p-2 bg-purple-900/20 border border-purple-500/30 rounded">
                      <div className="text-sm font-medium text-purple-400 mb-1">Active Relic Effects:</div>
                      <div className="space-y-1">
                        {data.relicBonuses.damageBonus > 1 && (
                          <div className="text-xs text-order-giants">
                            ⚔️ Damage: +{Math.round((data.relicBonuses.damageBonus - 1) * 100)}%
                          </div>
                        )}
                        {data.relicBonuses.reductionBonus < 1 && (
                          <div className="text-xs text-order-brilliance">
                            🛡️ Damage Reduction: -{Math.round((1 - data.relicBonuses.reductionBonus) * 100)}%
                          </div>
                        )}
                        {data.relicBonuses.staminaBonus > 1 && (
                          <div className="text-xs text-order-power">
                            ⚡ Stamina Regen: +{Math.round((data.relicBonuses.staminaBonus - 1) * 100)}%
                          </div>
                        )}
                      </div>
                    </div>
                  )}

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

                    <div className="space-y-2">{getStaminaDisplay(data.army.stamina, data.newStamina, 30)}</div>
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
      }
    </div>
  );
};
