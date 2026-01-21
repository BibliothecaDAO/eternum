import { useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import {
  Clock,
  Coins,
  Settings,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronRight,
  Swords,
  Timer,
  Compass,
  Footprints,
  Zap,
  Shield,
  Home,
  TrendingUp,
  Map,
} from "lucide-react";
import type { GamePresetConfigOverrides } from "../../types/game-presets";

interface ConfigEditorProps {
  config: GamePresetConfigOverrides;
  onChange: (updates: Partial<GamePresetConfigOverrides>) => void;
  feeError?: string | null;
}

interface CollapsibleSectionProps {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}

const CollapsibleSection = ({ title, icon, children, defaultOpen = false }: CollapsibleSectionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-gold/20 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-brown/30 hover:bg-brown/50 transition-colors text-left"
      >
        {isOpen ? <ChevronDown className="w-4 h-4 text-gold" /> : <ChevronRight className="w-4 h-4 text-gold" />}
        <span className="text-gold">{icon}</span>
        <span className="text-sm font-semibold text-gold">{title}</span>
      </button>
      {isOpen && <div className="p-4 space-y-4 bg-brown/10">{children}</div>}
    </div>
  );
};

const NumberInput = ({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
}) => {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.valueAsNumber;
    if (!Number.isFinite(nextValue)) return;
    let normalized = nextValue;
    if (Number.isInteger(step)) {
      normalized = Math.trunc(normalized);
    }
    if (min !== undefined) normalized = Math.max(min, normalized);
    if (max !== undefined) normalized = Math.min(max, normalized);
    onChange(normalized);
  };

  return (
    <div className="space-y-1">
      <label className="text-xs text-gold/70">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleChange}
        className="w-full px-3 py-2 bg-brown/50 border border-gold/30 rounded-lg text-gold text-sm focus:border-gold focus:ring-1 focus:ring-gold/30 outline-none transition-all"
      />
      {hint && <p className="text-[10px] text-gold/50">{hint}</p>}
    </div>
  );
};

