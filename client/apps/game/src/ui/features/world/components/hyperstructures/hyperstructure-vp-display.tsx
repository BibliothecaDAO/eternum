interface HyperstructureVPDisplayProps {
  realmCount: number;
  isOwned: boolean;
  className?: string;
}

export const HyperstructureVPDisplay = ({ realmCount, isOwned, className = "" }: HyperstructureVPDisplayProps) => {
  return (
    <div
      className={`flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded transition-all duration-300 ${
        isOwned
          ? "bg-order-brilliance/20 border border-order-brilliance/30 animate-slowPulse"
          : "bg-gray-700/20 border border-gray-600/30 border-dashed"
      } ${className}`}
    >
      {/* Icon based on status */}
      <span className={`text-xs ${isOwned ? "text-order-brilliance" : "text-gray-300"}`}>{isOwned ? "⚡" : "💤"}</span>

      {/* VP value */}
      <span
        className={`font-bold text-xs ${
          isOwned ? "text-order-brilliance text-shadow-glow-brilliance-xs" : "text-gray-300"
        }`}
      >
        {realmCount}
      </span>

      {/* VP/s label with status */}
      <span className={`text-xxs font-normal ${isOwned ? "text-order-brilliance/80" : "text-gray-300"}`}>
        {isOwned ? "VP/s" : "VP/s (unclaimed)"}
      </span>
    </div>
  );
};
