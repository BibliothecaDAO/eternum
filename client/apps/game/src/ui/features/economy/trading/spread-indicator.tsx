import { memo } from "react";

interface SpreadIndicatorProps {
  bidPrice: number;
  askPrice: number;
}

export const SpreadIndicator = memo(({ bidPrice, askPrice }: SpreadIndicatorProps) => {
  // If either price is 0/missing, no spread to show
  if (bidPrice <= 0 || askPrice <= 0) return <div className="w-full h-1 bg-gold/10 rounded-full" />;

  const midPrice = (bidPrice + askPrice) / 2;
  const spreadPercent = midPrice > 0 ? ((askPrice - bidPrice) / midPrice) * 100 : 0;

  // Clamp spread display: 0-50% maps to bar width 5-100%
  const barWidth = Math.min(Math.max(spreadPercent * 2, 5), 100);

  // Color: green for tight (<5%), yellow for medium (5-15%), red for wide (>15%)
  const barColor = spreadPercent < 5 ? "bg-green" : spreadPercent < 15 ? "bg-yellow/70" : "bg-red";

  return (
    <div className="w-full h-1 bg-gold/10 rounded-full overflow-hidden" title={`Spread: ${spreadPercent.toFixed(1)}%`}>
      <div className={`h-full rounded-full transition-all duration-300 ${barColor}`} style={{ width: `${barWidth}%` }} />
    </div>
  );
});

SpreadIndicator.displayName = "SpreadIndicator";
