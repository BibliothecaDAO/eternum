/** A label's box on screen, in CSS pixels from the map's top left. */
export interface LabelBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Higher keeps its place: the selected and hovered first, then the player's own, then what threatens them. */
  priority: number;
}

const GAP = 3;

const overlaps = (a: LabelBox, b: Omit<LabelBox, "id" | "priority">) =>
  a.x < b.x + b.width + GAP && b.x < a.x + a.width + GAP && a.y < b.y + b.height + GAP && b.y < a.y + a.height + GAP;

/**
 * The plates that keep their place: highest priority first, each kept unless it overlaps one already kept. What is left
 * out falls back to the system's quieter mark (a pin), so no two plates ever cover each other.
 */
export const declutter = (boxes: readonly LabelBox[]): Set<string> => {
  const kept: LabelBox[] = [];
  for (const box of [...boxes].sort((a, b) => b.priority - a.priority)) {
    if (!kept.some((other) => overlaps(other, box))) kept.push(box);
  }
  return new Set(kept.map((box) => box.id));
};

/**
 * Stacks overlapping plates instead of dropping them: in priority order, each plate rises in steps of its height until
 * it is clear, at most `maxSteps` times; one still overlapping after that is dropped. Returns each kept plate's lift.
 */
export const stack = (boxes: readonly LabelBox[], maxSteps = 2): Map<string, number> => {
  const kept: LabelBox[] = [];
  const lifts = new Map<string, number>();
  for (const box of [...boxes].sort((a, b) => b.priority - a.priority)) {
    for (let step = 0; step <= maxSteps; step++) {
      const lifted = { ...box, y: box.y - step * (box.height + GAP) };
      if (kept.some((other) => overlaps(other, lifted))) continue;
      kept.push(lifted);
      lifts.set(box.id, step * (box.height + GAP));
      break;
    }
  }
  return lifts;
};

type CardSide = "above" | "below" | "right" | "left";

/**
 * Where a hover card goes beside its entity: the side, of the four, that covers the fewest kept plates (above first on
 * a tie), kept inside the map. Plates it still covers are returned so the system can step them aside while it shows.
 */
export const placeCard = (
  anchor: { x: number; y: number },
  card: { width: number; height: number },
  plates: readonly LabelBox[],
  view: { width: number; height: number },
  clearance = 22,
): { x: number; y: number; side: CardSide; covers: string[] } => {
  const sides: Record<CardSide, { x: number; y: number }> = {
    above: { x: anchor.x - card.width / 2, y: anchor.y - clearance - card.height },
    below: { x: anchor.x - card.width / 2, y: anchor.y + clearance },
    right: { x: anchor.x + clearance, y: anchor.y - card.height / 2 },
    left: { x: anchor.x - clearance - card.width, y: anchor.y - card.height / 2 },
  };
  const fitted = (Object.keys(sides) as CardSide[]).map((side) => {
    const x = Math.min(Math.max(sides[side].x, 8), view.width - card.width - 8);
    const y = Math.min(Math.max(sides[side].y, 8), view.height - card.height - 8);
    const box = { x, y, width: card.width, height: card.height };
    const covers = plates.filter((plate) => overlaps(plate, box)).map((plate) => plate.id);
    return { x, y, side, covers };
  });
  return fitted.reduce((best, next) => (next.covers.length < best.covers.length ? next : best));
};
