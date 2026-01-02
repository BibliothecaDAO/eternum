import { FC, useMemo } from "react";
import { PointDelta, RankChange, POINT_CATEGORIES, PointCategory } from "../hooks/use-leaderboard-effects";

// Floating Point Delta Effect
interface FloatingPointDeltaProps {
  delta: PointDelta;
}

export const FloatingPointDelta: FC<FloatingPointDeltaProps> = ({ delta }) => {
  const { color, icon, text } = useMemo(() => {
    const isPositive = delta.delta > 0;
    const prefix = isPositive ? '+' : '';
    const baseText = `${prefix}${Math.abs(delta.delta)}`;
    
    switch (delta.category) {
      case POINT_CATEGORIES.REGISTERED:
        return {
          color: isPositive ? 'text-amber-400' : 'text-red-400',
          icon: '',
          text: baseText,
        };
      case POINT_CATEGORIES.UNREGISTERED_SHAREHOLDER:
        return {
          color: isPositive ? 'text-emerald-400' : 'text-red-400', 
          icon: '⚡',
          text: baseText,
        };
      case POINT_CATEGORIES.TOTAL_SIGNIFICANT:
        return {
          color: isPositive ? 'text-amber-500' : 'text-red-500',
          icon: '',
          text: baseText,
        };
      default:
        return {
          color: isPositive ? 'text-amber-400' : 'text-red-400',
          icon: '',
          text: baseText,
        };
    }
  }, [delta]);

  return (
    <div 
      className={`
        absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-full z-10
        ${color} text-sm font-bold
        animate-float-up-fade pointer-events-none
        px-2 py-1 rounded-md
        bg-black/80 border border-current/30
        shadow-lg
      `}
      style={{
        animationDuration: '3000ms',
        animationFillMode: 'forwards',
      }}
    >
      <span className="flex items-center gap-1">
        {icon && <span className="text-xs">{icon}</span>}
        <span>{text}</span>
      </span>
    </div>
  );
};

// Rank Change Indicator
interface RankChangeIndicatorProps {
  change: RankChange;
}

export const RankChangeIndicator: FC<RankChangeIndicatorProps> = ({ change }) => {
  const { isImprovement, icon, color, text } = useMemo(() => {
    const isImprovement = change.newRank < change.oldRank; // Lower rank number is better
    const rankDiff = Math.abs(change.newRank - change.oldRank);
    
    return {
      isImprovement,
      icon: isImprovement ? '↗' : '↘',
      color: isImprovement ? 'text-green-400' : 'text-red-400',
      text: rankDiff > 1 ? `${rankDiff}` : '',
    };
  }, [change]);

  return (
    <div 
      className={`
        absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-full z-10
        ${color} text-lg font-bold
        animate-bounce-fade pointer-events-none
        px-2 py-1 rounded-md
        bg-black/80 border border-current/30
        shadow-lg
      `}
      style={{
        animationDuration: '3000ms',
        animationFillMode: 'forwards',
      }}
    >
      <span className="flex items-center gap-1">
        <span className="text-sm">{icon}</span>
        {text && <span className="text-xs">({text})</span>}
      </span>
    </div>
  );
};

// Combined Effects Container
interface LeaderboardEffectsContainerProps {
  playerId: string;
  pointDeltas: PointDelta[];
  rankChanges: RankChange[];
}

export const LeaderboardEffectsContainer: FC<LeaderboardEffectsContainerProps> = ({
  pointDeltas,
  rankChanges,
}) => {
  // Only render if there are effects
  if (pointDeltas.length === 0 && rankChanges.length === 0) {
    return null;
  }

  return (
    <>
      {/* Point Delta Effects */}
      {pointDeltas.map((delta, index) => (
        <FloatingPointDelta
          key={`delta-${delta.timestamp}-${index}`}
          delta={delta}
        />
      ))}
      
      {/* Rank Change Effects */}
      {rankChanges.map((change, index) => (
        <RankChangeIndicator
          key={`rank-${change.timestamp}-${index}`}
          change={change}
        />
      ))}
    </>
  );
};

// Mockup Mode Indicator (for development/demo)
interface MockupModeIndicatorProps {
  isMockupMode: boolean;
}

export const MockupModeIndicator: FC<MockupModeIndicatorProps> = ({ isMockupMode }) => {
  if (!isMockupMode) return null;

  return (
    <div className="fixed top-4 right-4 z-50 bg-purple-600/90 text-white px-3 py-1 rounded-lg text-sm font-bold border border-purple-400 shadow-lg">
      <span className="animate-pulse">📊 MOCKUP MODE</span>
    </div>
  );
};