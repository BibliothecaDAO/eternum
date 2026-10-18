import { WORDS } from "@/ui/design-system/kit/words";

/** "Age II" with the numeral on its own: the mode name stays the title. */
export const AgeLabel = ({ numeral }: { numeral: string }) => (
  <span className="flex items-baseline gap-1 font-body text-sm font-semibold text-kit-peach">
    {WORDS.age}
    <b className="text-xl font-extrabold leading-none">{numeral}</b>
  </span>
);
