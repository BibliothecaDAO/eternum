import { Skull, Target, Trophy } from "lucide-react";

interface BattleStatsProps {
  attackerCasualties: number;
  defenderCasualties: number;
  attackerCasualtyPercentage: number;
  defenderCasualtyPercentage: number;
  attackerStaminaChange: number;
  defenderStaminaChange: number;
  attackerCooldownEnd: number;
  defenderCooldownEnd: number;
  outcome: "Victory" | "Defeat" | "Draw";
  className?: string;
  attackerTroopsLeft?: number;
  defenderTroopsLeft?: number;
}

export const BattleStats = ({
  attackerCasualties,
  defenderCasualties,
  attackerCasualtyPercentage,
  defenderCasualtyPercentage,
  attackerStaminaChange,
  defenderStaminaChange,
  attackerCooldownEnd,
  defenderCooldownEnd,
  outcome,
  className = "",
  attackerTroopsLeft,
  defenderTroopsLeft,
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
    <div className={`grid grid-cols-1 lg:grid-cols-3 gap-3 ${className}`}>
      {/* Attacker Side */}
      <div className="flex flex-col gap-3 p-3 border border-gold/20 rounded-lg bg-brown-900/50 text-center">
        <div className="text-gold font-semibold text-sm mb-2 flex items-center justify-center gap-2">
          <span className="text-lg">⚔️</span>
          <span>Attacker</span>
        </div>
        <div>
          <div className="flex items-center justify-center gap-2 mb-1">
            <Skull className="w-4 h-4 text-red-400" />
            <span className="text-xs text-gold/70">Casualties</span>
          </div>
          <div className="text-lg font-bold text-red-400">{Math.ceil(attackerCasualties)}</div>
          <div className="text-xs text-gold/60 mt-1">({attackerCasualtyPercentage}%)</div>
          {typeof attackerTroopsLeft === "number" && (
            <div className="text-xs text-gold/80 mt-2">
              <span className="font-semibold">Troops Left:</span> {Math.max(0, Math.floor(attackerTroopsLeft))}
            </div>
          )}
        </div>
        <div>
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-lg">⚡</span>
            <span className="text-xs text-gold/70">Stamina Change</span>
          </div>
          <div className={`text-lg font-bold ${attackerStaminaChange >= 0 ? "text-green-400" : "text-red-400"}`}>
            {attackerStaminaChange >= 0 ? "+" : ""}
            {attackerStaminaChange}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-lg">⏳</span>
            <span className="text-xs text-gold/70">Cooldown End</span>
          </div>
          <div className="text-base font-bold text-gold">
            {new Date(attackerCooldownEnd * 1000).toLocaleTimeString()}{" "}
            <span className="text-xs ml-2 text-gold/60">({attackerCooldownEnd})</span>
          </div>
        </div>
      </div>

      {/* Outcome */}
      <div className="flex flex-col items-center justify-center gap-3 p-3 border border-gold/20 rounded-lg bg-brown-900/50 text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <div className="w-4 h-4">{getOutcomeIcon(outcome)}</div>
          <span className="text-xs text-gold/70">Outcome</span>
        </div>
        <div className={`text-lg font-bold ${getOutcomeColor(outcome)}`}>{outcome}</div>
      </div>

      {/* Defender Side */}
      <div className="flex flex-col gap-3 p-3 border border-gold/20 rounded-lg bg-brown-900/50 text-center">
        <div className="text-gold font-semibold text-sm mb-2 flex items-center justify-center gap-2">
          <span className="text-lg">🛡️</span>
          <span>Defender</span>
        </div>
        <div>
          <div className="flex items-center justify-center gap-2 mb-1">
            <Skull className="w-4 h-4 text-orange-400" />
            <span className="text-xs text-gold/70">Casualties</span>
          </div>
          <div className="text-lg font-bold text-orange-400">{Math.ceil(defenderCasualties)}</div>
          <div className="text-xs text-gold/60 mt-1">({defenderCasualtyPercentage}%)</div>
          {typeof defenderTroopsLeft === "number" && (
            <div className="text-xs text-gold/80 mt-2">
              <span className="font-semibold">Troops Left:</span> {Math.max(0, Math.floor(defenderTroopsLeft))}
            </div>
          )}
        </div>
        <div>
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-lg">🛡️</span>
            <span className="text-xs text-gold/70">Stamina Change</span>
          </div>
          <div className={`text-lg font-bold ${defenderStaminaChange >= 0 ? "text-green-400" : "text-red-400"}`}>
            {defenderStaminaChange >= 0 ? "+" : ""}
            {defenderStaminaChange}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-lg">⏳</span>
            <span className="text-xs text-gold/70">Cooldown End</span>
          </div>
          <div className="text-base font-bold text-gold">
            {new Date(defenderCooldownEnd * 1000).toLocaleTimeString()}{" "}
            <span className="text-xs ml-2 text-gold/60">({defenderCooldownEnd})</span>
          </div>
        </div>
      </div>
    </div>
  );
};
