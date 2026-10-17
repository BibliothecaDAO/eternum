import { useTooltipStore } from "@/hooks/store/use-tooltip-store";
import { TipLine } from "@/ui/design-system/kit/named-tips";
import type { OrderTip } from "@/ui/features/frontier/hud/order-tip";

/**
 * The tip sits under the tile it names, beside the pointer and inside the screen: above the tile is the map plate's
 * place (a tile's plate opens on hover), and the tip never covers it.
 */
const TIP_OFFSET = { x: 12, y: 26 };
const TIP_ROOM = { width: 280, height: 56, top: 56, edge: 8 };

let shown = false;

/**
 * A highlighted tile's name on the app's one tooltip, as a chip's name is: the map has no element under the pointer,
 * so the scene says the line and where the tile is on screen. Null takes the line away.
 */
export function showOrderTip(tip: (OrderTip & { at: { x: number; y: number } }) | null): void {
  const store = useTooltipStore.getState();
  if (!tip) {
    if (shown) store.setTooltip(null);
    shown = false;
    return;
  }
  shown = true;
  store.setTooltip({
    content: (
      <>
        <TipLine line={tip.line} />
        {tip.gestures && (
          <span className="block text-center font-sans text-[11px] leading-snug text-kit-muted">{tip.gestures}</span>
        )}
      </>
    ),
    fixed: {
      x: Math.max(TIP_ROOM.edge, Math.min(tip.at.x + TIP_OFFSET.x, window.innerWidth - TIP_ROOM.width)),
      y: Math.max(TIP_ROOM.top, Math.min(tip.at.y + TIP_OFFSET.y, window.innerHeight - TIP_ROOM.height)),
    },
  });
}
