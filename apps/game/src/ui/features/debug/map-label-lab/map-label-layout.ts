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

const overlaps = (a: LabelBox, b: LabelBox) =>
  a.x < b.x + b.width + GAP && b.x < a.x + a.width + GAP && a.y < b.y + b.height + GAP && b.y < a.y + a.height + GAP;

/**
 * Stacks overlapping plates instead of covering them: in priority order, each plate rises in steps of its height until
 * it is clear, at most `maxSteps` times; one still overlapping after that is dropped (drawn as a pin). Returns each
 * kept plate's lift.
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
