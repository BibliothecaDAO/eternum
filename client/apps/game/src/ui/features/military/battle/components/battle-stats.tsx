import { Trophy, Skull, Zap, Target } from "lucide-react";

interface BattleStatsProps {
  attackerCasualties: number;
  defenderCasualties: number;
  attackerCasualtyPercentage: number;
  defenderCasualtyPercentage: number;
  staminaChange: number;
  outcome: "Victory" | "Defeat" | "Draw";
  className?: string;
}

export const BattleStats = ({
  attackerCasualties,
  defenderCasualties,
  attackerCasualtyPercentage,
  defenderCasualtyPercentage,
  staminaChange,
  outcome,
  className = "",
}: BattleStatsProps) => {
  const getOutcomeColor = (outcome: string) => {
    switch (outcome) {
      case "Victory":
        return "text-green-400";
      case "Defeat":
        return "text-red-400";
      default:
        return "text-yellow-400";
    }
  };

  const getOutcomeIcon = (outcome: string) => {
    switch (outcome) {
      case "Victory":
        return <Trophy className="w-4 h-4" />;
      case "Defeat":
        return <Skull className="w-4 h-4" />;
      default:
        return <Target className="w-4 h-4" />;
    }
  };

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 ${className}`}>
      {/* Attacker Casualties */}
      <div className="p-2 sm:p-3 border border-gold/20 rounded-lg bg-brown-900/50 text-center">
        <div className="flex items-center justify-center gap-1 sm:gap-2 mb-1 sm:mb-2">
          <Skull className="w-3 h-3 sm:w-4 sm:h-4 text-red-400 flex-shrink-0" />
          <span className="text-xs text-gold/70 truncate">Your Casualties</span>
        </div>
        <div className="text-base sm:text-lg font-bold text-red-400">
          {Math.ceil(attackerCasualties)}
        </div>
        <div className="text-xs text-gold/60 mt-1">
          ({attackerCasualtyPercentage}%)
        </div>
      </div>

      {/* Defender Casualties */}
      <div className="p-2 sm:p-3 border border-gold/20 rounded-lg bg-brown-900/50 text-center">
        <div className="flex items-center justify-center gap-1 sm:gap-2 mb-1 sm:mb-2">
          <Skull className="w-3 h-3 sm:w-4 sm:h-4 text-orange-400 flex-shrink-0" />
          <span className="text-xs text-gold/70 truncate">Enemy Casualties</span>
        </div>
        <div className="text-base sm:text-lg font-bold text-orange-400">
          {Math.ceil(defenderCasualties)}
        </div>
        <div className="text-xs text-gold/60 mt-1">
          ({defenderCasualtyPercentage}%)
        </div>
      </div>

      {/* Stamina Change */}
      <div className="p-2 sm:p-3 border border-gold/20 rounded-lg bg-brown-900/50 text-center">
        <div className="flex items-center justify-center gap-1 sm:gap-2 mb-1 sm:mb-2">
          <Zap className="w-3 h-3 sm:w-4 sm:h-4 text-blue-400 flex-shrink-0" />
          <span className="text-xs text-gold/70 truncate">Stamina Change</span>
        </div>
        <div className={`text-base sm:text-lg font-bold ${staminaChange >= 0 ? "text-green-400" : "text-red-400"}`}>
          {staminaChange >= 0 ? "+" : ""}{staminaChange}
        </div>
      </div>

      {/* Battle Outcome */}
      <div className="p-2 sm:p-3 border border-gold/20 rounded-lg bg-brown-900/50 text-center">
        <div className="flex items-center justify-center gap-1 sm:gap-2 mb-1 sm:mb-2">
          <div className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0">{getOutcomeIcon(outcome)}</div>
          <span className="text-xs text-gold/70 truncate">Outcome</span>
        </div>
        <div className={`text-base sm:text-lg font-bold ${getOutcomeColor(outcome)}`}>
          {outcome}
        </div>
      </div>
    </div>
  );
};