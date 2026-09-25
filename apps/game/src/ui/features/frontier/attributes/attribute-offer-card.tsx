import { cn } from "@/ui/design-system/atoms/lib/utils";
import { ATTRIBUTE_LOOK, type Attribute, attributeGain, MAX_ATTRIBUTE_LEVEL as MAX_LEVEL } from "./attributes";

/**
 * One choice of an attribute offer (mockup 6): the attribute's glyph, what the levels it would take give as a number,
 * and its level as five pips, the gained ones bright. Levels past five are lost, drawn as faded pips beyond the five.
 */
export const AttributeOfferCard = ({
  attribute,
  level,
  amount,
}: {
  attribute: Attribute;
  level: number;
  amount: number;
}) => {
  const reached = Math.min(MAX_LEVEL, level + amount);
  const lost = level + amount - reached;
  return (
    <span className="flex w-full flex-col items-center gap-2 px-2 pb-3 pt-4">
      <img src={ATTRIBUTE_LOOK[attribute].glyph} alt="" className="size-12" />
      <span className="frontier-title tabular-nums">{attributeGain(attribute, reached - level)}</span>
      <span className="flex items-center gap-1" aria-hidden>
        {Array.from({ length: MAX_LEVEL + lost }, (_, index) => (
          <span
            key={index}
            className={cn(
              "size-2.5 rounded-full",
              index < level && "bg-[#dfaa54]",
              index >= level && index < reached && "bg-[#fff3c4] shadow-[0_0_6px_rgba(255,243,196,0.8)]",
              index >= reached && index < MAX_LEVEL && "border border-[#dfaa54]/60",
              index >= MAX_LEVEL && "bg-[#dfaa54]/25",
            )}
          />
        ))}
      </span>
    </span>
  );
};
