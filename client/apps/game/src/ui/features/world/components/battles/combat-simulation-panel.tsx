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
  const isAttacker = label === "Attacker";

  return (
    <div className="group relative flex flex-col gap-4 p-6 border-2 border-gold/30 rounded-xl bg-gradient-to-br from-dark-brown/95 to-dark-brown/80 backdrop-blur-md shadow-2xl transition-all duration-300 hover:border-gold/50 hover:shadow-gold/20">
      <div className="absolute inset-0 bg-gradient-to-br from-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-3 h-3 rounded-full ${isAttacker ? "bg-red-500" : "bg-blue-500"} shadow-lg`} />
          <h3 className="text-xl font-bold text-gold tracking-wide">{label}</h3>
          <div className="flex-1 h-px bg-gradient-to-r from-gold/50 to-transparent" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="group/input">
            <label className="flex flex-col">
              <span className="text-sm font-semibold text-gold/90 mb-2 flex items-center gap-2">
                ⚡ Stamina
                <span className="text-xs text-gold/60">({army.stamina}/200)</span>
              </span>
              <NumberInput
                value={army.stamina}
                onChange={(value) => onChange({ ...army, stamina: value })}
                min={0}
                max={200}
                step={1}
              />
            </label>
          </div>
          <div className="group/input">
            <label className="flex flex-col">
              <span className="text-sm font-semibold text-gold/90 mb-2 flex items-center gap-2">
                🗡️ Troop Count
                <span className="text-xs text-gold/60">({army.troopCount.toLocaleString()})</span>
              </span>
              <NumberInput
                value={army.troopCount}
                onChange={(value) => onChange({ ...army, troopCount: value })}
                min={1}
                max={MAX_TROOPS_PER_ARMY}
                step={200}
              />
            </label>
          </div>
          <div className="group/input">
            <label className="flex flex-col">
              <span className="text-sm font-semibold text-gold/90 mb-2 flex items-center gap-2">🛡️ Troop Type</span>
              <SelectTroop
                onSelect={(troopType) => {
                  if (troopType) {
                    onChange({ ...army, troopType });
                  }
                }}
                defaultValue={army.troopType}
              />
            </label>
          </div>
          <div className="group/input">
            <label className="flex flex-col">
              <span className="text-sm font-semibold text-gold/90 mb-2 flex items-center gap-2">⭐ Tier</span>
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
        </div>
        <div className="col-span-2 mt-2">
          <div className="p-4 bg-purple-900/20 border border-relic-activated rounded-lg">
            <SelectRelic
              label="🔮 Active Relics"
              onSelect={onRelicsChange}
              defaultValue={relics}
              allowMultiple={true}
              filterTypes={["Damage", "Damage Reduction", "Stamina"]}
              className="w-full"
            />
            {relics.length > 0 && (
              <div className="mt-2 text-xs text-relic2">
                {relics.length} relic{relics.length > 1 ? "s" : ""} equipped
              </div>
            )}
          </div>
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
    <div className="fixed top-4 right-4 p-6 bg-gradient-to-br from-dark-brown/98 to-black/95 border-2 border-gold/30 rounded-xl shadow-2xl z-50 w-96 backdrop-blur-lg animate-in slide-in-from-right-2 duration-300">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-2 h-2 bg-gold rounded-full animate-pulse" />
        <h3 className="text-xl font-bold text-gold">Combat Parameters</h3>
        <div className="flex-1 h-px bg-gradient-to-r from-gold/50 to-transparent" />
      </div>
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
          className="w-full mt-6 px-4 py-3 bg-gradient-to-r from-gold/20 to-gold/30 hover:from-gold/30 hover:to-gold/40 text-gold rounded-lg font-semibold transition-all duration-200 hover:shadow-lg hover:shadow-gold/20 border border-gold/20 hover:border-gold/40"
          onClick={() => onParametersChange(CombatSimulator.getDefaultParameters())}
        >
          🔄 Reset to Defaults
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
    battle_cooldown_end: Math.floor(Date.now() / 1000),
  });
  const [defender, setDefender] = useState<Army>({
    stamina: 100,
    troopCount: 100,
    troopType: TroopType.Crossbowman,
    tier: TroopTier.T1,
    battle_cooldown_end: Math.floor(Date.now() / 1000),
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

  const now = Math.floor(Date.now() / 1000);
  const simulationResult = combatSimulator.simulateBattleWithParams(
    now,
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
  let attackStaminaCost = 50;
  attackStaminaCost -= Math.ceil(attackStaminaCost * simulationResult.attackerRefundMultiplier);

  let defenseStaminaCost = Math.min(defender.stamina, 40);
  defenseStaminaCost -= Math.ceil(defenseStaminaCost * simulationResult.defenderRefundMultiplier);

  const newAttackerStamina = attacker.stamina - attackStaminaCost;
  const newDefenderStamina = defender.stamina - defenseStaminaCost;

  // Calculate new battle timer cooldown end
  const tickIntervalSeconds = 60;
  let attackerCooldownEnd = attacker.battle_cooldown_end;
  if (attackerCooldownEnd < now) {
    attackerCooldownEnd = now;
  }
  attackerCooldownEnd += Math.floor(tickIntervalSeconds * (1 - simulationResult.attackerRefundMultiplier));

  let defenderCooldownEnd = defender.battle_cooldown_end;
  if (defenderCooldownEnd < now) {
    defenderCooldownEnd = now;
  }
  defenderCooldownEnd += Math.floor(tickIntervalSeconds * (1 - simulationResult.defenderRefundMultiplier));

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
    <div className="flex flex-col gap-8 p-8 max-w-6xl mx-auto">
      <ParametersPanel parameters={parameters} onParametersChange={setParameters} show={showParameters} />

      {/* Header Section */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-gold bg-gradient-to-r from-gold to-yellow-400 bg-clip-text text-transparent">
          ⚔️ Combat Simulator
        </h1>
        <p className="text-gold/70 text-lg">Test your armies against different opponents and scenarios</p>
        <div className="flex items-center justify-center gap-2 text-sm text-gold/50">
          <span>Press</span>
          <kbd className="px-2 py-1 bg-dark-brown/50 border border-gold/20 rounded text-xs">Ctrl+Shift+S</kbd>
          <span>for advanced parameters</span>
        </div>
      </div>

      {/* Biome Selection */}
      <div className="p-6 bg-gradient-to-r from-dark-brown/80 to-dark-brown/60 border-2 border-gold/20 rounded-xl backdrop-blur-sm">
        <label className="flex flex-col">
          <span className="text-lg font-semibold text-gold mb-3 flex items-center gap-2">🌍 Battle Environment</span>
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

      {/* Army Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <ArmyInput
          label="Attacker"
          army={attacker}
          onChange={setAttacker}
          relics={attackerRelics}
          onRelicsChange={setAttackerRelics}
        />
        <div className="flex items-center justify-center lg:hidden">
          <div className="text-4xl text-gold/60 animate-pulse">⚔️</div>
        </div>
        <ArmyInput
          label="Defender"
          army={defender}
          onChange={setDefender}
          relics={defenderRelics}
          onRelicsChange={setDefenderRelics}
        />
      </div>

      {/* VS Divider for larger screens */}
      <div className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
        <div className="bg-dark-brown/90 border-2 border-gold/30 rounded-full p-4 shadow-2xl">
          <span className="text-2xl font-bold text-gold">VS</span>
        </div>
      </div>

      {
        <div className="relative mt-8 p-8 border-2 border-gold/30 rounded-2xl bg-gradient-to-br from-dark-brown/95 to-black/90 backdrop-blur-md shadow-2xl animate-in fade-in-50 duration-500">
          <div className="absolute inset-0 bg-gradient-to-br from-gold/5 to-transparent rounded-2xl" />
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-1 h-8 bg-gradient-to-b from-gold to-yellow-600 rounded-full" />
              <h3 className="text-3xl font-bold text-gold bg-gradient-to-r from-gold to-yellow-400 bg-clip-text text-transparent">
                ⚔️ Battle Results
              </h3>
              <div className="flex-1 h-px bg-gradient-to-r from-gold/50 to-transparent" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
                    cooldownEnd: attackerCooldownEnd,
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
                    cooldownEnd: defenderCooldownEnd,
                  },
                },
              ].map(({ label, data }) => (
                <div
                  key={label}
                  className={`relative p-6 rounded-xl border-2 transition-all duration-500 ${
                    data.isWinner
                      ? "border-green-500/50 bg-gradient-to-br from-green-900/30 to-green-800/20 shadow-green-500/20 shadow-lg"
                      : data.troopsLeft <= 0
                        ? "border-red-500/50 bg-gradient-to-br from-red-900/30 to-red-800/20"
                        : "border-gold/20 bg-gradient-to-br from-dark-brown/80 to-dark-brown/60"
                  }`}
                  style={{
                    backgroundImage: `linear-gradient(rgba(20, 16, 13, 0.85), rgba(20, 16, 13, 0.85)), url(/images/resources/${getTroopResourceId(data.army.troopType, TroopTier.T1)}.png)`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-gold/5 to-transparent rounded-xl" />
                  <div className="relative z-10 space-y-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-3 h-3 rounded-full ${label === "Attacker" ? "bg-red-500" : "bg-blue-500"} shadow-lg`}
                        />
                        <h4 className="font-bold text-2xl text-gold">{label}</h4>
                      </div>
                      {data.isWinner && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-green-900/60 text-green-400 text-sm font-bold rounded-lg border border-green-400/40 shadow-lg animate-pulse">
                          👑 Victory!
                        </div>
                      )}
                      {data.troopsLeft <= 0 && !data.isWinner && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-red-900/60 text-red-400 text-sm font-bold rounded-lg border border-red-400/40">
                          💀 Defeated
                        </div>
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
                      <div className="p-4 bg-purple-900/30 border border-purple-500/40 rounded-lg backdrop-blur-sm">
                        <div className="text-sm font-bold text-relic mb-3 flex items-center gap-2">
                          🔮 Active Relic Effects
                          <span className="text-xs bg-purple-600/30 px-2 py-1 rounded-full">
                            {data.relicBonuses.activeRelics.length}
                          </span>
                        </div>
                        <div className="grid gap-2">
                          {data.relicBonuses.damageBonus > 1 && (
                            <div className="flex items-center justify-between p-2 bg-red-900/30 border border-red-500/30 rounded text-sm">
                              <span className="text-red-300 flex items-center gap-2">⚔️ Damage Bonus</span>
                              <span className="text-red-400 font-bold">
                                +{Math.round((data.relicBonuses.damageBonus - 1) * 100)}%
                              </span>
                            </div>
                          )}
                          {data.relicBonuses.reductionBonus < 1 && (
                            <div className="flex items-center justify-between p-2 bg-blue-900/30 border border-blue-500/30 rounded text-sm">
                              <span className="text-blue-300 flex items-center gap-2">🛡️ Damage Reduction</span>
                              <span className="text-blue-400 font-bold">
                                -{Math.round((1 - data.relicBonuses.reductionBonus) * 100)}%
                              </span>
                            </div>
                          )}
                          {data.relicBonuses.staminaBonus > 1 && (
                            <div className="flex items-center justify-between p-2 bg-yellow-900/30 border border-yellow-500/30 rounded text-sm">
                              <span className="text-yellow-300 flex items-center gap-2">⚡ Stamina Bonus</span>
                              <span className="text-yellow-400 font-bold">
                                +{Math.round((data.relicBonuses.staminaBonus - 1) * 100)}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="p-4 bg-dark-brown/50 border border-gold/20 rounded-lg">
                          <div className="text-sm font-semibold text-gold/90 mb-2 flex items-center gap-2">
                            ⚔️ Damage Dealt
                          </div>
                          <div className="text-3xl font-bold text-gold flex items-baseline">
                            {data.damage.toFixed(1)}
                            <span className="text-sm ml-2 text-gold/60">dmg</span>
                          </div>
                        </div>
                        <div className="p-4 bg-dark-brown/50 border border-gold/20 rounded-lg">
                          <div className="text-sm font-semibold text-gold/90 mb-2 flex items-center gap-2">
                            🗡️ Troops Remaining
                          </div>
                          <div className="text-3xl font-bold flex items-baseline">
                            <span
                              className={`${
                                data.troopsLeft <= 0
                                  ? "text-red-400"
                                  : data.troopsLeft < data.army.troopCount * 0.5
                                    ? "text-yellow-400"
                                    : "text-green-400"
                              }`}
                            >
                              {Math.max(0, data.troopsLeft).toLocaleString()}
                            </span>
                            <span className="text-sm ml-2 text-gold/60">/ {data.army.troopCount.toLocaleString()}</span>
                          </div>
                          <div className="mt-2 w-full bg-dark-brown/50 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full transition-all duration-1000 ${
                                data.troopsLeft <= 0
                                  ? "bg-red-500"
                                  : data.troopsLeft < data.army.troopCount * 0.5
                                    ? "bg-yellow-500"
                                    : "bg-green-500"
                              }`}
                              style={{ width: `${Math.max(0, (data.troopsLeft / data.army.troopCount) * 100)}%` }}
                            />
                          </div>
                        </div>
                        <div className="p-4 bg-dark-brown/50 border border-gold/20 rounded-lg">
                          <div className="text-sm font-semibold text-gold/90 mb-2 flex items-center gap-2">
                            ⏳ Cooldown End
                          </div>
                          <div className="text-lg font-bold text-gold flex items-baseline">
                            {new Date(data.cooldownEnd * 1000).toLocaleTimeString()}{" "}
                            <span className="text-xs ml-2 text-gold/60">({data.cooldownEnd})</span>
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
              <div className="mt-8 p-6 bg-gradient-to-r from-green-900/40 to-green-800/30 border-2 border-green-400/40 rounded-xl text-center animate-in zoom-in-50 duration-500">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <div className="text-3xl animate-bounce">🎉</div>
                  <p className="text-green-300 font-bold text-2xl">
                    {attackerTroopsLeft <= 0 ? "Defender" : "Attacker"} Wins!
                  </p>
                  <div className="text-3xl animate-bounce">🏆</div>
                </div>
                {/* <p className="text-green-400/80 text-lg">Victory Bonus: +30 Stamina</p> */}
              </div>
            )}

            {attackerTroopsLeft > 0 && defenderTroopsLeft > 0 && (
              <div className="mt-8 p-6 bg-gradient-to-r from-yellow-900/40 to-orange-800/30 border-2 border-yellow-400/40 rounded-xl text-center">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <div className="text-2xl">⚔️</div>
                  <p className="text-yellow-300 font-bold text-xl">Battle Continues - Both Armies Survive!</p>
                  <div className="text-2xl">🛡️</div>
                </div>
                <p className="text-yellow-400/80 text-base">
                  No decisive victory - consider reinforcements or tactical changes
                </p>
              </div>
            )}
          </div>
        </div>
      }
    </div>
  );
};
