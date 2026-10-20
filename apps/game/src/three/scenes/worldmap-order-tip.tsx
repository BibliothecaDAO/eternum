import { useTooltipStore } from "@/hooks/store/use-tooltip-store";
import { HudCost } from "@/ui/design-system/kit/hud-elements";
import { TipLine } from "@/ui/design-system/kit/named-tips";
import type { OrderTip } from "@/ui/features/frontier/hud/order-tip";
import type { HexPosition } from "@bibliothecadao/types";

/**
 * A tile's line and where it stands on screen (its top left): beside its tile, clear of the map's opened plates, as the
 * plate layer places it (`MapPlateLayer.placeOrderLine`).
 */
export type PlacedOrderTip = OrderTip & { at: { x: number; y: number } };

/**
 * The line for the tile under the pointer, kept true while the pointer rests: the scene says it again whenever what it
 * reads changes under a still pointer (the orders and their reasons, the clock, the camera), until the pointer leaves
 * or a click takes the tile.
 */
export class PointerOrderTip {
  private hex: HexPosition | null = null;
  private taken = false;

  /**
   * `place` names the tile's order, or why none, and where its line stands now; null where there is no line. `gone` is
   * told whenever the line goes, so what made room for it can take its place again.
   */
  constructor(
    private readonly place: (hex: HexPosition) => PlacedOrderTip | null,
    private readonly gone: () => void,
  ) {}

  /**
   * The pointer came to a tile, or left the map (null). The tile a click took is said again only once the pointer has
   * left it: the scene points at the same tile again while the pointer rests there (its hover colours change as the
   * click's preview opens), and the line would sit over that preview.
   */
  point(hex: HexPosition | null): void {
    if (this.taken && hex !== null && this.hex !== null && hex.col === this.hex.col && hex.row === this.hex.row) return;
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
    this.gone();
    showOrderTip(null);
  }

  private say(): void {
    const tip = this.hex && this.place(this.hex);
    if (!tip) this.gone();
    showOrderTip(tip);
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
 * so the scene says the line and where it stands. Null takes the line away, and only the line.
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
        {tip.cost && <HudCost line={tip.cost} />}
      </>
    ),
    fixed: tip.at,
  };
  store.setTooltip(shown);
}
