import { Clock, Users, Coins, Settings, ToggleLeft, ToggleRight } from "lucide-react";
import type { GamePresetConfigOverrides } from "../../types/game-presets";

interface ConfigEditorProps {
  config: GamePresetConfigOverrides;
  onChange: (updates: Partial<GamePresetConfigOverrides>) => void;
}

export const ConfigEditor = ({ config, onChange }: ConfigEditorProps) => {
  return (
    <div className="p-6 panel-wood rounded-xl border border-gold/30 space-y-6">
      <h3 className="text-lg font-bold text-gold">Game Configuration</h3>

      {/* Duration */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-gold">
          <Clock className="w-4 h-4 text-gold" />
          Duration
        </label>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gold/60 mb-1 block">Hours</label>
            <input
              type="number"
              min="0"
              max="72"
              value={config.durationHours}
              onChange={(e) => onChange({ durationHours: Math.max(0, parseInt(e.target.value) || 0) })}
              className="w-full px-4 py-3 bg-brown/50 border border-gold/30 rounded-xl text-gold focus:border-gold focus:ring-1 focus:ring-gold/30 outline-none transition-all"
            />
          </div>
          <div>
            <label className="text-xs text-gold/60 mb-1 block">Minutes</label>
            <input
              type="number"
              min="0"
              max="59"
              value={config.durationMinutes}
              onChange={(e) => onChange({ durationMinutes: Math.min(59, Math.max(0, parseInt(e.target.value) || 0)) })}
              className="w-full px-4 py-3 bg-brown/50 border border-gold/30 rounded-xl text-gold focus:border-gold focus:ring-1 focus:ring-gold/30 outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* Max Players */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-gold">
          <Users className="w-4 h-4 text-gold" />
          Max Players
        </label>
        <input
          type="number"
          min="2"
          max="1000"
          value={config.registrationCountMax}
          onChange={(e) => onChange({ registrationCountMax: Math.max(2, parseInt(e.target.value) || 2) })}
          className="w-full px-4 py-3 bg-brown/50 border border-gold/30 rounded-xl text-gold focus:border-gold focus:ring-1 focus:ring-gold/30 outline-none transition-all"
        />
      </div>

      {/* Entry Fee */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-gold">
          <Coins className="w-4 h-4 text-orange" />
          Entry Fee
        </label>
        <div className="flex items-center gap-4">
          <button
            onClick={() => onChange({ hasFee: !config.hasFee })}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg border transition-all
              ${config.hasFee ? "bg-orange/20 border-orange/50 text-orange" : "bg-brown/50 border-gold/20 text-gold/60"}
            `}
          >
            {config.hasFee ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
            {config.hasFee ? "Enabled" : "Disabled"}
          </button>
          {config.hasFee && (
            <input
              type="text"
              value={config.feeAmount}
              onChange={(e) => onChange({ feeAmount: e.target.value })}
              placeholder="Amount"
              className="flex-1 px-4 py-2 bg-brown/50 border border-gold/30 rounded-xl text-gold focus:border-gold focus:ring-1 focus:ring-gold/30 outline-none transition-all"
            />
          )}
        </div>
      </div>

      {/* Mode Toggles */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-gold">
          <Settings className="w-4 h-4 text-gold" />
          Game Modes
        </label>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => onChange({ devMode: !config.devMode })}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg border transition-all
              ${config.devMode ? "bg-brilliance/20 border-brilliance/50 text-brilliance" : "bg-brown/50 border-gold/20 text-gold/60"}
            `}
          >
            {config.devMode ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
            Dev Mode
          </button>
          <button
            onClick={() => onChange({ singleRealmMode: !config.singleRealmMode })}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg border transition-all
              ${config.singleRealmMode ? "bg-gold/20 border-gold/50 text-gold" : "bg-brown/50 border-gold/20 text-gold/60"}
            `}
          >
            {config.singleRealmMode ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
            Single Realm Mode
          </button>
        </div>
      </div>
    </div>
  );
};
