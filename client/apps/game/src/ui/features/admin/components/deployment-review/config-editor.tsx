import { Clock, Users, Coins, Settings, ToggleLeft, ToggleRight } from "lucide-react";
import type { GamePresetConfigOverrides } from "../../types/game-presets";

interface ConfigEditorProps {
  config: GamePresetConfigOverrides;
  onChange: (updates: Partial<GamePresetConfigOverrides>) => void;
}

export const ConfigEditor = ({ config, onChange }: ConfigEditorProps) => {
  return (
    <div className="p-6 bg-white rounded-2xl border-2 border-blue-200 space-y-6">
      <h3 className="text-lg font-bold text-slate-900">Game Configuration</h3>

      {/* Duration */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Clock className="w-4 h-4 text-blue-600" />
          Duration
        </label>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Hours</label>
            <input
              type="number"
              min="0"
              max="72"
              value={config.durationHours}
              onChange={(e) => onChange({ durationHours: Math.max(0, parseInt(e.target.value) || 0) })}
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Minutes</label>
            <input
              type="number"
              min="0"
              max="59"
              value={config.durationMinutes}
              onChange={(e) => onChange({ durationMinutes: Math.min(59, Math.max(0, parseInt(e.target.value) || 0)) })}
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* Max Players */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Users className="w-4 h-4 text-green-600" />
          Max Players
        </label>
        <input
          type="number"
          min="2"
          max="1000"
          value={config.registrationCountMax}
          onChange={(e) => onChange({ registrationCountMax: Math.max(2, parseInt(e.target.value) || 2) })}
          className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
        />
      </div>

      {/* Entry Fee */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Coins className="w-4 h-4 text-amber-600" />
          Entry Fee
        </label>
        <div className="flex items-center gap-4">
          <button
            onClick={() => onChange({ hasFee: !config.hasFee })}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all
              ${config.hasFee ? "bg-amber-50 border-amber-300 text-amber-700" : "bg-slate-50 border-slate-200 text-slate-600"}
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
              className="flex-1 px-4 py-2 border-2 border-slate-200 rounded-xl focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
            />
          )}
        </div>
      </div>

      {/* Mode Toggles */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Settings className="w-4 h-4 text-purple-600" />
          Game Modes
        </label>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => onChange({ devMode: !config.devMode })}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all
              ${config.devMode ? "bg-purple-50 border-purple-300 text-purple-700" : "bg-slate-50 border-slate-200 text-slate-600"}
            `}
          >
            {config.devMode ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
            Dev Mode
          </button>
          <button
            onClick={() => onChange({ singleRealmMode: !config.singleRealmMode })}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all
              ${config.singleRealmMode ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-slate-50 border-slate-200 text-slate-600"}
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
