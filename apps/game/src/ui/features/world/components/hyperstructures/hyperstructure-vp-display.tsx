import { formatCharge } from "@bibliothecadao/types";
import { HudChip } from "@/ui/design-system/kit/hud-elements";
import { hyperstructureRateUnit, type HyperstructureRate } from "@bibliothecadao/eternum";

interface HyperstructureVPDisplayProps {
  rate: HyperstructureRate;
  className?: string;
}

/**
 * A Hyperstructure's rate in its panel, as its map label words it: "2 points/s", or "2 points/s once taken"; in the
 * good tone while it pays.
 */
export const HyperstructureVPDisplay = ({
  rate: { pointsPerSecond, taken },
  className,
}: HyperstructureVPDisplayProps) => (
  <span className={className}>
    <HudChip tone={taken ? "good" : undefined}>
      {taken ? "⚡" : "💤"} {formatCharge(pointsPerSecond)} {hyperstructureRateUnit(taken)}
    </HudChip>
  </span>
);
