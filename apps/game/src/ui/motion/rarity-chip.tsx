import { INTENSITY, INTENSITY_LABEL, type Intensity } from "./motion-scale";

/** A rarity as its pips and its one word ("Epic") in its colour, never colour alone. */
export const RarityChip = ({ intensity, className }: { intensity: Intensity; className?: string }) => {
  const colour = INTENSITY.colour[intensity];
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`} style={{ color: colour }}>
      <span aria-hidden className="flex gap-1">
        {Array.from({ length: INTENSITY.pips[intensity] }, (_, index) => (
          <span key={index} className="size-2.5 rounded-full" style={{ background: colour }} />
        ))}
      </span>
      <span className="font-[Lexend] text-base font-extrabold">{INTENSITY_LABEL[intensity]}</span>
    </span>
  );
};
