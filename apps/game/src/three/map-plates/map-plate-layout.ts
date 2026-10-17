import { formatCount, restingGuard, type MapPlate } from "./map-plate-model";

/** A plate's box on screen, in CSS pixels from the map's top left. */
export interface PlateBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Higher keeps its place: the selected and hovered first, then the player's own, then what threatens them. */
  priority: number;
}

const GAP = 3;

const overlaps = (a: PlateBox, b: PlateBox) =>
  a.x < b.x + b.width + GAP && b.x < a.x + a.width + GAP && a.y < b.y + b.height + GAP && b.y < a.y + a.height + GAP;

/**
 * Stacks overlapping plates instead of covering them: in priority order, each plate rises in steps of its height until
 * it is clear, at most `maxSteps` times; one still overlapping after that is dropped (drawn as a pin). Returns each
 * kept plate's lift.
 */
export const stack = (boxes: readonly PlateBox[], maxSteps = 2): Map<string, number> => {
  const kept: PlateBox[] = [];
  const lifts = new Map<string, number>();
  for (const box of boxes.toSorted((a, b) => b.priority - a.priority)) {
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

const ROW_HEIGHT = 30;
const NAME_LINE = 24;
const OPEN_LINE = 24;

/** The widest opened army that still reads as one line. */
const ONE_LINE_WIDTH = 360;

/** A text's drawn width: in the plate's face, or as a title (a place's name in Cinzel). */
const measure = (() => {
  let context: CanvasRenderingContext2D | null | undefined;
  return (text: string, title = false) => {
    if (context === undefined)
      context = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
    if (!context) return text.length * (title ? 10 : 8);
    context.font = title ? '700 16px "Cinzel"' : '600 15px "Exo 2"';
    return context.measureText(text).width;
  };
})();

/** A plate's resting size, from the words it draws and its paintings and chips at their fixed widths. */
export const restingSize = (plate: MapPlate): { width: number; height: number } => {
  if (plate.kind === "army") {
    const troops = `T${plate.troops.tier} ${formatCount(plate.troops.count)}`;
    return {
      width: Math.ceil(Math.max(measure(troops) + 20 + 12, measure(plate.owner)) + 32),
      height: ROW_HEIGHT + NAME_LINE,
    };
  }
  const guard = restingGuard(plate.guards);
  const guardWords =
    guard.kind === "open"
      ? ""
      : guard.kind === "slot"
        ? `T${guard.slot.tier} ${formatCount(guard.slot.count)}`
        : formatCount(guard.total);
  const lead = plate.title ? measure(plate.title, true) : 20 + (plate.yields !== undefined ? 22 : 0);
  const guardWidth = guard.kind === "open" ? 18 : measure(guardWords) + (guard.kind === "slot" ? 20 + 12 : 0);
  return { width: Math.ceil(lead + guardWidth + 46), height: ROW_HEIGHT };
};

/** An opened army's two halves (owner and home; id and troops), each as drawn. */
const openedArmyHalves = (plate: Extract<MapPlate, { kind: "army" }>) => [
  measure(`${plate.owner} `) + measure(plate.homeName, true) + 20,
  measure(`${plate.code} T${plate.troops.tier} ${formatCount(plate.troops.count)}`) + 20 + 12 + 24,
];

/** Whether an opened army reads on one line. */
export const armyFitsOneLine = (plate: Extract<MapPlate, { kind: "army" }>) => {
  const [first, second] = openedArmyHalves(plate);
  return first + second + 20 <= ONE_LINE_WIDTH;
};

/** A plate's size once opened: a structure grows upward by its lines; an army re-lays its own two lines inline. */
export const openedSize = (plate: MapPlate): { width: number; height: number } => {
  const resting = restingSize(plate);
  if (plate.kind === "army") {
    const [first, second] = openedArmyHalves(plate);
    return armyFitsOneLine(plate)
      ? { width: Math.ceil(first + second + 20), height: ROW_HEIGHT }
      : { width: Math.ceil(Math.max(first, second) + 20), height: ROW_HEIGHT + NAME_LINE };
  }
  const slots = plate.guards.length > 1 ? 1 : 0;
  const arrivals = plate.arrivals.length > 0 ? 1 : 0;
  return {
    width: Math.max(
      resting.width,
      slots ? plate.guards.length * 96 : 0,
      arrivals ? 24 + plate.arrivals.length * 130 : 0,
    ),
    height: resting.height + OPEN_LINE * (1 + slots + arrivals),
  };
};
