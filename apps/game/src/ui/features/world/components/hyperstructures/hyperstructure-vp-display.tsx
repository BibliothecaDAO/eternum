import { HudChip } from "@/ui/design-system/kit/hud-elements";
import { hyperstructureRateWords, type HyperstructureRate } from "@bibliothecadao/eternum";

interface HyperstructureVPDisplayProps {
  rate: HyperstructureRate;
  className?: string;
}

/** A Hyperstructure's rate in its panel: "points +120/min", or "points +120/min once taken"; in the good tone while it pays. */
export const HyperstructureVPDisplay = ({ rate, className }: HyperstructureVPDisplayProps) => (
  <span className={className}>
    <HudChip tone={rate.taken ? "good" : undefined}>
      {rate.taken ? "⚡" : "💤"} {hyperstructureRateWords(rate)}
    </HudChip>
  </span>
);
