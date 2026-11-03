import { HudCost } from "@/ui/design-system/kit/hud-elements";
import { TipLine } from "@/ui/design-system/kit/named-tips";
import type { RankedWords } from "@/ui/design-system/kit/words";

/**
 * The game's tooltip held still for the labs: its frame (`.ui-tip`) around what the map's order line puts in it, the
 * line and what it costs (worldmap-order-tip.tsx), where the game shows it only under the pointer.
 */
export const LabTip = ({ line, cost }: { line: RankedWords | string; cost?: RankedWords | string }) => (
  <span className="ui ui-tip" role="tooltip">
    <TipLine line={line} />
    {cost && <HudCost line={cost} />}
  </span>
);
