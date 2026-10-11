import { type IconCode, KitIcon } from "@/ui/design-system/kit/kit-icon";

import { WORDS } from "../words";

/** An age's live state as a chip: its icon and its one fact ("14 Oct", "Day 12"), or the icon alone. */
export const StateChip = ({ icon, text }: { icon: IconCode; text?: string }) => (
  <span className="frontier-chip h-8 shrink-0 whitespace-nowrap !py-0 !pl-1.5 !pr-3 font-ui text-[14px] font-bold text-kit-cream">
    <KitIcon code={icon} size={20} />
    {text}
  </span>
);

/** A game under way: the sage dot and the word. */
export const LiveChip = () => (
  <span className="frontier-chip h-8 shrink-0 !border-kit-sage/55 !py-0 !pl-2.5 !pr-3 font-ui text-[14px] font-bold text-kit-sage">
    <i aria-hidden className="!size-2.5 rounded-full bg-kit-sage shadow-[0_0_0_3px_theme(colors.kit.sage/25%)]" />
    {WORDS.live}
  </span>
);
