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
    <div className="p-6 panel-wood rounded-xl border border-gold/20">
      <h3 className="text-lg font-bold text-gold mb-4">Configuration Summary</h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Duration */}
        <div className="flex items-center gap-3 p-3 bg-brown/50 rounded-xl border border-gold/10">
          <div className="p-2 bg-gold/20 rounded-lg">
            <Clock className="w-4 h-4 text-gold" />
          </div>
          <div>
            <p className="text-xs text-gold/60">Duration</p>
            <p className="text-sm font-semibold text-gold">{formatDuration()}</p>
          </div>
        </div>

        {/* Max Players */}
        <div className="flex items-center gap-3 p-3 bg-brown/50 rounded-xl border border-gold/10">
          <div className="p-2 bg-gold/20 rounded-lg">
            <Users className="w-4 h-4 text-gold" />
          </div>
          <div>
            <p className="text-xs text-gold/60">Max Players</p>
            <p className="text-sm font-semibold text-gold">{config.registrationCountMax}</p>
          </div>
        </div>

        {/* Entry Fee */}
        <div className="flex items-center gap-3 p-3 bg-brown/50 rounded-xl border border-gold/10">
          <div className={`p-2 rounded-lg ${config.hasFee ? "bg-orange/20" : "bg-brown/30"}`}>
            <Coins className={`w-4 h-4 ${config.hasFee ? "text-orange" : "text-gold/40"}`} />
          </div>
          <div>
            <p className="text-xs text-gold/60">Entry Fee</p>
            <p className="text-sm font-semibold text-gold">{formatFee()}</p>
          </div>
        </div>

        {/* Mode */}
        <div className="flex items-center gap-3 p-3 bg-brown/50 rounded-xl border border-gold/10">
          <div className={`p-2 rounded-lg ${config.devMode ? "bg-brilliance/20" : "bg-brown/30"}`}>
            <Settings className={`w-4 h-4 ${config.devMode ? "text-brilliance" : "text-gold/40"}`} />
          </div>
          <div>
            <p className="text-xs text-gold/60">Mode</p>
            <p className="text-sm font-semibold text-gold">{config.devMode ? "Dev Mode" : "Production"}</p>
          </div>
        </div>
      </div>

      {/* Additional details */}
      <div className="mt-4 pt-4 border-t border-gold/20">
        <div className="flex flex-wrap gap-2">
          {config.singleRealmMode && (
            <span className="px-2 py-1 bg-gold/20 text-gold text-xs font-medium rounded-md">Single Realm Mode</span>
          )}
          {config.hasFee && (
            <span className="px-2 py-1 bg-orange/20 text-orange text-xs font-medium rounded-md">Blitz Mode</span>
          )}
          {config.devMode && (
            <span className="px-2 py-1 bg-brilliance/20 text-brilliance text-xs font-medium rounded-md">Dev Features Enabled</span>
          )}
        </div>
      </div>
    </div>
  );
};
