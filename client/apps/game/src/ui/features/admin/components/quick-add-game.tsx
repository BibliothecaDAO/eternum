import { RefreshCw, Plus } from "lucide-react";
import { useState } from "react";

interface QuickAddGameProps {
  gameName: string;
  seriesName: string;
  seriesGameNumber: string;
  onGameNameChange: (name: string) => void;
  onSeriesNameChange: (name: string) => void;
  onSeriesGameNumberChange: (num: string) => void;
  onRegenerateWorldName: () => void;
  onAddToQueue: () => void;
  isNameInQueue: boolean;
}

export const QuickAddGame = ({
  gameName,
  seriesName,
  seriesGameNumber,
  onGameNameChange,
  onSeriesNameChange,
  onSeriesGameNumberChange,
  onRegenerateWorldName,
  onAddToQueue,
  isNameInQueue,
}: QuickAddGameProps) => {
  const [showSeries, setShowSeries] = useState(false);

  const canAdd = gameName.trim() && !isNameInQueue;

  return (
    <div className="mb-8 p-6 panel-wood rounded-xl border border-gold/20">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gold">Add Game to Queue</h3>
          <button
            onClick={() => setShowSeries(!showSeries)}
            className={`text-sm font-medium transition-colors ${
              showSeries ? "text-gold" : "text-gold/60 hover:text-gold"
            }`}
          >
            {showSeries ? "Hide Series" : "+ Add Series"}
          </button>
        </div>

        {/* Game Name Input */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 flex gap-2">
            <input
              type="text"
              value={gameName}
              onChange={(e) => onGameNameChange(e.target.value)}
              placeholder="test-fire-gate-42"
              className="flex-1 px-4 py-3 bg-brown/50 border border-gold/30 hover:border-gold/50 focus:border-gold rounded-xl text-gold placeholder-gold/40 font-mono focus:outline-none transition-all"
            />
            <button
              onClick={onRegenerateWorldName}
              className="p-3 bg-gold/20 hover:bg-gold/30 rounded-xl transition-colors group"
              title="Generate new game name"
            >
              <RefreshCw className="w-5 h-5 text-gold group-hover:rotate-180 transition-transform duration-500" />
            </button>
          </div>
          <button
            onClick={onAddToQueue}
            disabled={!canAdd}
            className={`
              px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all
              ${
                canAdd
                  ? "bg-gold hover:bg-gold/80 text-brown"
                  : "bg-brown/50 text-gold/40 cursor-not-allowed"
              }
            `}
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">Add to Queue</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>

        {/* Series Fields (Collapsible) */}
        {showSeries && (
          <div className="pt-4 border-t border-gold/10 space-y-3">
            <p className="text-xs text-gold/60">Link this game to a series for organized tournaments</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Series name"
                value={seriesName}
                onChange={(e) => onSeriesNameChange(e.target.value)}
                className="px-4 py-3 bg-brown/50 border border-gold/30 hover:border-gold/50 focus:border-gold rounded-xl text-gold placeholder-gold/40 focus:outline-none transition-all"
              />
              <input
                type="number"
                placeholder="Game #"
                min={0}
                step={1}
                value={seriesGameNumber}
                onChange={(e) => onSeriesGameNumberChange(e.target.value.replace(/[^\d]/g, ""))}
                className="px-4 py-3 bg-brown/50 border border-gold/30 hover:border-gold/50 focus:border-gold rounded-xl text-gold placeholder-gold/40 focus:outline-none transition-all"
              />
            </div>
          </div>
        )}

        {/* Helper Text */}
        <p className="text-xs text-gold/60">
          Add games to the queue first, then deploy and configure them individually below
        </p>

        {/* Warning if name already in queue */}
        {isNameInQueue && gameName.trim() && (
          <p className="text-xs text-orange">This game name is already in the queue</p>
        )}
      </div>
    </div>
  );
};
