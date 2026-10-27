import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { HudButton, HudCost, HudIconButton, HudNotice } from "@/ui/design-system/kit/hud-elements";
import { RIGHT_CLICK_SENDS } from "@/ui/design-system/kit/words";
import type { OrderTip } from "@/ui/features/frontier/hud/order-tip";

/** The surface a desktop tap opens on a tile the selected army can explore or move to, or could but not now. */
export const ORDER_PREVIEW_SURFACE = "order-preview";

/**
 * A desktop tap's move or explore, at its tile, as the attack's preview is: the order, what it costs, and its verb,
 * which sends it. Under the verb, the gesture that sends an order with no preview. An order the army can't take now
 * shows why, its verb disabled.
 */
export const OrderPreview = ({ tip, refusal, onSend }: { tip: OrderTip; refusal?: string; onSend?: () => void }) => {
  const closeSurface = usePopoverStore((state) => state.closeSurface);
  const send = () => {
    closeSurface();
    onSend?.();
  };
  return (
    <div className="flex w-56 max-w-full flex-col gap-2 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        {tip.cost ? <HudCost line={tip.cost} /> : <span />}
        <HudIconButton icon="close" label={`Close ${tip.line}`} kind="quiet" onClick={closeSurface} />
      </div>
      {refusal && <HudNotice tone="bad" line={refusal} />}
      <HudButton kind="primary" disabled={!onSend} onClick={send}>
        {tip.line}
      </HudButton>
      {!refusal && <p className="text-hud-label text-hud-muted">{RIGHT_CLICK_SENDS}</p>}
    </div>
  );
};
