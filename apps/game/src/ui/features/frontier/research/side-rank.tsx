import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { HudTier } from "@/ui/design-system/kit/hud-elements";
import { type Rank } from "@/ui/design-system/kit/words";

/**
 * One side of a research row as its mark with its rank gem beside it (Fields with V), as the Build sheet's cards and a
 * store's card show it; a row without sides is its gem alone. The mark is the side's own, from sideMarks.
 */
export const SideRank = ({ icon, rank, markSize = 12 }: { icon?: IconMeaning; rank: Rank; markSize?: number }) => (
  <span data-side={icon} className="flex items-center gap-0.5">
    {icon && <Icon name={icon} size={markSize} />}
    <HudTier tier={rank} />
  </span>
);
