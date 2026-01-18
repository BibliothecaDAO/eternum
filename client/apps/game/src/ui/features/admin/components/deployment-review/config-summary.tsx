import { Clock, Users, Coins, Settings } from "lucide-react";
import type { GamePreset, GamePresetConfigOverrides } from "../../types/game-presets";

interface ConfigSummaryProps {
  preset: GamePreset;
  customOverrides: Partial<GamePresetConfigOverrides>;
}

export const ConfigSummary = ({ preset, customOverrides }: ConfigSummaryProps) => {
  const config = {
    ...preset.configOverrides,
    ...customOverrides,
  };

  const formatDuration = () => {
    const hours = config.durationHours || 0;
    const minutes = config.durationMinutes || 0;
    if (hours === 0 && minutes === 0) return "0 minutes";
    if (hours === 0) return `${minutes} minutes`;
    if (minutes === 0) return `${hours} hour${hours > 1 ? "s" : ""}`;
    return `${hours}h ${minutes}m`;
  };

  const formatFee = () => {
    if (!config.hasFee) return "Free";
    const amount = config.feeAmount || "0";
    // Simplify display for small testnet values
    if (amount.startsWith("0.00000")) return "Entry fee (testnet)";
    return `${amount} LORDS`;
  };

  return (
    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
      <h3 className="text-lg font-bold text-slate-900 mb-4">Configuration Summary</h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Duration */}
        <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Duration</p>
            <p className="text-sm font-semibold text-slate-900">{formatDuration()}</p>
          </div>
        </div>

        {/* Max Players */}
        <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200">
          <div className="p-2 bg-green-100 rounded-lg">
            <Users className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Max Players</p>
            <p className="text-sm font-semibold text-slate-900">{config.registrationCountMax}</p>
          </div>
        </div>

        {/* Entry Fee */}
        <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200">
          <div className={`p-2 rounded-lg ${config.hasFee ? "bg-amber-100" : "bg-slate-100"}`}>
            <Coins className={`w-4 h-4 ${config.hasFee ? "text-amber-600" : "text-slate-400"}`} />
          </div>
          <div>
            <p className="text-xs text-slate-500">Entry Fee</p>
            <p className="text-sm font-semibold text-slate-900">{formatFee()}</p>
          </div>
        </div>

        {/* Mode */}
        <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200">
          <div className={`p-2 rounded-lg ${config.devMode ? "bg-purple-100" : "bg-slate-100"}`}>
            <Settings className={`w-4 h-4 ${config.devMode ? "text-purple-600" : "text-slate-400"}`} />
          </div>
          <div>
            <p className="text-xs text-slate-500">Mode</p>
            <p className="text-sm font-semibold text-slate-900">{config.devMode ? "Dev Mode" : "Production"}</p>
          </div>
        </div>
      </div>

      {/* Additional details */}
      <div className="mt-4 pt-4 border-t border-slate-200">
        <div className="flex flex-wrap gap-2">
          {config.singleRealmMode && (
            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-md">Single Realm Mode</span>
          )}
          {config.hasFee && (
            <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-md">Blitz Mode</span>
          )}
          {config.devMode && (
            <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-md">Dev Features Enabled</span>
          )}
        </div>
      </div>
    </div>
  );
};
