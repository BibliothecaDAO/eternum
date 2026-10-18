import { formatExact } from "@/ui/design-system/kit/amount";
import { HudChip, HudPanel } from "@/ui/design-system/kit/hud-elements";
import { TROOPS, UPGRADE } from "@/ui/design-system/kit/words";

/**
 * The last hour's bubble over the map (wireframe 11): the troops still out, in amber because the day's end takes
 * them, the troops their Homecoming will return, and the tiers still to buy. What the facts do not carry yet is left
 * out, never zero.
 */
export const LastHourBubble = ({
  troopsOut,
  returned,
  tiersToBuy,
}: {
  troopsOut: number;
  returned?: number;
  tiersToBuy?: number;
}) => (
  <div role="status" className="pointer-events-auto absolute left-1.5 top-5 max-w-hud-column">
    <HudPanel collapsible={false} bodyClassName="flex flex-wrap gap-1.5">
      <HudChip icons={["troops"]} label={TROOPS} tone="warn">
        {formatExact(troopsOut)}
      </HudChip>
      {returned !== undefined && (
        <HudChip icons={["order-enlightenment", "troops"]} label={TROOPS}>
          {`+${formatExact(returned)}`}
        </HudChip>
      )}
      {tiersToBuy !== undefined && tiersToBuy > 0 && (
        <HudChip icons={["picks"]} label={UPGRADE} tone="warn">
          {formatExact(tiersToBuy)}
        </HudChip>
      )}
    </HudPanel>
  </div>
);
