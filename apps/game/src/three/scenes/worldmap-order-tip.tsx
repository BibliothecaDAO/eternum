import { useTooltipStore } from "@/hooks/store/use-tooltip-store";
import { TipCost, TipLine } from "@/ui/design-system/kit/named-tips";
import type { OrderTip } from "@/ui/features/frontier/hud/order-tip";
import type { HexPosition } from "@bibliothecadao/types";

/**
 * The tip sits under the tile it names, beside the pointer and inside the screen: above the tile is the map plate's
 * place (a tile's plate opens on hover), and the tip never covers it.
 */
const TIP_OFFSET = { x: 12, y: 26 };
const TIP_ROOM = { width: 280, height: 56, top: 56, edge: 8 };

/** A tile's line and where the tile sits on screen. */
export type PlacedOrderTip = OrderTip & { at: { x: number; y: number } };

/**
 * The line for the tile under the pointer, kept true while the pointer rests: the scene says it again whenever what it
 * reads changes under a still pointer (the orders and their reasons, the clock, the camera), until the pointer leaves
 * or a click takes the tile.
 */
export class PointerOrderTip {
  private hex: HexPosition | null = null;
  private taken = false;

  /** `place` names the tile's order, or why none, and where the tile is on screen now; null where there is no line. */
  constructor(private readonly place: (hex: HexPosition) => PlacedOrderTip | null) {}

  /** The pointer came to a tile, or left the map (null). */
  point(hex: HexPosition | null): void {
    this.hex = hex;
    this.taken = false;
    this.say();
  }

  /** What the line reads changed under the still pointer; another surface's tooltip keeps the screen. */
  refresh(): void {
    if (!this.taken && !showsAnotherTip()) this.say();
  }

  /** A click took the tile: its preview or its order stands where the line was, until the pointer moves on. */
  take(): void {
    this.taken = true;
    showOrderTip(null);
  }

  private say(): void {
    showOrderTip(this.hex && this.place(this.hex));
  }
}

/** The tooltip this line last put up; the app's one tooltip is cleared only while it is still this one. */
let shown: Tooltip | null = null;
type Tooltip = Parameters<ReturnType<typeof useTooltipStore.getState>["setTooltip"]>[0];

const showsAnotherTip = (): boolean => {
  const { tooltip } = useTooltipStore.getState();
  return tooltip !== null && tooltip !== shown;
};

/**
 * A highlighted tile's name on the app's one tooltip, as a chip's name is: the map has no element under the pointer,
 * so the scene says the line and where the tile is on screen. Null takes the line away, and only the line.
 */
function showOrderTip(tip: PlacedOrderTip | null): void {
  const store = useTooltipStore.getState();
  if (!tip) {
    if (!showsAnotherTip()) store.setTooltip(null);
    shown = null;
    return;
  }
  shown = {
    content: (
      <>
        <TipLine line={tip.line} />
        {tip.cost && <TipCost cost={tip.cost} />}
      </>
    ),
    fixed: {
      x: Math.max(TIP_ROOM.edge, Math.min(tip.at.x + TIP_OFFSET.x, window.innerWidth - TIP_ROOM.width)),
      y: Math.max(TIP_ROOM.top, Math.min(tip.at.y + TIP_OFFSET.y, window.innerHeight - TIP_ROOM.height)),
    },
  };
  store.setTooltip(shown);
}
