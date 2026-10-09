import { KitIcon } from "@/ui/design-system/kit/kit-icon";

import { VALUE_WORDS } from "../words";

/** AVNU's swap page: LORDS swap to STRK there (owner, 9 Oct); its address keys for a filled pair are not confirmed. */
const AVNU_SWAP = "https://app.avnu.fi/en";

/**
 * The payout wallet holds LORDS but no STRK for the network fee: one line and the swap on AVNU. Nothing is sponsored
 * and the client sends no fee for anyone.
 */
export const NoStrkLine = () => (
  <p className="flex flex-wrap items-center gap-2.5 rounded-xl border border-dashed border-kit-amber px-3 py-2 font-body text-[15px] font-semibold text-kit-gold2">
    <KitIcon code="Lo" size={22} />
    {VALUE_WORDS.noStrk}
    <a
      href={AVNU_SWAP}
      target="_blank"
      rel="noopener noreferrer"
      className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-full border border-kit-gold bg-kit-ink pl-2 pr-3 text-[14px] font-bold text-kit-cream"
    >
      <KitIcon code="Ar" size={20} />
      {VALUE_WORDS.swapOnAvnu}
    </a>
  </p>
);
