import { INTENSITY, INTENSITY_LABEL, type Intensity } from "./motion-scale";

/** A rarity as pips, colour and its word ("Epic"), never colour alone. */
export const RarityChip = ({ intensity, className }: { intensity: Intensity; className?: string }) => {
  const colour = INTENSITY.colour[intensity];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 ${className ?? ""}`}
      style={{ borderColor: colour, color: colour }}
    >
      <span aria-hidden className="flex gap-0.5">
        {Array.from({ length: INTENSITY.pips[intensity] }, (_, index) => (
          <span key={index} className="h-1.5 w-1.5 rounded-full" style={{ background: colour }} />
        ))}
      </span>
      <span className="text-sm font-semibold">{INTENSITY_LABEL[intensity]}</span>
    </span>
  );
};
