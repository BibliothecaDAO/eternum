interface HyperstructureVPDisplayProps {
  /** hyp_points_per_second × the multiplier the chain holds for this hyperstructure. */
  pointsPerSecond: number;
  /** Realms inside the check radius now: what the multiplier becomes at the next claim. */
  realmCount: number;
  isOwned: boolean;
  className?: string;
}

const formatPointsPerSecond = (value: number): string => Math.round(value).toLocaleString();

export const HyperstructureVPDisplay = ({
  pointsPerSecond,
  realmCount,
  isOwned,
  className = "",
}: HyperstructureVPDisplayProps) => (
  <div
    className={`mt-1 flex items-center gap-1.5 rounded px-2 py-0.5 transition-all duration-300 ${
      isOwned
        ? "animate-slowPulse border border-order-brilliance/30 bg-order-brilliance/20"
        : "border border-dashed border-gray-600/30"
    } ${className}`}
    title={`${realmCount} realm${realmCount === 1 ? "" : "s"} in range`}
  >
    <span className={`text-xs ${isOwned ? "text-order-brilliance" : ""}`}>{isOwned ? "⚡" : "💤"}</span>
    <span className={`text-xs font-bold ${isOwned ? "text-order-brilliance text-shadow-glow-brilliance-xs" : ""}`}>
      {formatPointsPerSecond(pointsPerSecond)}
    </span>
    <span className={`text-xxs font-normal ${isOwned ? "text-order-brilliance/80" : ""}`}>
      {isOwned ? "VP/s" : "VP/s (unclaimed)"}
    </span>
    <span className="ml-auto text-xxs text-gold/50">{realmCount} realms</span>
  </div>
);
