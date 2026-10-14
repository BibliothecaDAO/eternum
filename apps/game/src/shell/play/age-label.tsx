import { WORDS } from "../words";

/** "Age II" with the numeral on its own: the mode name stays the title. */
export const AgeLabel = ({ numeral }: { numeral: string }) => (
  <span className="flex items-baseline gap-1 font-ui text-[12px] font-semibold text-kit-peach">
    {WORDS.age}
    <b className="text-[20px] font-extrabold leading-none">{numeral}</b>
  </span>
);
