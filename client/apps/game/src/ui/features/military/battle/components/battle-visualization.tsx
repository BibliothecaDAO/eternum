import { divideByPrecision } from "@bibliothecadao/eternum";
import { TroopType, Troops } from "@bibliothecadao/types";
import { Crown, Shield, Swords } from "lucide-react";

interface BattleVisualizationProps {
  attackerTroops: Troops;
  defenderTroops: Troops;
  attackerRemaining: number;
  defenderRemaining: number;
  winner: number | null;
  attackerEntityId: number;
  className?: string;
}

export const BattleVisualization = ({
  attackerTroops,
  defenderTroops,
  attackerRemaining,
  defenderRemaining,
  winner,
  attackerEntityId,
  className = "",
}: BattleVisualizationProps) => {
  const attackerTotal = divideByPrecision(Number(attackerTroops.count));
  const defenderTotal = divideByPrecision(Number(defenderTroops.count));

  const attackerPercentage = Math.max(0, Math.min(100, (attackerRemaining / attackerTotal) * 100));
  const defenderPercentage = Math.max(0, Math.min(100, (defenderRemaining / defenderTotal) * 100));

  const totalPercentage = attackerPercentage + defenderPercentage;
  const normalizedAttackerWidth = totalPercentage > 0 ? (attackerPercentage / totalPercentage) * 100 : 50;

  const isAttackerWinner = winner === attackerEntityId;
  const isDefenderWinner = winner !== null && winner !== attackerEntityId;

  return (
    <div className={`space-y-4 ${className}`} role="region" aria-label="Battle outcome prediction">
      {/* Battle Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Swords className="w-5 h-5 text-gold" aria-hidden="true" />
          <h2 className="text-lg font-bold text-gold">Battle Prediction</h2>
        </div>
        {winner && (
          <div
            className="flex items-center gap-2 px-3 py-1 rounded-full bg-gold/20"
            role="status"
            aria-label="Battle outcome prediction"
          >
            <Crown className="w-4 h-4 text-gold" aria-hidden="true" />
            <span className="text-sm font-medium text-gold">
              {isAttackerWinner ? "Victory Predicted" : "Defeat Predicted"}
            </span>
          </div>
        )}
      </div>

      {/* Force Comparison */}
      <div className="grid grid-cols-2 gap-4 text-sm" role="group" aria-label="Force comparison">
        <div className="text-center">
          <div className="text-gold/70 mb-1">Your Forces</div>
          <div className="text-lg font-bold text-gold">
            {Math.floor(attackerRemaining)} / {Math.floor(attackerTotal)}
          </div>
          <div className="text-xs text-gold/60">
            {TroopType[attackerTroops.category as TroopType]} {attackerTroops.tier}
          </div>
        </div>
        <div className="text-center">
          <div className="text-gold/70 mb-1">Enemy Forces</div>
          <div className="text-lg font-bold text-gold">
            {Math.floor(defenderRemaining)} / {Math.floor(defenderTotal)}
          </div>
          <div className="text-xs text-gold/60">
            {TroopType[defenderTroops.category as TroopType]} {defenderTroops.tier}
          </div>
        </div>
      </div>

      {/* Visual Battle Bar */}
      <div className="relative">
        <div className="flex justify-between text-xs mb-2 text-gold/70">
          <span>Attacker Forces</span>
          <span>Defender Forces</span>
        </div>

        <div className="relative h-8 bg-brown-900/70 rounded-lg overflow-hidden border border-gold/20">
          {/* Attacker Side */}
          <div
            className={`absolute h-full transition-all duration-500 flex items-center justify-center ${
              isAttackerWinner ? "bg-green-500/60" : "bg-gold/40"
            }`}
            style={{ width: `${normalizedAttackerWidth}%` }}
          >
            <div className="flex items-center gap-1 text-xs font-bold text-white">
              <Shield className="w-3 h-3" />
              <span>{Math.floor(attackerRemaining)}</span>
            </div>
          </div>

          {/* Defender Side */}
          <div
            className={`absolute right-0 h-full transition-all duration-500 flex items-center justify-center ${
              isDefenderWinner ? "bg-green-500/60" : "bg-red-500/60"
            }`}
            style={{ width: `${100 - normalizedAttackerWidth}%` }}
          >
            <div className="flex items-center gap-1 text-xs font-bold text-white">
              <Shield className="w-3 h-3" />
              <span>{Math.floor(defenderRemaining)}</span>
            </div>
          </div>

          {/* Center Divider */}
          <div className="absolute h-full w-0.5 bg-white/30" style={{ left: `${normalizedAttackerWidth}%` }} />

          {/* Winner Indicator */}
          {winner && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className={`px-2 py-1 rounded-full text-xs font-bold ${
                  isAttackerWinner ? "bg-green-500/80 text-white" : "bg-red-500/80 text-white"
                }`}
              >
                {isAttackerWinner ? "VICTORY" : "DEFEAT"}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Battle Summary */}
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div className="p-2 bg-brown-900/30 rounded border border-gold/10">
          <div className="text-gold/70 mb-1">Casualties</div>
          <div className="text-red-400 font-bold">-{Math.ceil(attackerTotal - attackerRemaining)}</div>
          <div className="text-gold/60">
            ({Math.round(((attackerTotal - attackerRemaining) / attackerTotal) * 100)}%)
          </div>
        </div>
        <div className="p-2 bg-brown-900/30 rounded border border-gold/10">
          <div className="text-gold/70 mb-1">Enemy Casualties</div>
          <div className="text-orange-400 font-bold">-{Math.ceil(defenderTotal - defenderRemaining)}</div>
          <div className="text-gold/60">
            ({Math.round(((defenderTotal - defenderRemaining) / defenderTotal) * 100)}%)
          </div>
        </div>
      </div>
    </div>
  );
};
