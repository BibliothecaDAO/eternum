import { cn } from "@/ui/design-system/atoms/lib/utils";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import { ATTRIBUTE_LOOK, type Attribute, MAX_ATTRIBUTE_LEVEL as MAX_LEVEL } from "./attributes";

/**
 * One choice of an attribute offer: the attribute, its effect, and its level before and after as pips. Levels past 5
 * are lost, drawn faded with the count beside them (never struck through); the choice that lands exactly on 5 glows as
 * the best fit.
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
  const { icon: Icon, effect } = ATTRIBUTE_LOOK[attribute];
  return (
    <article
      className={cn(
        OVERLAY_SURFACE_BASE,
        // Three fit side by side on a 390 px phone.
        "flex w-28 flex-col gap-1.5 rounded-xl p-2.5 sm:w-36 sm:p-3",
        reached === MAX_LEVEL && lost === 0 && "shadow-[0_0_14px_rgba(242,193,78,0.55)]",
      )}
    >
      <Icon className="h-6 w-6 text-gold" aria-hidden />
      <h3 className="text-base font-semibold text-gold">{attribute}</h3>
      <p className="text-xs leading-snug text-gold/80 sm:text-sm">{effect}</p>
      <p className="text-sm font-semibold text-gold tabular-nums">
        {level} → {reached}
        {reached === MAX_LEVEL && " · Max"}
      </p>
      <span className="flex flex-wrap items-center gap-1" aria-label={`Level ${level} to ${reached}`}>
        {Array.from({ length: MAX_LEVEL + lost }, (_, index) => (
          <span
            key={index}
            className={cn(
              "h-2 w-2 rounded-full",
              index < level && "bg-gold",
              index >= level && index < reached && "bg-[#5fd08a]",
              index >= reached && index < MAX_LEVEL && "border border-gold/40",
              index >= MAX_LEVEL && "bg-gold/25",
            )}
          />
        ))}
        {lost > 0 && <span className="ml-1 text-xs text-gold/70">{lost} lost</span>}
      </span>
    </article>
  );
};
