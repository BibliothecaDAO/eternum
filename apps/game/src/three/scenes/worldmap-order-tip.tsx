import { useTooltipStore } from "@/hooks/store/use-tooltip-store";
import { TipLine } from "@/ui/design-system/kit/named-tips";

/** The tip sits beside the tile it names, clear of the pointer and inside the screen. */
const TIP_OFFSET = { x: 12, y: -42 };
const TIP_ROOM = { width: 280, top: 56, edge: 8 };

let shown = false;

/**
 * A highlighted tile's name on the app's one tooltip, as a chip's name is: the map has no element under the pointer,
 * so the scene says the line and where the tile is on screen. Null takes the line away.
 */
export function showOrderTip(tip: { line: string; at: { x: number; y: number } } | null): void {
  const store = useTooltipStore.getState();
  if (!tip) {
    if (shown) store.setTooltip(null);
    shown = false;
    return;
  }
  shown = true;
  store.setTooltip({
    content: <TipLine line={tip.line} />,
    fixed: {
      x: Math.max(TIP_ROOM.edge, Math.min(tip.at.x + TIP_OFFSET.x, window.innerWidth - TIP_ROOM.width)),
      y: Math.max(TIP_ROOM.top, tip.at.y + TIP_OFFSET.y),
    },
  });
}
