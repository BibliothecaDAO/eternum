import { hyperstructureRateUnit, type HyperstructureRate } from "@bibliothecadao/eternum";

interface HyperstructureVPDisplayProps {
  rate: HyperstructureRate;
  className?: string;
}

/** A Hyperstructure's rate in its panel, as its map label words it: "2 points/s", or "2 points/s once taken". */
export const HyperstructureVPDisplay = ({
  rate: { pointsPerSecond, taken },
  className = "",
}: HyperstructureVPDisplayProps) => (
  <div
    className={`mt-1 flex items-center gap-1.5 rounded px-2 py-0.5 transition-all duration-300 ${
      taken
        ? "animate-slowPulse border border-order-brilliance/30 bg-order-brilliance/20"
        : "border border-dashed border-gray-600/30"
    } ${className}`}
  >
    <span className={`text-xs ${taken ? "text-order-brilliance" : ""}`}>{taken ? "⚡" : "💤"}</span>
    <span className={`text-xs font-bold ${taken ? "text-order-brilliance text-shadow-glow-brilliance-xs" : ""}`}>
      {pointsPerSecond.toLocaleString()}
    </span>
    <span className={`text-xxs font-normal ${taken ? "text-order-brilliance/80" : ""}`}>
      {hyperstructureRateUnit(taken)}
    </span>
  </div>
);