const ToggleButton = ({
  label,
  value,
  onChange,
  activeColor = "gold",
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  activeColor?: "gold" | "brilliance" | "orange";
}) => {
  const colorClasses = {
    gold: "bg-gold/20 border-gold/50 text-gold",
    brilliance: "bg-brilliance/20 border-brilliance/50 text-brilliance",
    orange: "bg-orange/20 border-orange/50 text-orange",
  };

  return (
    <button
      onClick={() => onChange(!value)}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-lg border transition-all text-sm
        ${value ? colorClasses[activeColor] : "bg-brown/50 border-gold/20 text-gold/60"}
      `}
    >
      {value ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
      {label}
    </button>
  );
};

export const ConfigEditor = ({ config, onChange, feeError }: ConfigEditorProps) => {
  return (
    <div className="p-6 panel-wood rounded-xl border border-gold/30 space-y-4">
      <h3 className="text-lg font-bold text-gold">Game Configuration</h3>
      <p className="text-xs text-gold/60">Configure all game parameters. Click sections to expand.</p>

      {/* Basic Settings - Always Open */}
      <CollapsibleSection title="Basic Settings" icon={<Settings className="w-4 h-4" />} defaultOpen={true}>
        {/* Duration */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-gold">
            <Clock className="w-4 h-4" />
            Duration
          </label>
          <div className="grid grid-cols-2 gap-4">
            <NumberInput
              label="Hours"
              value={config.durationHours}
              onChange={(v) => onChange({ durationHours: Math.max(0, v) })}
              min={0}
              max={72}
            />
            <NumberInput
              label="Minutes"
              value={config.durationMinutes}
              onChange={(v) => onChange({ durationMinutes: Math.min(59, Math.max(0, v)) })}
              min={0}
              max={59}
            />
          </div>
        </div>

        {/* Max Players */}
        <NumberInput
          label="Max Players"
          value={config.registrationCountMax}
          onChange={(v) => onChange({ registrationCountMax: Math.max(2, v) })}
          min={2}
          max={1000}
        />

        {/* Entry Fee */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-gold">
            <Coins className="w-4 h-4 text-orange" />
            Entry Fee
          </label>
          <div className="flex items-center gap-4">
            <ToggleButton
              label={config.hasFee ? "Enabled" : "Disabled"}
              value={config.hasFee}
              onChange={(v) => onChange({ hasFee: v })}
              activeColor="orange"
            />
            {config.hasFee && (
              <div className="flex-1 space-y-1">
                <input
                  type="text"
                  value={config.feeAmount}
                  onChange={(e) => onChange({ feeAmount: e.target.value })}
                  placeholder="Amount"
                  aria-invalid={!!feeError}
                  className={`w-full px-3 py-2 bg-brown/50 border rounded-lg text-gold text-sm focus:border-gold outline-none ${
                    feeError ? "border-danger focus:border-danger" : "border-gold/30"
                  }`}
                />
                {feeError && <p className="text-[10px] text-danger">{feeError}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Mode Toggles */}
        <div className="flex flex-wrap gap-3">
          <ToggleButton
            label="Dev Mode"
            value={config.devMode}
            onChange={(v) => onChange({ devMode: v })}
            activeColor="brilliance"
          />
          <ToggleButton
            label="Single Realm"
            value={config.singleRealmMode}
            onChange={(v) => onChange({ singleRealmMode: v })}
          />
        </div>
      </CollapsibleSection>

      {/* Registration Timing */}
      <CollapsibleSection title="Registration Timing" icon={<Timer className="w-4 h-4" />}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumberInput
            label="Registration Delay (seconds)"
            value={config.registrationDelaySeconds}
            onChange={(v) => onChange({ registrationDelaySeconds: v })}
            min={0}
            hint="Delay before registration opens"
          />
          <NumberInput
            label="Registration Period (seconds)"
            value={config.registrationPeriodSeconds}
            onChange={(v) => onChange({ registrationPeriodSeconds: v })}
            min={60}
            hint="How long registration stays open"
          />
        </div>
      </CollapsibleSection>

      {/* Season Timing */}
      <CollapsibleSection title="Season Timing" icon={<Clock className="w-4 h-4" />}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <NumberInput
            label="Settling Delay (seconds)"
            value={config.startSettlingAfterSeconds}
            onChange={(v) => onChange({ startSettlingAfterSeconds: v })}
            min={0}
            hint="Delay before settling phase"
          />
          <NumberInput
            label="Bridge Close After End (seconds)"
            value={config.bridgeCloseAfterEndSeconds}
            onChange={(v) => onChange({ bridgeCloseAfterEndSeconds: v })}
            min={0}
            hint="When bridge closes after game ends"
          />
          <NumberInput
            label="Point Reg Close After End (seconds)"
            value={config.pointRegistrationCloseAfterEndSeconds}
            onChange={(v) => onChange({ pointRegistrationCloseAfterEndSeconds: v })}
            min={0}
            hint="When point registration closes"
          />
        </div>
      </CollapsibleSection>

      {/* Battle Settings */}
      <CollapsibleSection title="Battle Settings" icon={<Swords className="w-4 h-4" />}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <NumberInput
            label="Grace Tick Count"
            value={config.battleGraceTickCount}
            onChange={(v) => onChange({ battleGraceTickCount: v })}
            min={0}
            hint="Ticks before battle starts"
          />
          <NumberInput
            label="Grace Tick Count (Hyperstructure)"
            value={config.battleGraceTickCountHyp}
            onChange={(v) => onChange({ battleGraceTickCountHyp: v })}
            min={0}
            hint="Grace ticks for hyperstructures"
          />
          <NumberInput
            label="Battle Delay (seconds)"
            value={config.battleDelaySeconds}
            onChange={(v) => onChange({ battleDelaySeconds: v })}
            min={0}
            hint="Delay before battle begins"
          />
        </div>
      </CollapsibleSection>

      {/* Tick Intervals */}
      <CollapsibleSection title="Tick Intervals" icon={<Timer className="w-4 h-4" />}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <NumberInput
            label="Default Tick (seconds)"
            value={config.defaultTickIntervalSeconds}
            onChange={(v) => onChange({ defaultTickIntervalSeconds: Math.max(1, v) })}
            min={1}
            hint="Base game tick interval"
          />
          <NumberInput
            label="Armies Tick (seconds)"
            value={config.armiesTickIntervalSeconds}
            onChange={(v) => onChange({ armiesTickIntervalSeconds: Math.max(1, v) })}
            min={1}
            hint="Army stamina regeneration tick"
          />
          <NumberInput
            label="Delivery Tick (seconds)"
            value={config.deliveryTickIntervalSeconds}
            onChange={(v) => onChange({ deliveryTickIntervalSeconds: Math.max(1, v) })}
            min={1}
            hint="Resource delivery tick"
          />
        </div>
      </CollapsibleSection>

      {/* Movement & Speed */}
      <CollapsibleSection title="Movement & Speed" icon={<Footprints className="w-4 h-4" />}>
        <div className="grid grid-cols-2 gap-4">
          <NumberInput
            label="Donkey Speed"
            value={config.speedDonkey}
            onChange={(v) => onChange({ speedDonkey: Math.max(1, v) })}
            min={1}
            hint="Donkey movement speed"
          />
          <NumberInput
            label="Army Speed"
            value={config.speedArmy}
            onChange={(v) => onChange({ speedArmy: Math.max(1, v) })}
            min={1}
            hint="Army movement speed"
          />
        </div>
      </CollapsibleSection>

      {/* Exploration */}
      <CollapsibleSection title="Exploration" icon={<Compass className="w-4 h-4" />}>
        <NumberInput
          label="Exploration Reward"
          value={config.explorationReward}
          onChange={(v) => onChange({ explorationReward: v })}
          min={0}
          hint="Base reward for exploration"
        />
        <div className="grid grid-cols-2 gap-4 mt-4">
          <NumberInput
            label="Shards Mines Win Prob (%)"
            value={config.shardsMinesWinProbability}
            onChange={(v) => onChange({ shardsMinesWinProbability: Math.min(100, Math.max(0, v)) })}
            min={0}
            max={100}
          />
          <NumberInput
            label="Shards Mines Fail Prob (%)"
            value={config.shardsMinesFailProbability}
            onChange={(v) => onChange({ shardsMinesFailProbability: Math.min(100, Math.max(0, v)) })}
            min={0}
            max={100}
          />
          <NumberInput
            label="Agent Find Prob (%)"
            value={config.agentFindProbability}
            onChange={(v) => onChange({ agentFindProbability: Math.min(100, Math.max(0, v)) })}
            min={0}
            max={100}
          />
          <NumberInput
            label="Agent Find Fail Prob (%)"
            value={config.agentFindFailProbability}
            onChange={(v) => onChange({ agentFindFailProbability: Math.min(100, Math.max(0, v)) })}
            min={0}
            max={100}
          />
          <NumberInput
            label="Village Find Prob (%)"
            value={config.villageFindProbability}
            onChange={(v) => onChange({ villageFindProbability: Math.min(100, Math.max(0, v)) })}
            min={0}
            max={100}
          />
          <NumberInput
            label="Village Find Fail Prob (%)"
            value={config.villageFindFailProbability}
            onChange={(v) => onChange({ villageFindFailProbability: Math.min(100, Math.max(0, v)) })}
            min={0}
            max={100}
          />
          <NumberInput
            label="Hyperstructure Win Prob at Center (%)"
            value={config.hyperstructureWinProbAtCenter}
            onChange={(v) => onChange({ hyperstructureWinProbAtCenter: Math.min(100, Math.max(0, v)) })}
            min={0}
            max={100}
          />
          <NumberInput
            label="Hyperstructure Fail Prob at Center (%)"
            value={config.hyperstructureFailProbAtCenter}
            onChange={(v) => onChange({ hyperstructureFailProbAtCenter: Math.min(100, Math.max(0, v)) })}
            min={0}
            max={100}
          />
          <NumberInput
            label="Quest Find Prob (%)"
            value={config.questFindProbability}
            onChange={(v) => onChange({ questFindProbability: Math.min(100, Math.max(0, v)) })}
            min={0}
            max={100}
          />
          <NumberInput
            label="Quest Find Fail Prob (%)"
            value={config.questFindFailProbability}
            onChange={(v) => onChange({ questFindFailProbability: Math.min(100, Math.max(0, v)) })}
            min={0}
            max={100}
          />
        </div>
      </CollapsibleSection>

      {/* Troop Stamina */}
      <CollapsibleSection title="Troop Stamina" icon={<Zap className="w-4 h-4" />}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <NumberInput
            label="Stamina Gain Per Tick"
            value={config.staminaGainPerTick}
            onChange={(v) => onChange({ staminaGainPerTick: v })}
            min={0}
          />
          <NumberInput
            label="Initial Stamina"
            value={config.staminaInitial}
            onChange={(v) => onChange({ staminaInitial: v })}
            min={0}
          />
          <NumberInput
            label="Stamina Bonus Value"
            value={config.staminaBonusValue}
            onChange={(v) => onChange({ staminaBonusValue: v })}
            min={0}
          />
          <NumberInput
            label="Knight Max Stamina"
            value={config.staminaKnightMax}
            onChange={(v) => onChange({ staminaKnightMax: v })}
            min={0}
          />
          <NumberInput
            label="Paladin Max Stamina"
            value={config.staminaPaladinMax}
            onChange={(v) => onChange({ staminaPaladinMax: v })}
            min={0}
          />
          <NumberInput
            label="Crossbowman Max Stamina"
            value={config.staminaCrossbowmanMax}
            onChange={(v) => onChange({ staminaCrossbowmanMax: v })}
            min={0}
          />
          <NumberInput
            label="Attack Stamina Req"
            value={config.staminaAttackReq}
            onChange={(v) => onChange({ staminaAttackReq: v })}
            min={0}
          />
          <NumberInput
            label="Defense Stamina Req"
            value={config.staminaDefenseReq}
            onChange={(v) => onChange({ staminaDefenseReq: v })}
            min={0}
          />
        </div>
        <div className="mt-4 pt-4 border-t border-gold/10">
          <p className="text-xs text-gold/60 mb-3">Exploration Costs</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <NumberInput
              label="Wheat Cost"
              value={config.staminaExploreWheatCost}
              onChange={(v) => onChange({ staminaExploreWheatCost: v })}
              min={0}
            />
            <NumberInput
              label="Fish Cost"
              value={config.staminaExploreFishCost}
              onChange={(v) => onChange({ staminaExploreFishCost: v })}
              min={0}
            />
            <NumberInput
              label="Stamina Cost"
              value={config.staminaExploreStaminaCost}
              onChange={(v) => onChange({ staminaExploreStaminaCost: v })}
              min={0}
            />
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-gold/10">
          <p className="text-xs text-gold/60 mb-3">Travel Costs</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <NumberInput
              label="Wheat Cost"
              value={config.staminaTravelWheatCost}
              onChange={(v) => onChange({ staminaTravelWheatCost: v })}
              min={0}
            />
            <NumberInput
              label="Fish Cost"
              value={config.staminaTravelFishCost}
              onChange={(v) => onChange({ staminaTravelFishCost: v })}
              min={0}
            />
            <NumberInput
              label="Stamina Cost"
              value={config.staminaTravelStaminaCost}
              onChange={(v) => onChange({ staminaTravelStaminaCost: v })}
              min={0}
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* Troop Limits */}
      <CollapsibleSection title="Troop Limits" icon={<Shield className="w-4 h-4" />}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <NumberInput
            label="Explorer Max Party Count"
            value={config.explorerMaxPartyCount}
            onChange={(v) => onChange({ explorerMaxPartyCount: v })}
            min={1}
          />
          <NumberInput
            label="Max Troop Count"
            value={config.explorerAndGuardMaxTroopCount}
            onChange={(v) => onChange({ explorerAndGuardMaxTroopCount: v })}
            min={1}
          />
          <NumberInput
            label="Guard Resurrection Delay (s)"
            value={config.guardResurrectionDelay}
            onChange={(v) => onChange({ guardResurrectionDelay: v })}
            min={0}
          />
          <NumberInput
            label="Mercenaries Lower Bound"
            value={config.mercenariesTroopLowerBound}
            onChange={(v) => onChange({ mercenariesTroopLowerBound: v })}
            min={0}
          />
          <NumberInput
            label="Mercenaries Upper Bound"
            value={config.mercenariesTroopUpperBound}
            onChange={(v) => onChange({ mercenariesTroopUpperBound: v })}
            min={0}
          />
        </div>
      </CollapsibleSection>

      {/* Settlement */}
      <CollapsibleSection title="Settlement" icon={<Map className="w-4 h-4" />}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <NumberInput
            label="Settlement Center"
            value={config.settlementCenter}
            onChange={(v) => onChange({ settlementCenter: v })}
            min={0}
            hint="Center coordinate for settlements"
          />
          <NumberInput
            label="Base Distance"
            value={config.settlementBaseDistance}
            onChange={(v) => onChange({ settlementBaseDistance: v })}
            min={1}
            hint="Base distance between settlements"
          />
          <NumberInput
            label="Subsequent Distance"
            value={config.settlementSubsequentDistance}
            onChange={(v) => onChange({ settlementSubsequentDistance: v })}
            min={1}
            hint="Distance for subsequent settlements"
          />
        </div>
      </CollapsibleSection>

      {/* Population */}
      <CollapsibleSection title="Population" icon={<Home className="w-4 h-4" />}>
        <NumberInput
          label="Base Population"
          value={config.basePopulation}
          onChange={(v) => onChange({ basePopulation: Math.max(1, v) })}
          min={1}
          hint="Starting population capacity"
        />
      </CollapsibleSection>

      {/* Trade */}
      <CollapsibleSection title="Trade" icon={<TrendingUp className="w-4 h-4" />}>
        <NumberInput
          label="Max Trade Count"
          value={config.tradeMaxCount}
          onChange={(v) => onChange({ tradeMaxCount: Math.max(1, v) })}
          min={1}
          hint="Maximum number of active trades"
        />
      </CollapsibleSection>
    </div>
  );
};
