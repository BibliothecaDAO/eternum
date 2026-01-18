import { RefreshCw } from "lucide-react";
import type { DeploymentState } from "../../types/game-presets";
import { formatDateTimeLocal, parseDateTimeLocal, getNextHourEpoch } from "../../utils/preset-to-config";

// Maximum hours in the future that a game start time can be set
const MAX_START_TIME_HOURS = 50_000;

interface GameDetailsFormProps {
  deployment: DeploymentState;
  onUpdate: (updates: Partial<DeploymentState>) => void;
  onRegenerateWorldName: () => void;
}

export const GameDetailsForm = ({ deployment, onUpdate, onRegenerateWorldName }: GameDetailsFormProps) => {
  const nowSec = Math.floor(Date.now() / 1000);
  const maxAllowed = nowSec + MAX_START_TIME_HOURS * 3600;

  // Calculate min/max for datetime input
  const getMinDateTime = () => {
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const getMaxDateTime = () => {
    const d = new Date(maxAllowed * 1000);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const handleStartTimeChange = (value: string) => {
    if (!value) {
      onUpdate({ startTime: 0 });
      return;
    }
    const selected = parseDateTimeLocal(value);
    onUpdate({ startTime: selected });
  };

  const isStartTimeValid = () => {
    if (!deployment.startTime || deployment.startTime <= 0) return true;
    return deployment.startTime >= nowSec && deployment.startTime <= maxAllowed;
  };

  return (
    <div className="space-y-6 p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
      <h3 className="text-lg font-bold text-slate-900">Game Details</h3>

      {/* Game name */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700">Game Name</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={deployment.gameName}
            onChange={(e) => onUpdate({ gameName: e.target.value })}
            placeholder="test-fire-gate-42"
            className="flex-1 px-4 py-3 bg-white border-2 border-slate-200 hover:border-blue-300 focus:border-blue-500 rounded-xl text-slate-900 placeholder-slate-400 font-mono focus:outline-none transition-all"
          />
          <button
            onClick={onRegenerateWorldName}
            className="p-3 bg-blue-100 hover:bg-blue-200 rounded-xl transition-colors group"
            title="Generate new game name"
          >
            <RefreshCw className="w-5 h-5 text-blue-600 group-hover:rotate-180 transition-transform duration-500" />
          </button>
        </div>
        <p className="text-xs text-slate-500">A unique identifier for your game world</p>
      </div>

      {/* Start time */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700">Start Time</label>
        <input
          type="datetime-local"
          min={getMinDateTime()}
          max={getMaxDateTime()}
          value={formatDateTimeLocal(deployment.startTime || getNextHourEpoch())}
          onChange={(e) => handleStartTimeChange(e.target.value)}
          className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none transition-all ${
            isStartTimeValid()
              ? "border-slate-200 hover:border-blue-300 focus:border-blue-500"
              : "border-red-300 focus:border-red-500"
          }`}
        />
        {!isStartTimeValid() && (
          <p className="text-xs text-red-600">Start time must be in the future and within {MAX_START_TIME_HOURS.toLocaleString()} hours</p>
        )}
        <p className="text-xs text-slate-500">When the main game phase begins. Defaults to next hour.</p>
      </div>

      {/* Series (optional) */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700">Series (optional)</label>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="Series name"
            value={deployment.seriesName}
            onChange={(e) => onUpdate({ seriesName: e.target.value })}
            className="px-4 py-3 border-2 border-slate-200 hover:border-blue-300 focus:border-blue-500 rounded-xl focus:outline-none transition-all"
          />
          <input
            type="number"
            placeholder="Game #"
            min={0}
            step={1}
            value={deployment.seriesGameNumber}
            onChange={(e) => onUpdate({ seriesGameNumber: e.target.value.replace(/[^\d]/g, "") })}
            className="px-4 py-3 border-2 border-slate-200 hover:border-blue-300 focus:border-blue-500 rounded-xl focus:outline-none transition-all"
          />
        </div>
        <p className="text-xs text-slate-500">Link this game to a series for organized tournaments</p>
      </div>
    </div>
  );
};
