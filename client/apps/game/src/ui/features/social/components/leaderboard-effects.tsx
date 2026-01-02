import { ContractAddress } from "@bibliothecadao/types";
import clsx from "clsx";
import { TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { PointDelta, RankChange } from "@/hooks/helpers/use-leaderboard-effects";
import { currencyIntlFormat } from "@/ui/utils/utils";

interface PointDeltaEffectProps {
  delta: PointDelta;
  isVisible: boolean;
}

export const PointDeltaEffect = ({ delta, isVisible }: PointDeltaEffectProps) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setMounted(true);
    }
  }, [isVisible]);

  if (!isVisible || !mounted) return null;

  const formatDelta = (value: number) => {
    if (value >= 1000) {
      return `+${currencyIntlFormat(value)}`;
    }
    return `+${value}`;
  };

  return (
    <div
      className={clsx(
        "absolute right-0 top-0 pointer-events-none z-20",
        "animate-[pointGain_3s_ease-out_forwards]",
        "opacity-0"
      )}
      style={{
        color: delta.color,
        textShadow: `0 0 6px ${delta.color}`,
        animationDelay: "0.1s"
      }}
    >
      <div className="text-sm font-bold whitespace-nowrap">
        {formatDelta(delta.delta)}
        {delta.type === 'unregistered' && (
          <span className="ml-1 text-xs">⚡</span>
        )}
      </div>
    </div>
  );
};

interface RankChangeEffectProps {
  change: RankChange;
  isVisible: boolean;
}

export const RankChangeEffect = ({ change, isVisible }: RankChangeEffectProps) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setMounted(true);
    }
  }, [isVisible]);

  if (!isVisible || !mounted || change.direction === 'none') return null;

  const isRankUp = change.direction === 'up';
  const rankDifference = Math.abs(change.newRank - change.oldRank);

  return (
    <div
      className={clsx(
        "absolute left-0 top-0 pointer-events-none z-20",
        "animate-[rankChange_3s_ease-out_forwards]",
        "opacity-0 flex items-center"
      )}
      style={{
        animationDelay: "0.2s"
      }}
    >
      <div className={clsx(
        "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md",
        "shadow-lg",
        {
          "bg-emerald-500/20 border border-emerald-400/50 text-emerald-300": isRankUp,
          "bg-red-500/20 border border-red-400/50 text-red-300": !isRankUp,
        }
      )}>
        {isRankUp ? (
          <TrendingUp className="w-3 h-3" />
        ) : (
          <TrendingDown className="w-3 h-3" />
        )}
        <span>
          {rankDifference === 1 ? '' : rankDifference}
        </span>
      </div>
    </div>
  );
};

interface LeaderboardRowEffectsProps {
  address: ContractAddress;
  pointDeltas: PointDelta[];
  rankChanges: RankChange[];
  className?: string;
}

export const LeaderboardRowEffects = ({ 
  address, 
  pointDeltas, 
  rankChanges, 
  className 
}: LeaderboardRowEffectsProps) => {
  const [visibleEffects, setVisibleEffects] = useState<{
    pointDeltas: Set<number>;
    rankChanges: Set<number>;
  }>({
    pointDeltas: new Set(),
    rankChanges: new Set(),
  });

  useEffect(() => {
    // Show new effects
    const newPointDeltas = new Set(visibleEffects.pointDeltas);
    const newRankChanges = new Set(visibleEffects.rankChanges);

    pointDeltas.forEach((delta, index) => {
      if (!visibleEffects.pointDeltas.has(delta.timestamp)) {
        newPointDeltas.add(delta.timestamp);
        // Hide after duration
        setTimeout(() => {
          setVisibleEffects(prev => ({
            ...prev,
            pointDeltas: new Set([...prev.pointDeltas].filter(t => t !== delta.timestamp))
          }));
        }, 3000);
      }
    });

    rankChanges.forEach((change, index) => {
      if (!visibleEffects.rankChanges.has(change.timestamp)) {
        newRankChanges.add(change.timestamp);
        // Hide after duration
        setTimeout(() => {
          setVisibleEffects(prev => ({
            ...prev,
            rankChanges: new Set([...prev.rankChanges].filter(t => t !== change.timestamp))
          }));
        }, 3000);
      }
    });

    setVisibleEffects({
      pointDeltas: newPointDeltas,
      rankChanges: newRankChanges,
    });
  }, [pointDeltas, rankChanges]);

  const hasEffects = pointDeltas.length > 0 || rankChanges.length > 0;

  if (!hasEffects) return null;

  return (
    <div className={clsx("absolute inset-0 overflow-hidden", className)}>
      {/* Point Delta Effects */}
      {pointDeltas.map((delta) => (
        <PointDeltaEffect
          key={`${delta.address}-${delta.type}-${delta.timestamp}`}
          delta={delta}
          isVisible={visibleEffects.pointDeltas.has(delta.timestamp)}
        />
      ))}
      
      {/* Rank Change Effects */}
      {rankChanges.map((change) => (
        <RankChangeEffect
          key={`${change.address}-${change.timestamp}`}
          change={change}
          isVisible={visibleEffects.rankChanges.has(change.timestamp)}
        />
      ))}
    </div>
  );
};